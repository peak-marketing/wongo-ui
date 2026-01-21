import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderType } from '../common/enums/order-type.enum';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { createHash } from 'crypto';
import { buildCaptionPrompt, buildCorrectionPrompt, buildManuscriptPrompt, buildReceiptReviewPrompt, CaptionItem } from './prompt.templates';
import { geminiGenerateContent, registerGeminiConcurrencyReducer } from '../ai/gemini.client';

const toPosInt = (value: unknown, fallback: number) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const getWorkerConcurrency = () => {
  return Math.max(
    1,
    toPosInt(process.env.GEN_WORKER_CONCURRENCY, toPosInt(process.env.GEN_CONCURRENCY, toPosInt(process.env.GEMINI_CONCURRENCY, 5))),
  );
};

interface GenerationJobData {
  orderId: string;
  autoRegen?: boolean;
  extraInstruction?: string;
  revisionReason?: string;
  personaSnapshot?: string;
  mode?: 'speed' | 'quality';
  qualityMode?: boolean;
  orderData: any;
}

@Processor('generation', {
  concurrency: getWorkerConcurrency(),
})
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  onModuleInit() {
    registerGeminiConcurrencyReducer(async ({ prev, next, reason, at }) => {
      const worker: any = (this as any).worker;
      if (!worker) return;

      const appliedAt = new Date().toISOString();
      let applied = false;

      try {
        if (typeof worker.setConcurrency === 'function') {
          await worker.setConcurrency(next);
          applied = true;
        } else if ('concurrency' in worker) {
          worker.concurrency = next;
          applied = true;
        } else if (worker?.opts && typeof worker.opts === 'object') {
          worker.opts.concurrency = next;
          applied = true;
        }
      } catch (e: any) {
        console.log(`(${appliedAt}) (GEN_WORKER_CONCURRENCY) failed: ${String(e?.message || e)}`);
      }

      if (applied) {
        console.log(
          `(${appliedAt}) (GEN_WORKER_CONCURRENCY) reduce concurrency: ${prev}->${next} (reason: ${reason}|at=${at})`,
        );
      }
    });
  }

  private workerLog(args: {
    event: 'START' | 'END' | 'RETRY' | 'SKIP';
    orderId: string;
    mode: 'speed' | 'quality';
    attempt: number;
    ms: number;
    model: string;
  }) {
    const now = new Date().toISOString();
    console.log(`(${now}) (GEN_WORKER) (${args.event}) (${args.orderId}|${args.mode}|${args.attempt}|${args.ms}|${args.model})`);
  }

  private pickPrimaryModel(mode?: 'speed' | 'quality', qualityMode?: boolean): string {
    const baseModel = String(process.env.GEMINI_MODEL_BASE || 'gemini-3-flash-preview').trim();
    const proModel = String(process.env.GEMINI_MODEL_PRO || 'gemini-3-pro-preview').trim();
    const isQuality = qualityMode === true || mode === 'quality';
    return isQuality ? proModel : baseModel;
  }

  private pickPrimaryModelForOrder(args: { orderType?: OrderType; mode?: 'speed' | 'quality'; qualityMode?: boolean }): string {
    const baseModel = String(process.env.GEMINI_MODEL_BASE || 'gemini-3-flash-preview').trim();
    const proModel = String(process.env.GEMINI_MODEL_PRO || 'gemini-3-pro-preview').trim();
    const isQuality = args.qualityMode === true || args.mode === 'quality';
    if (isQuality) return proModel;

    // MANUSCRIPT speed 모델은 별도 매핑(예: gemini-3.0-fresh). 설정 없으면 baseModel 사용.
    const manuscriptSpeedModel = String(process.env.GEMINI_MODEL_MANUSCRIPT_SPEED || '').trim();

    // RECEIPT_REVIEW speed 모델은 별도 매핑(환경변수로 조정 가능)
    const receiptSpeedModel = String(process.env.GEMINI_MODEL_RECEIPT_SPEED || process.env.GEMINI_MODEL_FLASH_LITE || '').trim();
    if (args.orderType === OrderType.RECEIPT_REVIEW) {
      return receiptSpeedModel || baseModel;
    }
    return manuscriptSpeedModel || baseModel;
  }

  private extractStatusCode(err: any): number {
    const direct = Number(err?.statusCode ?? err?.status ?? 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const resp = Number(err?.response?.status ?? err?.response?.statusCode ?? 0);
    if (Number.isFinite(resp) && resp > 0) return resp;
    const cause = Number(err?.cause?.status ?? err?.cause?.statusCode ?? 0);
    if (Number.isFinite(cause) && cause > 0) return cause;
    const msg = String(err?.message || '');
    const m = msg.match(/status\s*=?\s*(\d{3})/i);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  private isAbortError(err: any): boolean {
    return err?.name === 'AbortError' || /aborted/i.test(String(err?.message || '')) || err?.transient === true;
  }

  private isRetryable(err: any): boolean {
    const code = this.extractStatusCode(err);
    if (code === 429 || code === 503) return true;
    return this.isAbortError(err);
  }

  private shouldSkipGenerating(order: Order): boolean {
    // NOTE:
    // queue.add 직후 DB status 업데이트(ADMIN 서비스)가 아주 짧게 늦을 수 있어
    // 워커가 먼저 잡을 집어오면 'SKIP'로 끝나면서 주문이 GENERATING에 고착되는 레이스가 발생할 수 있다.
    // 따라서 "생성 진행 중"으로 간주 가능한 상태(ADMIN_INTAKE/REGEN_QUEUED/GENERATING)는 처리 대상으로 허용한다.
    // (이 외 상태는 운영상 생성 대상이 아니므로 스킵)
    return !(
      order.status === OrderStatus.GENERATING ||
      order.status === OrderStatus.REGEN_QUEUED ||
      order.status === OrderStatus.ADMIN_INTAKE
    );
  }

  private countOccurrences(haystack: string, needle: string): number {
    const text = String(haystack || '');
    const key = String(needle || '');
    if (!text || !key) return 0;
    let count = 0;
    let from = 0;
    while (true) {
      const idx = text.indexOf(key, from);
      if (idx === -1) break;
      count++;
      from = idx + key.length;
      if (count > 50) break;
    }
    return count;
  }

  private validateReceiptRequiredKeywords(text: string, requiredKeywords: string[]): { hasAtLeastOne: boolean; overRepeated: string[] } {
    const normalizedText = String(text || '');
    const keys = Array.isArray(requiredKeywords)
      ? requiredKeywords.map((k) => String(k || '').trim()).filter((k) => k.length > 0).slice(0, 20)
      : [];
    if (keys.length === 0) {
      return { hasAtLeastOne: true, overRepeated: [] };
    }

    const counts = keys.map((k) => ({ k, n: this.countOccurrences(normalizedText, k) }));
    const hasAtLeastOne = counts.some((c) => c.n >= 1);
    const overRepeated = counts.filter((c) => c.n > 2).map((c) => c.k);
    return { hasAtLeastOne, overRepeated };
  }

  private hash8(input: string) {
    return createHash('sha256').update(input).digest('hex').slice(0, 8);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toLastFailureReason(err: unknown): string {
    const raw = err instanceof Error ? `${err.name || 'Error'}: ${err.message || ''}` : String(err ?? '');
    const normalized = raw.replace(/\s+/g, ' ').trim();
    const trimmed = normalized.length > 0 ? normalized : 'Unknown error';
    return trimmed.slice(0, 200);
  }

  private async callGeminiGenerateContent(args: {
    orderId: string;
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    orderType?: OrderType;
    mode?: 'speed' | 'quality';
    qualityMode?: boolean;
    modelOverride?: string;
  }): Promise<string> {
    const qualityMode = args.qualityMode === true || args.mode === 'quality';
    const model = String(args.modelOverride || '').trim() || this.pickPrimaryModelForOrder({
      orderType: args.orderType,
      mode: args.mode,
      qualityMode: args.qualityMode,
    });

    try {
      const result = await geminiGenerateContent({
        jobId: args.orderId,
        model,
        parts: args.parts,
        statusWriter: async (statusKo) => {
          try {
            await this.orderRepository.update(args.orderId, { geminiStatusKo: statusKo } as any);
          } catch {
            // best-effort: status UI 가시화는 실패해도 생성 플로우를 막지 않음
          }
        },
      });
      console.log(
        `(${new Date().toISOString()}) (GEMINI_MODEL_USED) (SUCCESS) (${args.orderId}|${result.model}|attempts=${result.attemptsUsed})`,
      );
      return result.text;
    } catch (e: any) {
      console.log(
        `(${new Date().toISOString()}) (GEMINI_MODEL_USED) (FAIL) (${args.orderId}|${model}|status=${this.extractStatusCode(e)} )`,
      );
      throw e;
    }
  }

  private async callGeminiGenerateText(args: {
    orderId: string;
    prompt: string;
    orderType?: OrderType;
    mode?: 'speed' | 'quality';
    qualityMode?: boolean;
    modelOverride?: string;
  }): Promise<string> {
    return this.callGeminiGenerateContent({
      orderId: args.orderId,
      parts: [{ text: args.prompt }],
      orderType: args.orderType,
      mode: args.mode,
      qualityMode: args.qualityMode,
      modelOverride: args.modelOverride,
    });
  }

  private inferMimeTypeFromUrl(url: string): string {
    const u = String(url || '').toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
  }

  private resolvePhotoUrl(raw: string): string {
    const u = String(raw || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/')) {
      const port = String(process.env.PORT || '3001').trim();
      return `http://localhost:${port}${u}`;
    }
    return u;
  }

  private async fetchImageInlineData(url: string): Promise<{ mimeType: string; data: string }> {
    const fetchFn: any = (globalThis as any).fetch;
    if (typeof fetchFn !== 'function') {
      throw new Error('fetch is not available in this runtime');
    }
    const abs = this.resolvePhotoUrl(url);
    if (!abs) throw new Error('photo url is empty');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetchFn(abs, { method: 'GET', signal: controller.signal } as any);
      if (!resp?.ok) {
        throw new Error(`failed to fetch image (status=${resp?.status || 0})`);
      }
      const contentType = String(resp.headers?.get?.('content-type') || '').toLowerCase();
      const mimeType = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : this.inferMimeTypeFromUrl(abs);
      const buf = Buffer.from(await resp.arrayBuffer());
      const data = buf.toString('base64');
      if (!data) throw new Error('empty image data');
      return { mimeType, data };
    } catch (e: any) {
      const isAbort = e?.name === 'AbortError' || /aborted/i.test(String(e?.message || ''));
      if (isAbort) {
        const err: any = new Error('image fetch aborted');
        err.transient = true;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractFilenameFromUrl(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const withoutHash = raw.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const lastSlash = withoutQuery.lastIndexOf('/');
    const name = lastSlash >= 0 ? withoutQuery.slice(lastSlash + 1) : withoutQuery;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  private extractFirstUrl(text: string): string {
    const t = String(text || '');
    const m = t.match(/https?:\/\/[^\s)]+/);
    return m?.[0] ?? '';
  }

  private parseCaptionJsonSingle(raw: string, photoIndex: number): CaptionItem {
    const fallback: CaptionItem = { index: photoIndex, caption: '', tags: [], ocr: [] };
    const text = String(raw || '').trim();
    if (!text) return fallback;

    const tryParse = (jsonText: string): CaptionItem | null => {
      try {
        const parsed = JSON.parse(jsonText);
        const obj = Array.isArray(parsed) ? parsed.find((x) => Number(x?.index) === photoIndex) : parsed;
        if (!obj || typeof obj !== 'object') return null;
        const index = Number((obj as any).index);
        if (!Number.isFinite(index) || index !== photoIndex) return null;
        const caption = String((obj as any).caption ?? '').trim();
        const tags = Array.isArray((obj as any).tags) ? (obj as any).tags.map((t: any) => String(t ?? '')).filter(Boolean) : [];
        const ocr = Array.isArray((obj as any).ocr) ? (obj as any).ocr.map((t: any) => String(t ?? '')).filter(Boolean) : [];
        return { index, caption, tags, ocr };
      } catch {
        return null;
      }
    };

    // Prefer object slice
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      const sliced = text.slice(objStart, objEnd + 1);
      const parsed = tryParse(sliced);
      if (parsed) return parsed;
    }

    // Fallback to array slice
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      const sliced = text.slice(arrStart, arrEnd + 1);
      const parsed = tryParse(sliced);
      if (parsed) return parsed;
    }

    return fallback;
  }

  private sanitizeTagList(input: unknown, fallbackCaption?: string): string[] {
    const rawList = Array.isArray(input) ? input.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
    const norm = (t: string) =>
      String(t || '')
        .trim()
        .replace(/[\s\u00A0]+/g, '')
        .replace(/[^가-힣A-Za-z0-9_]/g, '');

    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const it of rawList) {
      const v = norm(it);
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(v);
    }

    let tags = uniq.slice(0, 6);

    const caption = String(fallbackCaption || '').replace(/\r\n?/g, '\n');
    const tokens = (caption.match(/[가-힣A-Za-z0-9_]{2,}/g) || []).map((t) => norm(t)).filter(Boolean);
    const stop = new Set([
      '사진',
      '모습',
      '느낌',
      '분위기',
      '공간',
      '매장',
      '가게',
      '테이블',
      '메뉴',
      '음식',
      '음료',
      '디저트',
      '인테리어',
      '방문',
      '오늘',
    ]);

    for (const t of tokens) {
      if (stop.has(t)) continue;
      if (!tags.includes(t)) tags.push(t);
      if (tags.length >= 6) break;
    }

    if (tags.length < 3) {
      const fallbacks = ['외관', '간판', '입구', '실내', '좌석', '메뉴'];
      for (const f of fallbacks) {
        if (!tags.includes(f)) tags.push(f);
        if (tags.length >= 3) break;
      }
    }

    return tags.slice(0, 6);
  }

  private clampManuscriptLength(manuscript: string, maxChars: number): string {
    const text = String(manuscript || '').trim();
    if (!text) return '';
    if (text.length <= maxChars) return text;

    const sliced = text.slice(0, maxChars);

    // 가능한 한 문장 경계에서 자르기
    const tailWindow = sliced.slice(Math.max(0, sliced.length - 200));
    const candidates = ['\n\n', '\n', '습니다.', '습니다!', '습니다?', '요.', '요!', '요?', '다.', '다!', '다?', '.', '!', '?'];
    let bestCut = -1;

    for (const token of candidates) {
      const idx = tailWindow.lastIndexOf(token);
      if (idx >= 0) {
        const cut = sliced.length - tailWindow.length + idx + token.length;
        if (cut > bestCut) bestCut = cut;
      }
    }

    const finalCut = bestCut > 0 ? bestCut : sliced.length;
    return sliced.slice(0, finalCut).trim();
  }

  private normalizeManuscript(text: string): string {
    const raw = String(text ?? '');
    if (!raw.trim()) return '';

    // 1) newline normalize
    let t = raw.replace(/\r\n?/g, '\n');

    // 1.5) protect intentional photo header newlines: "사진 N" must stay as a standalone line
    // normalizeManuscript는 중간에 끊긴 단어의 줄바꿈을 합치기 위해 아래에서 개행을 제거하는데,
    // 그 로직이 "사진 1\n본문"까지 합쳐버리면 계약(사진 헤더 단독라인)이 깨진다.
    const PHOTO_NL = '\uE000';
    t = t.replace(/(^\s*사진\s+\d+\s*)\n/gm, `$1${PHOTO_NL}`);

    // 2) fix mid-word line breaks only (keep intentional sentence newlines)
    t = t.replace(/([가-힣A-Za-z0-9])\n([가-힣A-Za-z0-9])/g, '$1$2');

    // restore protected newlines
    t = t.replace(new RegExp(PHOTO_NL, 'g'), '\n');

    // 3) trim line ends + collapse excessive spaces inside each line
    t = t
      .split('\n')
      .map((line) => String(line).replace(/[ \t\f\v]{2,}/g, ' ').trimEnd())
      // remove empty parentheses lines (often left after URL/map stripping)
      .filter((l) => !/^\(\s*\)$/.test(l.trim()))
      .join('\n');

    // 3.5) forbid quote-emphasis: remove all double quotes from manuscript
    // - fixes patterns like ""단어"" or "단어" that the model sometimes uses for emphasis
    // - manuscript output contract does not require quotes; safer to strip
    t = t
      .replace(/""\s*([^"\n]+?)\s*""/g, '$1')
      .replace(/[“”"]/g, '');

    // 3.6) forbid markdown emphasis: strip **word**, __word__, ~~word~~
    // - the contract explicitly forbids special-char emphasis; keep the plain text only
    t = t
      .replace(/\*\*\s*([^*\n]+?)\s*\*\*/g, '$1')
      .replace(/__\s*([^_\n]+?)\s*__/g, '$1')
      .replace(/~~\s*([^~\n]+?)\s*~~/g, '$1');

    // 4) collapse too many blank lines (keep at most one empty line)
    t = t.replace(/\n{3,}/g, '\n\n');

    // 5) contract spacing stabilization: keep exactly one blank line
    const lines = t.split('\n');
    if (lines.length === 0) return t;
    const titleIdx = lines.findIndex((l) => /^제목:\s*/.test(l.trim()));
    const hashtagIdx = (() => {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^해시태그:\s*/.test(lines[i].trim())) return i;
      }
      return -1;
    })();

    if (titleIdx === 0 && hashtagIdx > 0) {
      const titleLine = lines[0].trim();
      const bodyLines = lines.slice(1, hashtagIdx);
      const hashtagLine = lines[hashtagIdx].trim();
      const bodyBlock = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      return [titleLine, '', bodyBlock, '', hashtagLine].filter((x) => typeof x === 'string').join('\n');
    }

    return t;
  }

  private normalizeReceipt(text: string): string {
    // receipt는 한 문단이므로, 과도한 줄바꿈은 줄이고
    // quote/markdown 제거 등은 manuscript normalize를 재사용한다.
    const normalized = this.normalizeManuscript(String(text || '')).trim();
    return normalized.replace(/\n{2,}/g, '\n').trim();
  }

  private tryGetEmojiRegex(): RegExp | null {
    try {
      // Node.js unicode property escapes (modern runtimes)
      return new RegExp('\\p{Extended_Pictographic}', 'gu');
    } catch {
      return null;
    }
  }

  private sanitizeReceiptEmojis(input: string, enabled: boolean): string {
    const t = String(input || '');
    if (!t) return '';
    const re = this.tryGetEmojiRegex();
    if (!enabled) {
      return re ? t.replace(re, '') : t;
    }
    if (!re) return t;

    const emojis = t.match(re) || [];
    const emojiCount = emojis.length;

    // "문장 끝마다 이모지" 패턴: 종결부호 다음 바로 이모지가 2회 이상이면 과다로 간주
    const sentenceEndEmojiCount = (t.match(/([.!?…。！？…])\s*\p{Extended_Pictographic}/gu) || []).length;

    if (emojiCount <= 2 && sentenceEndEmojiCount <= 1) {
      return t;
    }

    // 과다/반복이면 전부 제거 후, 마지막에 0~1개만 남긴다(보수적으로)
    const first = emojis[0];
    const stripped = t.replace(re, '').replace(/[ \t]{2,}/g, ' ').trim();
    if (!first) return stripped;
    return stripped.length > 0 ? `${stripped} ${first}` : first;
  }

  private truncateReceiptUnder300(input: string): string {
    const t = String(input || '').trim();
    if (!t) return '';
    if (t.length < 300) return t;

    const hard = t.slice(0, 299);
    // 문장 중간 절단 방지: 마지막 문장부호/개행 기준으로 컷
    let lastPunc = -1;
    for (const m of hard.matchAll(/[.!?…。！？…]/g)) {
      if (typeof m.index === 'number') lastPunc = m.index;
    }
    const lastNl = hard.lastIndexOf('\n');
    const cutIdx = Math.max(lastPunc, lastNl);

    const sliced = cutIdx >= 10 ? hard.slice(0, cutIdx + 1) : hard;
    return sliced.replace(/[ \t]{2,}/g, ' ').trim();
  }

  private safeSliceUtf16(input: string, maxLen: number): string {
    const t = String(input || '');
    const n = Math.max(0, Math.trunc(Number(maxLen)));
    if (t.length <= n) return t;
    let s = t.slice(0, n);
    if (!s) return '';
    const lastCode = s.charCodeAt(s.length - 1);
    // avoid cutting in the middle of a surrogate pair (emoji etc)
    if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
      s = s.slice(0, -1);
    }
    return s;
  }

  private enforceReceiptExactChars(args: { text: string; exactChars: number }): string {
    const target = Math.max(10, Math.min(299, Math.trunc(Number(args.exactChars) || 80)));
    let t = String(args.text || '').replace(/[ \t]{2,}/g, ' ').trim();
    if (!t) return '';

    if (t.length > target) {
      t = this.safeSliceUtf16(t, target);
    }

    const fillers = [
      '추천해요.',
      '만족했어요.',
      '괜찮았어요.',
      '무난했어요.',
      '또 가고 싶어요.',
      '전체적으로 깔끔했어요.',
    ];
    const micro = ['.', '!', '…'];

    // pad without trailing spaces (spaces are counted, but we don't want invisible endings)
    while (t.length < target) {
      const remaining = target - t.length;

      // try phrase fillers first
      let appended = false;
      for (const f of fillers) {
        const sep = t.endsWith('\n') ? '' : ' ';
        const chunk = `${sep}${f}`;
        if (chunk.length <= remaining) {
          t = `${t}${chunk}`;
          appended = true;
          break;
        }
      }
      if (appended) continue;

      // fallback: single-char punctuation
      const last = t.slice(-1);
      const pick = last === '.' ? (remaining > 1 ? '!' : '.') : micro[0];
      t = `${t}${pick}`;
    }

    if (t.length !== target) {
      // last-resort clamp (should be rare)
      t = this.safeSliceUtf16(t, target);
      while (t.length < target) t = `${t}.`;
    }
    return t;
  }

  private normalizeReceiptReviewOutput(args: { text: string; emojiEnabled: boolean }): string {
    // 1) 기본 정규화 (quote/markdown 제거 등)
    let t = this.normalizeReceipt(args.text);
    // 2) 이모지 과다 정리 (선택)
    t = this.sanitizeReceiptEmojis(t, args.emojiEnabled);
    // 2.5) 문장 단위 줄바꿈 (영수증 리뷰는 짧은 문장 여러 줄 허용)
    t = this.formatSentenceLineBreaks(t, { loose: true });
    // 3) 길이 안전장치 (최종 299자)
    t = this.truncateReceiptUnder300(t);
    return t;
  }

  private ensureMenuNameMention(input: string, menuNameRaw: string): { text: string; ok: boolean; injected: boolean } {
    const menuName = String(menuNameRaw || '').trim();
    const text = String(input || '').trim();
    if (!menuName) return { text, ok: true, injected: false };
    if (!text) return { text, ok: false, injected: false };
    if (text.includes(menuName)) return { text, ok: true, injected: false };

    // 최후의 안전장치: 자연스럽게 1회 주입
    // (모델이 메뉴명을 의도적으로 생략하는 케이스를 보완)
    const injected = `${menuName} 먹었는데 ${text}`.replace(/[ \t]{2,}/g, ' ').trim();
    const fixed = this.truncateReceiptUnder300(injected);
    return { text: fixed, ok: fixed.includes(menuName) && fixed.length < 300, injected: true };
  }

  private pickReceiptTargetChars(payload: any): { mode: 'FIXED' | 'RANDOM'; target: number } {
    const mode = String(payload?.mode || 'RANDOM').toUpperCase() === 'FIXED' ? 'FIXED' : 'RANDOM';
    const clamp = (n: number) => Math.max(10, Math.min(299, Math.trunc(n)));
    if (mode === 'FIXED') {
      const fixed = clamp(Number(payload?.fixedChars ?? payload?.targetChars ?? 80));
      return { mode, target: fixed };
    }
    // RANDOM: 10~299 사이 (항상 300자 미만)
    const r = 10 + Math.floor(Math.random() * (299 - 10 + 1));
    return { mode, target: clamp(r) };
  }

  private pickReceiptOutputCount(payload: any): 1 | 5 | 10 {
    const n = Math.trunc(Number(payload?.outputCount));
    if (n === 5) return 5;
    if (n === 10) return 10;
    return 1;
  }

  private formatSentenceLineBreaks(input: string, opts?: { loose?: boolean }): string {
    const t = String(input || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t\f\v]{2,}/g, ' ')
      .trim();
    if (!t) return '';

    // 문장 끝(한국어 종결 + 기호 / 영문 기호) 뒤 공백을 줄바꿈으로 변경
    // 우선순위: 긴 토큰(습니다.) -> 짧은 토큰(다.) -> 일반 기호
    let withBreaks = t
      .replace(/(습니다[.!?])\s+/g, '$1\n')
      .replace(/(니다[.!?])\s+/g, '$1\n')
      .replace(/(요[.!?])\s+/g, '$1\n')
      .replace(/(다[.!?])\s+/g, '$1\n')
      .replace(/([.!?])\s+/g, '$1\n');

    // 영수증 리뷰는 마침표 없이 끝나는 문장도 많아(예: "...했어요 다음에 ...")
    // 종결 어미 뒤 공백을 기준으로도 줄바꿈을 유도한다.
    if (opts?.loose) {
      withBreaks = withBreaks
        .replace(/(습니다)\s+/g, '$1\n')
        .replace(/(니다)\s+/g, '$1\n')
        .replace(/(요)\s+/g, '$1\n')
        .replace(/(다)\s+/g, '$1\n');
    }

    return withBreaks
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
  }

  private stripModelLinkAndMapText(args: { text: string; placeAddress: string }): { text: string; removedUrls: number } {
    let t = String(args.text || '');

    const urls = t.match(/https?:\/\/[^\s)]+/g) || [];
    if (urls.length > 0) {
      t = t.replace(/https?:\/\/[^\s)]+/g, '');
    }

    // remove explicit link/map lines if model emitted them
    t = t
      .split(/\r\n?|\n/)
      .filter((line) => {
        const s = line.trim();
        if (!s) return true;
        if (/^링크:\s*/.test(s)) return false;
        if (/플레이스주소|지도\s*[:：]?|주소\s*[:：]?/i.test(s)) return false;
        return true;
      })
      .join('\n');

    const address = String(args.placeAddress || '').trim();
    if (address) {
      const token = `(${address})`;
      t = t.split(token).join('');
    }

    return { text: t, removedUrls: urls.length };
  }

  private buildHashtagsLine(args: {
    inputHashtags: string[];
    placeName: string;
    searchKeywords: string;
    requiredKeywords: string[];
    emphasisKeywords: string[];
  }): { line: string; tags: string[] } {
    const normalizeToken = (raw: string): string => {
      const r = String(raw || '').trim();
      if (!r) return '';
      const noHash = r
        .replace(/^#+/, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/최대\s*\d+\s*개/gi, '')
        .trim();
      const cleaned = noHash.replace(/[\s#]+/g, '');
      // keep Hangul/English/number/underscore only
      const safe = cleaned.replace(/[^가-힣A-Za-z0-9_]/g, '');
      return safe.length > 0 ? `#${safe}` : '';
    };

    const pushMany = (out: string[], list: string[]) => {
      for (const x of list) {
        const t = normalizeToken(x);
        if (t) out.push(t);
      }
    };

    const base: string[] = [];
    const input = Array.isArray(args.inputHashtags) ? args.inputHashtags : [];
    pushMany(base, input);

    // 해시태그 입력이 있는 경우(가이드 제공): 입력 해시태그만 최대 5개로 사용한다.
    // (검색키워드/가게명/필수키워드로 자동 증식시키면 "너무 많다" 문제가 재발)
    const hasExplicit = base.length > 0;

    if (!hasExplicit) {
      const fromSearch = String(args.searchKeywords || '')
        .split(/[\,\n\t]/)
        .map((s) => s.trim())
        .filter(Boolean);

      pushMany(base, [args.placeName]);
      pushMany(base, fromSearch);
      pushMany(base, Array.isArray(args.requiredKeywords) ? args.requiredKeywords : []);
      pushMany(base, Array.isArray(args.emphasisKeywords) ? args.emphasisKeywords : []);
    }

    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const t of base) {
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(t);
    }

    const tags = uniq.slice(0, 5);
    if (tags.length === 0) {
      tags.push('#맛집');
    }
    // fill to 3~5 정도만, 과다 생성 방지
    const fallbacks = ['#맛집', '#데이트', '#리뷰', '#추천', '#방문후기'];
    for (const f of fallbacks) {
      if (tags.length >= 5) break;
      const key = f.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(f);
      }
    }

    return { line: `해시태그: ${tags.join(' ')}`.trim(), tags };
  }

  private buildTitleLine(args: { placeName: string; searchKeywords: string }): string {
    const place = String(args.placeName || '').trim();
    const kw = String(args.searchKeywords || '')
      .split(/[,\n\t]/)
      .map((s) => s.trim())
      .filter(Boolean)[0];

    const raw = `${place} ${kw ? kw + ' ' : ''}사진으로 정리한 방문 포인트`;
    const title = raw.replace(/\s+/g, ' ').trim();
    const min = 25;
    const max = 40;
    let t = title;
    if (t.length > max) t = t.slice(0, max).trim();
    if (t.length < min) {
      t = (t + ' 추천').replace(/\s+/g, ' ').trim();
      if (t.length > max) t = t.slice(0, max).trim();
    }
    if (!t.includes(place) && place) {
      t = `${place} ${t}`.replace(/\s+/g, ' ').trim();
      if (t.length > max) t = t.slice(0, max).trim();
    }
    return `제목: ${t}`;
  }

  private splitBodyIntoPhotoParagraphs(body: string): string[] {
    const t = String(body || '').replace(/\r\n?/g, '\n').trim();
    if (!t) return [];

    // Token-based slicing (works even when model outputs a single block)
    const tokenRe = /사진\s+(\d+)(?!\d)/g;
    const matches: Array<{ n: number; idx: number }> = [];
    for (let m = tokenRe.exec(t); m; m = tokenRe.exec(t)) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) matches.push({ n, idx: m.index });
    }
    if (matches.length >= 2) {
      const chunks: string[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].idx;
        const end = i + 1 < matches.length ? matches[i + 1].idx : t.length;
        const seg = t.slice(start, end).trim();
        if (seg) chunks.push(seg);
      }
      return chunks.filter(Boolean);
    }

    // Prefer \n\n paragraphs; if not, split by photo token lines.
    const byBlank = t
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (byBlank.length >= 2 && byBlank.some((p) => /^사진\s+\d+/.test(p))) return byBlank;

    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    const chunks: string[] = [];
    let cur: string[] = [];
    for (const line of lines) {
      if (/^사진\s+\d+/.test(line) && cur.length > 0) {
        chunks.push(cur.join(' ').trim());
        cur = [line];
      } else {
        cur.push(line);
      }
    }
    if (cur.length > 0) chunks.push(cur.join(' ').trim());
    return chunks.filter(Boolean);
  }

  private ensureBodyContract(args: {
    modelText: string;
    photoCount: number;
    captions: Array<{ index: number; caption: string; tags: string[]; ocr: string[] }>;
    requiredKeywords: string[];
    emphasisKeywords: string[];
    placeName: string;
    searchKeywords: string;
    inputHashtags: string[];
    hasLink: boolean;
    linkUrl: string;
    hasMap: boolean;
    placeAddress: string;
  }): { manuscript: string; body: string; hashtagsCount: number; photoMentionOk: boolean; keywordsOk: boolean; bodyChars: number } {
    const stripped = this.stripModelLinkAndMapText({ text: args.modelText, placeAddress: args.placeAddress });
    const normalized = this.normalizeManuscript(stripped.text);
    const lines = normalized.split('\n');

    const modelTitleLine = lines[0]?.trim() || '';
    const titleLine = /^제목:\s*/.test(modelTitleLine) && modelTitleLine.length >= 4 ? modelTitleLine : this.buildTitleLine({
      placeName: args.placeName,
      searchKeywords: args.searchKeywords,
    });

    const hashtagLineBuilt = this.buildHashtagsLine({
      inputHashtags: args.inputHashtags,
      placeName: args.placeName,
      searchKeywords: args.searchKeywords,
      requiredKeywords: args.requiredKeywords,
      emphasisKeywords: args.emphasisKeywords,
    });

    // Body candidate: drop title/hashtags lines if present
    const withoutTitle = /^제목:\s*/.test(modelTitleLine) ? lines.slice(1).join('\n').trim() : normalized.trim();
    const withoutHashtags = withoutTitle
      .split(/\n/)
      .filter((l) => !/^해시태그:\s*/.test(l.trim()))
      .join('\n')
      .trim();

    const rawParagraphs = this.splitBodyIntoPhotoParagraphs(withoutHashtags);
    const paraByIndex = new Map<number, string>();
    for (const p of rawParagraphs) {
      const m = p.match(/^사진\s+(\d+)(?!\d)/);
      const n = m?.[1] ? Number(m[1]) : NaN;
      if (Number.isFinite(n) && n >= 1 && n <= args.photoCount && !paraByIndex.has(n)) {
        paraByIndex.set(n, p);
      }
    }

    const ensuredBlocks: string[] = [];
    for (let i = 1; i <= args.photoCount; i++) {
      const cap = args.captions.find((c) => c.index === i);
      const caption = String(cap?.caption || '').trim();
      const tags = this.sanitizeTagList(cap?.tags, caption);

      let p = String(paraByIndex.get(i) || '').trim();
      if (!p) {
        const t1 = tags[0] || '포인트';
        const t2 = tags[1] || tags[0] || '디테일';
        p = `사진 ${i} ${t1}, ${t2} 중심으로 ${caption ? caption : '사진에서 확인되는 요소를 정리해요.'}`.replace(/\s+/g, ' ').trim();
      }

      // enforce paragraph token
      p = p.replace(new RegExp(`^사진\\s*${i}(?!\\d)`), `사진 ${i}`);
      if (!p.startsWith(`사진 ${i}`)) {
        p = `사진 ${i} ${p.replace(/^사진\s+\d+/, '').trim()}`.trim();
      }

      // 사진 헤더 제외 본문
      let content = p.replace(new RegExp(`^사진\\s+${i}(?!\\d)`), '').trim();

      // ensure at least 2 tags appear
      const hit: string[] = [];
      for (const t of tags) {
        if (t && content.includes(t) && !hit.includes(t)) hit.push(t);
      }
      if (tags.length < 2) {
        content = `${content} ${tags[0] ? tags[0] : ''}`.replace(/\s+/g, ' ').trim();
      } else if (hit.length < 2) {
        const need = tags.filter((t) => t && !p.includes(t)).slice(0, 2 - hit.length);
        if (need.length > 0) {
          content = `${content} ${need.join(', ')}도 사진에서 확인됩니다.`.replace(/\s+/g, ' ').trim();
        }
      }

      const formatted = this.formatSentenceLineBreaks(content || caption || '');
      ensuredBlocks.push([`사진 ${i}`, formatted].filter(Boolean).join('\n'));
    }

    // ensure required/emphasis keywords exist in body
    let body = ensuredBlocks.join('\n\n');
    const missingReq = (args.requiredKeywords || []).filter((kw) => kw && !body.includes(kw));
    const missingEmp = (args.emphasisKeywords || []).filter((kw) => kw && !body.includes(kw));
    const missingAll = [...missingReq, ...missingEmp];
    if (missingAll.length > 0) {
      ensuredBlocks[ensuredBlocks.length - 1] = `${ensuredBlocks[ensuredBlocks.length - 1]}\n마지막으로 ${missingAll.join(', ')}도 함께 정리해요.`;
      body = ensuredBlocks.join('\n\n');
    }

    // body length adjust (1500~2500)
    const minChars = 1500;
    const maxChars = 2500;
    let bodyChars = body.length;

    if (bodyChars < minChars) {
      const byIndexCap = new Map<number, { caption: string; tags: string[] }>();
      for (const c of args.captions) {
        byIndexCap.set(c.index, { caption: String(c.caption || '').trim(), tags: this.sanitizeTagList(c.tags, c.caption) });
      }
      let guard = 0;
      while (bodyChars < minChars && guard < 10) {
        for (let i = 1; i <= args.photoCount; i++) {
          const it = byIndexCap.get(i);
          const tags = it?.tags || [];
          const t1 = tags[0] || '포인트';
          const t2 = tags[1] || tags[0] || '디테일';
          ensuredBlocks[i - 1] = `${ensuredBlocks[i - 1]}\n${this.formatSentenceLineBreaks(`${t1}와 ${t2} 기준으로 디테일을 더 짚어보면 사진 흐름이 자연스럽게 이어져요.`)}`;
        }
        body = ensuredBlocks.join('\n\n');
        bodyChars = body.length;
        guard++;
      }
    }

    if (bodyChars > maxChars) {
      const shrinkSentences = (p: string, keepSentences: number): string => {
        const lines = String(p || '').replace(/\r\n?/g, '\n').split('\n');
        const head = String(lines[0] || '').trim();
        const content = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
        const parts = content.split(/(?<=[.!?。])\s+/).filter(Boolean);
        const short = parts.length <= keepSentences ? content : parts.slice(0, keepSentences).join(' ').trim();
        const formatted = this.formatSentenceLineBreaks(short);
        return [head, formatted].filter(Boolean).join('\n').trim();
      };

      const shrinkHard = (p: string, maxLen: number): string => {
        const lines = String(p || '').replace(/\r\n?/g, '\n').split('\n');
        const head = String(lines[0] || '').trim();
        const content = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
        const clipped = content.length > maxLen ? content.slice(0, maxLen).trim() : content;
        const formatted = this.formatSentenceLineBreaks(clipped || '사진에서 보이는 포인트를 간단히 정리해요.');
        return [head, formatted].filter(Boolean).join('\n').trim();
      };

      // 1) 2문장으로 줄이기
      ensuredBlocks.splice(0, ensuredBlocks.length, ...ensuredBlocks.map((p) => shrinkSentences(p, 2)));
      body = ensuredBlocks.join('\n\n');
      bodyChars = body.length;

      // 2) 아직 길면 1문장으로 줄이기
      if (bodyChars > maxChars) {
        ensuredBlocks.splice(0, ensuredBlocks.length, ...ensuredBlocks.map((p) => shrinkSentences(p, 1)));
        body = ensuredBlocks.join('\n\n');
        bodyChars = body.length;
      }

      // 3) 그래도 길면 블록 단위로 더 하드하게 자르되, 블록 자체(특히 마지막 사진)는 절대 삭제하지 않는다.
      if (bodyChars > maxChars) {
        // 대략적으로 블록당 허용 길이를 계산
        const per = Math.max(40, Math.floor(maxChars / Math.max(1, args.photoCount)) - 10);
        ensuredBlocks.splice(0, ensuredBlocks.length, ...ensuredBlocks.map((p) => shrinkHard(p, per)));
        body = ensuredBlocks.join('\n\n');
        bodyChars = body.length;
      }

      // 4) 최후: 그래도 길면, 각 블록을 최소 문구로 고정 (헤더는 유지)
      if (bodyChars > maxChars) {
        ensuredBlocks.splice(
          0,
          ensuredBlocks.length,
          ...ensuredBlocks.map((p) => {
            const head = String(p || '').split(/\r\n?|\n/)[0]?.trim() || '';
            const formatted = this.formatSentenceLineBreaks('사진에서 보이는 핵심 포인트만 짧게 정리해요.');
            return [head, formatted].filter(Boolean).join('\n').trim();
          }),
        );
        body = ensuredBlocks.join('\n\n');
        bodyChars = body.length;
      }
    }

    // appendix (server-side)
    const appendix: string[] = [];
    const url = args.hasLink ? String(args.linkUrl || '').trim() : '';
    const hasUrl = !!url;

    if (args.hasMap) {
      const addr = String(args.placeAddress || '').trim();
      const wrappedAddr = addr ? (addr.startsWith('(') && addr.endsWith(')') ? addr : `(${addr})`) : '';

      // linkUrl이 있으면(=지도/링크 라인이 URL로 강제되는 케이스) 주소 라인을 중복으로 붙이지 않는다.
      if (!hasUrl && wrappedAddr) {
        appendix.push(`지도 삽입 : ${wrappedAddr}`);
      }
    }

    if (args.hasLink && hasUrl) {
      // 지도 삽입이 켜져 있으면 URL 라인은 접두어를 강제해 후처리/검수/템플릿과 일치시킨다.
      if (args.hasMap) appendix.push(`지도 삽입 : ${url}`);
      else appendix.push(url);
    }

    const manuscript = [
      titleLine.trim(),
      '',
      this.normalizeManuscript(body).trim(),
      '',
      ...(appendix.length > 0
        ? appendix
            .map((l) => String(l).trim())
            .filter(Boolean)
            // 각 appendix 라인을 별도 문단으로 유지(최종 normalize에서 한 줄로 합쳐지지 않게)
            .flatMap((l) => [l, ''])
        : []),
      hashtagLineBuilt.line.trim(),
    ]
      .filter((l) => typeof l === 'string')
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const photoMentionOk = ensuredBlocks.every((p, idx) => p.startsWith(`사진 ${idx + 1}\n`) || p.trim() === `사진 ${idx + 1}`);
    const keywordsOk = ensuredBlocks.every((p, idx) => {
      const cap = args.captions.find((c) => c.index === idx + 1);
      const tags = this.sanitizeTagList(cap?.tags, cap?.caption);
      const hits = tags.filter((t) => t && p.includes(t));
      return hits.length >= 2;
    });

    return {
      manuscript,
      body: this.normalizeManuscript(body).trim(),
      hashtagsCount: hashtagLineBuilt.tags.length,
      photoMentionOk,
      keywordsOk,
      bodyChars: this.normalizeManuscript(body).trim().length,
    };
  }

  private autoFixBeforeFinalValidate(args: {
    manuscript: string;
    photoCount: number;
    captions: Array<{ index: number; caption: string; tags: string[]; ocr: string[] }>;
    requiredKeywords: string[];
    emphasisKeywords: string[];
    placeName: string;
    searchKeywords: string;
    inputHashtags: string[];
    hasLink: boolean;
    linkUrl: string;
    hasMap: boolean;
    placeAddress: string;
  }): { text: string; body: string; hashtagsCount: number; photoMentionOk: boolean; keywordsOk: boolean; bodyChars: number; fixes: string[] } {
    const fixes: string[] = [];
    // keep legacy quick fixes (spacing)
    let text = String(args.manuscript || '');
    const beforePhotoSpace = text;
    text = text.replace(/사진(\d+)/g, '사진 $1');
    if (text !== beforePhotoSpace) fixes.push('photo_space');

    const built = this.ensureBodyContract({
      modelText: text,
      photoCount: args.photoCount,
      captions: (args.captions || []).map((c) => ({
        index: Number(c.index),
        caption: String(c.caption || ''),
        tags: this.sanitizeTagList((c as any).tags, c.caption),
        ocr: Array.isArray((c as any).ocr) ? (c as any).ocr.map((x: any) => String(x ?? '')).filter(Boolean) : [],
      })),
      requiredKeywords: args.requiredKeywords || [],
      emphasisKeywords: args.emphasisKeywords || [],
      placeName: args.placeName,
      searchKeywords: args.searchKeywords,
      inputHashtags: args.inputHashtags || [],
      hasLink: !!args.hasLink,
      linkUrl: String(args.linkUrl || '').trim(),
      hasMap: !!args.hasMap,
      placeAddress: String(args.placeAddress || '').trim(),
    });

    fixes.push('contract_rebuild');
    return { ...built, text: built.manuscript, fixes };
  }

  private validateManuscript(args: {
    manuscript: string;
    body: string;
    photoCount: number;
    captions: Array<{ index: number; caption: string; tags: string[]; ocr: string[] }>;
    requiredKeywords: string[];
    emphasisKeywords: string[];
    inputHashtags: string[];
    hasLink: boolean;
    linkUrl: string;
    hasMap: boolean;
    placeAddress: string;
  }): { ok: boolean; failures: string[] } {
    const failures: string[] = [];
    const text = String(args.manuscript || '');
    const body = String(args.body || '');

    // contract presence
    const firstLine = text.replace(/\r\n?/g, '\n').split('\n')[0]?.trim() || '';
    if (!/^제목:\s*/.test(firstLine)) {
      failures.push('출력 계약 위반: 첫 줄은 "제목:"로 시작해야 함');
    }
    const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
    const hashtagLines = lines.filter((l) => /^해시태그:\s*/.test(l));
    if (hashtagLines.length !== 1) {
      failures.push(`출력 계약 위반: "해시태그:" 라인은 1개여야 함 (현재=${hashtagLines.length})`);
    }

    if (hashtagLines.length === 1) {
      const tags = hashtagLines[0].match(/#[^\s#]+/g) || [];
      if (tags.length < 1 || tags.length > 5) {
        failures.push(`해시태그 개수 규칙 위반: 1~5개여야 함 (현재=${tags.length})`);
      }
    }

    const bodyChars = body.trim().length;
    if (bodyChars < 1500 || bodyChars > 2300) {
      failures.push(`본문 글자수 1500~2300자 범위 위반 (현재=${bodyChars})`);
    }

    // 파일명/업로드 URL 패턴 금지
    const forbiddenFilenamePattern = /\b\d{13}_[^\s]+\.(jpg|jpeg|png|webp)\b/i;
    const forbiddenLocalUploadsPattern = /https?:\/\/localhost:3001\/uploads\//i;
    const forbiddenUploadsPathWithExt = /\/uploads\/[\w\-.%]+\.(jpg|jpeg|png|webp)\b/i;
    if (forbiddenFilenamePattern.test(text)) {
      failures.push('파일명 패턴이 원고에 포함됨(예: 13자리_*.jpg)');
    }
    if (forbiddenLocalUploadsPattern.test(text) || forbiddenUploadsPathWithExt.test(text)) {
      failures.push('업로드 URL(/uploads/...)이 원고에 포함됨');
    }

    if (args.photoCount > 0) {
      // 본문(body)만으로 검증
      const noSpacePhotoRef = /사진\d+/;
      if (noSpacePhotoRef.test(body)) {
        failures.push('사진 표기 규칙 위반: "사진 1"처럼 띄어쓰기를 포함해야 함');
      }

      const trimmedBody = body.trimStart();
      if (!trimmedBody.startsWith('사진 1')) {
        failures.push('시작 규칙 위반: 본문은 반드시 "사진 1"로 시작해야 함');
      }

      const paragraphs = this.splitBodyIntoPhotoParagraphs(body);
      if (paragraphs.length !== args.photoCount) {
        failures.push(`출력 계약 위반: 본문 사진 문단 수는 ${args.photoCount}개여야 함 (현재=${paragraphs.length})`);
      }

      // 사진 N은 단독 라인이어야 함(해당 줄에 다른 텍스트 금지)
      const bodyLines = body.replace(/\r\n?/g, '\n').split('\n');
      for (const line of bodyLines) {
        const s = String(line || '').trim();
        if (!s) continue;
        if (/^사진\s+\d+/.test(s) && !/^사진\s+\d+\s*$/.test(s)) {
          failures.push('줄바꿈 규칙 위반: "사진 N"은 단독 라인이어야 함');
          break;
        }
      }

      // 블록 간에는 빈 줄 1줄(즉, \n\n)로 구분되어야 함
      const bodyNorm = body.replace(/\r\n?/g, '\n');
      for (let i = 2; i <= args.photoCount; i++) {
        const token = `\n사진 ${i}\n`;
        if (bodyNorm.includes(token) && !bodyNorm.includes(`\n\n사진 ${i}\n`)) {
          failures.push('줄바꿈 규칙 위반: 사진 블록 사이에 빈 줄 1줄 필요');
          break;
        }
      }

      for (let i = 1; i <= args.photoCount; i++) {
        const p = paragraphs[i - 1] || '';
        if (!p.startsWith(`사진 ${i}`)) {
          failures.push(`출력 계약 위반: 사진 ${i} 문단은 "사진 ${i}"로 시작해야 함`);
          break;
        }
      }

      for (let i = 1; i <= args.photoCount; i++) {
        const re = new RegExp(`사진\\s+${i}(?!\\d)`);
        if (!re.test(body)) failures.push(`사진 언급 누락: 사진 ${i}`);
      }

      // keywords: each paragraph must contain >=2 keywords for that photo
      for (let i = 1; i <= args.photoCount; i++) {
        const cap = args.captions.find((c) => c.index === i);
        const tags = this.sanitizeTagList(cap?.tags, cap?.caption);
        if (tags.length < 2) {
          failures.push(`캡션 태그 부족: 사진 ${i} tags는 최소 2개 필요`);
          continue;
        }
        const p = (this.splitBodyIntoPhotoParagraphs(body)[i - 1] || '').trim();
        const hits = tags.filter((t) => t && p.includes(t));
        if (hits.length < 2) {
          failures.push(`사진-본문 매칭 위반: 사진 ${i} 문단에 tags 최소 2개 포함 필요 (현재=${hits.length})`);
        }
      }
    }

    const required = args.requiredKeywords || [];
    const emphasis = args.emphasisKeywords || [];
    for (const kw of required) {
      if (kw && !text.includes(kw)) failures.push(`필수 키워드 누락: ${kw}`);
    }
    for (const kw of emphasis) {
      if (kw && !text.includes(kw)) failures.push(`강조 키워드 누락: ${kw}`);
    }

    // link/map are server-controlled appendix: enforce exact counts
    const normalizedLines = text
      .split(/\r\n?|\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const urlOnlyLines = normalizedLines.filter((l) => /^https?:\/\//.test(l));
    const mapPrefixedUrlLines = normalizedLines.filter((l) => /^지도\s*삽입\s*:\s*https?:\/\//.test(l));

    if (args.hasLink) {
      const url = String(args.linkUrl || '').trim();
      if (!url) failures.push('hasLink=true but linkUrl empty');

      const hasLinkLabelLine = normalizedLines.some((l) => /^링크:\s*https?:\/\//.test(l));
      if (hasLinkLabelLine) failures.push('링크 규칙 위반: "링크:" 라인은 사용하지 않음');

      if (args.hasMap) {
        // map+link: 반드시 `지도 삽입 : {URL}` 한 줄
        const expected = `지도 삽입 : ${url}`;
        if (mapPrefixedUrlLines.length !== 1) {
          failures.push(`링크 규칙 위반: "지도 삽입 : URL" 라인은 1개여야 함 (현재=${mapPrefixedUrlLines.length})`);
        } else if (url && mapPrefixedUrlLines[0] !== expected) {
          failures.push('링크 규칙 위반: "지도 삽입 : URL" 라인이 지정된 URL과 일치하지 않음');
        }
        if (urlOnlyLines.length > 0) {
          failures.push(`링크 규칙 위반: map 포함 시 URL 단독 라인은 허용하지 않음 (현재=${urlOnlyLines.length})`);
        }
      } else {
        // link only: URL 단독 1줄
        if (urlOnlyLines.length !== 1) failures.push(`링크 규칙 위반: URL 단독 라인은 1개여야 함 (현재=${urlOnlyLines.length})`);
        if (url && urlOnlyLines.length === 1 && urlOnlyLines[0] !== url) {
          failures.push('링크 규칙 위반: URL 단독 라인이 지정된 URL과 일치하지 않음');
        }
        if (mapPrefixedUrlLines.length > 0) failures.push('링크 규칙 위반: map 비포함인데 "지도 삽입" 라인이 포함됨');
      }
    } else {
      if (urlOnlyLines.length > 0 || mapPrefixedUrlLines.length > 0) {
        failures.push(`링크 규칙 위반: 링크 비포함인데 URL이 포함됨 (urlOnly=${urlOnlyLines.length}, mapPrefixed=${mapPrefixedUrlLines.length})`);
      }
    }

    if (args.hasMap) {
      const address = String(args.placeAddress || '').trim();
      const token = address ? `(${address})` : '';
      if (!token) {
        failures.push('지도 포함 요구인데 placeAddress가 비어있음');
      } else {
        const count = text.split(token).length - 1;
        if (count !== 1) failures.push(`지도 규칙 위반: (플레이스주소) 1회 포함 필요 (현재=${count})`);
      }
    } else {
      const address = String(args.placeAddress || '').trim();
      const token = address ? `(${address})` : '';
      if (token && text.includes(token)) failures.push('지도 규칙 위반: 지도 비포함인데 (플레이스주소)가 포함됨');
    }

    // input hashtags must be included
    const inputTags = Array.isArray(args.inputHashtags) ? args.inputHashtags.map((t) => String(t || '').replace(/^#+/, '').trim()).filter(Boolean) : [];
    if (inputTags.length > 0) {
      const lastHashtagLine = hashtagLines[0] || '';
      for (const raw of inputTags) {
        const token = `#${raw.replace(/[\s#]+/g, '').replace(/[^가-힣A-Za-z0-9_]/g, '')}`;
        if (token.length > 1 && !lastHashtagLine.includes(token)) {
          failures.push(`입력 해시태그 누락: ${token}`);
        }
      }
    }

    return { ok: failures.length === 0, failures };
  }

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { orderId, extraInstruction, revisionReason, personaSnapshot, mode, qualityMode } = job.data;
    const effectiveMode: 'speed' | 'quality' = mode === 'quality' || qualityMode === true ? 'quality' : 'speed';
    const startMs = Date.now();

    let order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      try {
        job.discard();
      } catch {
        // noop
      }
      throw new Error(`Order not found: ${orderId}`);
    }

    const modelForLog = this.pickPrimaryModelForOrder({ orderType: order.type, mode: effectiveMode, qualityMode });
    const jobId = String((job as any)?.id ?? (job as any)?.opts?.jobId ?? '');
    console.log(`(${new Date().toISOString()}) (GEN_WORKER) (START) (${orderId}|${jobId}|${effectiveMode}|${modelForLog})`);

    // queue.add 직후 status 반영까지 극히 짧은 레이스가 있을 수 있어, 최대 1.5초까지 기다림
    if (this.shouldSkipGenerating(order)) {
      const waitUntil = Date.now() + 1500;
      while (Date.now() < waitUntil) {
        await this.sleep(200);
        order = await this.orderRepository.findOne({ where: { id: orderId } });
        if (order && !this.shouldSkipGenerating(order)) {
          break;
        }
      }
    }

    if (!order || this.shouldSkipGenerating(order)) {
      this.workerLog({ event: 'SKIP', orderId, mode: effectiveMode, attempt: 0, ms: 0, model: modelForLog });
      return;
    }

    const backoffs = [1000, 2000, 4000, 8000];
    const maxRetries = 4;
    const maxAttempts = 1 + maxRetries;

    this.workerLog({ event: 'START', orderId, mode: effectiveMode, attempt: 1, ms: 0, model: modelForLog });

    const runOnce = async () => {
      if (order.type === OrderType.RECEIPT_REVIEW) {
        const payload: any = (order as any).payload || {};
        const outputCount = this.pickReceiptOutputCount(payload);
        const requiredKeywords = Array.isArray(payload?.requiredKeywords)
          ? payload.requiredKeywords.map((k: any) => String(k || '').trim()).filter((k: string) => k.length > 0).slice(0, 20)
          : Array.isArray(order.requiredKeywords)
            ? order.requiredKeywords
            : [];
        const emoji = Boolean(payload?.emoji);
        const menuName = String(payload?.menuName || '').trim();
        const photoUrl = String(payload?.photoUrl || '').trim();
        const photoInline = photoUrl ? await this.fetchImageInlineData(this.resolvePhotoUrl(photoUrl)) : null;
        const extra = String(payload?.extraInstruction || order.extraInstruction || extraInstruction || '').trim();
        if (!extra) {
          throw new Error('Receipt review requires extraInstruction');
        }

        const outputs: Array<{ index: number; text: string; photoUrl: string | null }> = [];
        for (let i = 1; i <= outputCount; i++) {
          const { mode: receiptMode, target } = this.pickReceiptTargetChars(payload);
          const exactChars = receiptMode === 'FIXED' ? target : null;
          const prompt = buildReceiptReviewPrompt({
            placeName: String(order.placeName || '').trim(),
            menuName: menuName || undefined,
            // 프롬프트에서 사진 언급은 0~1회만(첫 번째 출력에서만 안내)
            photoProvided: Boolean(photoInline) && i === 1,
            requiredKeywords,
            mode: receiptMode,
            targetChars: target,
            emoji,
            outputIndex: i,
            outputCount,
            personaId: order.personaId,
            personaSnapshot: String(personaSnapshot || order.personaSnapshot || ''),
            extraInstruction: extra,
          });

          // 길이 규칙: 항상 300자 미만.
          // 1차: 프롬프트로 강제
          // 2차: 300자 이상이면 자동 재시도(최대 2회)
          // 3차: 그래도 길면 299자까지 문장부호 기준 절단
          let lastNormalized = '';
          let ok = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const retryHint =
              attempt === 1
                ? ''
                : [
                    '',
                    '[재시도 지시]',
                    exactChars ? `- 결과는 공백 포함 정확히 ${exactChars}자여야 한다(± 허용 없음).` : '',
                    '- 필수 키워드가 있다면, 그 중 최소 1개는 반드시 원문 그대로 포함해라.',
                    '- 필수 키워드는 각각 1~2회만 등장해야 한다(과다 반복 금지).',
                  ].join('\n');

            const promptForAttempt = retryHint ? `${prompt}\n${retryHint}` : prompt;
            // 사진은 첫 번째 출력에서만 사용(사진 언급 0~1회 규칙 + 비용/속도 최적화)
            // 또한 flash-lite 계열은 멀티모달을 지원하지 않을 수 있어, 사진이 포함될 때는 base/pro 모델로 강제한다.
            const includePhoto = Boolean(photoInline) && i === 1;
            const parts = includePhoto ? [{ text: promptForAttempt }, { inlineData: photoInline! }] : [{ text: promptForAttempt }];
            const modelOverride = includePhoto ? this.pickPrimaryModel(effectiveMode, qualityMode) : undefined;
            const raw = await this.callGeminiGenerateContent({ orderId, parts, orderType: order.type, mode: effectiveMode, qualityMode, modelOverride });

            // 재시도 판단은 "절단" 없이 먼저 정규화(이모지 정리 포함) 후 길이로 판단
            const preBase = this.sanitizeReceiptEmojis(this.normalizeReceipt(raw), emoji).trim();
            const preBreaks = this.formatSentenceLineBreaks(preBase, { loose: true });
            const preMenu = this.ensureMenuNameMention(preBreaks, menuName);
            lastNormalized = preMenu.text;

            const okLen = Boolean(lastNormalized) && (exactChars ? lastNormalized.length === exactChars : lastNormalized.length < 300);
            const okMenu = !menuName || lastNormalized.includes(menuName);
            const kw = this.validateReceiptRequiredKeywords(lastNormalized, requiredKeywords);
            const okKwMin = kw.hasAtLeastOne;
            const okKwMax = kw.overRepeated.length === 0;
            if (okLen && okMenu && okKwMin && okKwMax) {
              ok = true;
              break;
            }
          }

          // 최종 후처리 + menuName 마지막 보장
          // - RANDOM: 299자 이하 절단 + 정규화
          // - FIXED: 정확히 N자로 맞춤(공백 포함)
          let finalText = '';
          if (exactChars) {
            const base = this.sanitizeReceiptEmojis(this.normalizeReceipt(lastNormalized), emoji).trim();
            const baseBreaks = this.formatSentenceLineBreaks(base, { loose: true });
            const finalMenu = this.ensureMenuNameMention(baseBreaks, menuName);
            const finalBreaks = this.formatSentenceLineBreaks(finalMenu.text, { loose: true });
            finalText = this.enforceReceiptExactChars({ text: finalBreaks, exactChars });
          } else {
            const postBase = this.normalizeReceiptReviewOutput({ text: lastNormalized, emojiEnabled: emoji });
            const finalMenu = this.ensureMenuNameMention(postBase, menuName);
            finalText = this.formatSentenceLineBreaks(finalMenu.text, { loose: true });
          }
          if (!finalText) {
            throw new Error('Empty receipt review output');
          }
          if (exactChars) {
            if (finalText.length !== exactChars) {
              throw new Error(`Receipt review FIXED length guard failed (expected=${exactChars} got=${finalText.length})`);
            }
          } else if (!ok && finalText.length >= 300) {
            throw new Error('Receipt review length guard failed');
          }
          if (menuName && !finalText.includes(menuName)) {
            throw new Error('Receipt review menuName guard failed');
          }

          const finalKw = this.validateReceiptRequiredKeywords(finalText, requiredKeywords);
          if (!finalKw.hasAtLeastOne) {
            throw new Error('Receipt review requiredKeywords guard failed (missing)');
          }
          if (finalKw.overRepeated.length > 0) {
            throw new Error(`Receipt review requiredKeywords guard failed (overRepeated=${finalKw.overRepeated.join(',')})`);
          }
          outputs.push({ index: i, text: finalText, photoUrl: photoUrl || null });

          // 진행률 가시화: outputCount가 큰 경우(예: 10) 생성 중에도 부분 결과를 저장한다.
          // - status는 그대로 GENERATING 유지(외부에서 이미 설정됨)
          // - 실패하더라도 최종 생성 흐름을 막지 않는 best-effort
          try {
            const partialPayload = {
              ...(payload && typeof payload === 'object' ? payload : {}),
              outputCount,
              menuName: String(payload?.menuName || '').trim() || null,
              photoUrl: photoUrl || null,
              requiredKeywords,
              emoji,
              extraInstruction: extra,
              outputs: [...outputs],
            };
            const texts = outputs.map((o) => o.text);
            const partialPreview = texts.length === 1 ? texts[0] : texts.join('\n\n---\n\n');
            await this.orderRepository.update(orderId, {
              payload: partialPayload as any,
              manuscript: partialPreview,
            } as any);
          } catch {
            // noop
          }
        }

        const nextPayload = {
          ...(payload && typeof payload === 'object' ? payload : {}),
          outputCount,
          menuName: String(payload?.menuName || '').trim() || null,
          photoUrl: photoUrl || null,
          requiredKeywords,
          emoji,
          extraInstruction: extra,
          outputs,
        };

        const finalTexts = outputs.map((o) => o.text);
        const manuscriptPreview = outputCount === 1 ? finalTexts[0] : finalTexts.join('\n\n---\n\n');

        await this.orderRepository.update(orderId, {
          status: OrderStatus.GENERATED,
          manuscript: manuscriptPreview,
          payload: nextPayload as any,
          lastFailureReason: null,
        } as any);

        this.logger.log(`Receipt reviews generated for order ${orderId} (count=${outputCount})`);
        return;
      }

      const photos = Array.isArray(order.photos) ? order.photos.filter(Boolean) : [];
      const photoLabels = photos.map((_, idx) => `photo_${idx + 1}`);

      const requiredKeywords = Array.isArray(order.requiredKeywords) ? order.requiredKeywords : [];
      const emphasisKeywords = Array.isArray(order.emphasisKeywords) ? order.emphasisKeywords : [];
      const hashtags = Array.isArray(order.hashtags) ? order.hashtags : [];

      const explicitPlaceUrl = String((order as any).placeUrl || '').trim();

      const combinedForUrl = [
        explicitPlaceUrl,
        order.placeAddress,
        order.guideContent,
        order.referenceReviews,
        order.notes,
        order.searchKeywords,
      ]
        .filter(Boolean)
        .join('\n');

      const extractedExplicitUrl = explicitPlaceUrl ? this.extractFirstUrl(explicitPlaceUrl) : '';
      const extractedFallbackUrl = this.extractFirstUrl(combinedForUrl);
      const linkUrl = order.hasLink ? String(extractedExplicitUrl || extractedFallbackUrl || '').trim() : '';

      const effectiveHasLink = Boolean(order.hasLink && linkUrl);
      if (order.hasLink && !effectiveHasLink) {
        // 과거 주문(또는 잘못 접수된 주문)이 반복 실패 상태에 빠지지 않도록, 생성은 진행하되 링크 append는 생략한다.
        // 신규 주문은 OrdersService에서 placeUrl(mapLink) 필수 검증으로 사전 차단된다.
        this.workerLog({ event: 'WARN', orderId, mode: effectiveMode, attempt: 1, ms: 0, model: modelForLog, message: 'hasLink=true but linkUrl empty -> proceed with hasLink=false' } as any);
      }

      // Step A: captions JSON (multimodal per photo)
      const captions: CaptionItem[] = [];
      for (let i = 1; i <= photos.length; i++) {
        const photoUrl = this.resolvePhotoUrl(String(photos[i - 1] || ''));
        const inline = await this.fetchImageInlineData(photoUrl);
        const captionPrompt = buildCaptionPrompt({
          placeName: order.placeName,
          placeAddress: order.placeAddress,
          searchKeywords: order.searchKeywords,
          guideContent: order.guideContent,
          referenceReviews: order.referenceReviews,
          notes: order.notes,
          personaId: String(order.personaId || ''),
          personaSnapshot: String(personaSnapshot || order.personaSnapshot || ''),
          photoIndex: i,
        });

        const captionRaw = await this.callGeminiGenerateContent({
          orderId,
          parts: [{ text: captionPrompt }, { inlineData: inline }],
          orderType: order.type,
          mode: effectiveMode,
          qualityMode,
        });

        const parsed = this.parseCaptionJsonSingle(captionRaw, i);
        captions.push({
          index: i,
          caption: String(parsed.caption || '').trim(),
          tags: this.sanitizeTagList(parsed.tags, parsed.caption),
          ocr: Array.isArray(parsed.ocr) ? parsed.ocr.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 10) : [],
        });
      }

      // Step B: manuscript
      const manuscriptPrompt = buildManuscriptPrompt({
        placeName: order.placeName,
        placeAddress: order.placeAddress,
        searchKeywords: order.searchKeywords,
        guideContent: order.guideContent,
        requiredKeywords,
        emphasisKeywords,
        hashtags,
        referenceReviews: order.referenceReviews,
        notes: order.notes,
        personaId: String(order.personaId || ''),
        personaSnapshot: String(personaSnapshot || order.personaSnapshot || ''),
        revisionReason: revisionReason || '',
        extraInstruction: extraInstruction || '',
        photoLabels,
        captions,
        hasLink: effectiveHasLink,
        linkUrl,
        hasMap: !!order.hasMap,
      });

      const revisionText = typeof revisionReason === 'string' ? revisionReason.trim() : '';
      const extraText = typeof extraInstruction === 'string' ? extraInstruction.trim() : '';
      console.log(
        `${new Date().toISOString()} (GEMINI_PROMPT) (${orderId}|promptChars=${manuscriptPrompt.length}|revisionChars=${revisionText.length}|revisionHash=${revisionText ? this.hash8(revisionText) : '0'}|extraChars=${extraText.length}|extraHash=${extraText ? this.hash8(extraText) : '0'}|photos=${photoLabels.length})`,
      );

      let manuscript = await this.callGeminiGenerateText({ orderId, prompt: manuscriptPrompt, orderType: order.type, mode: effectiveMode, qualityMode });
      manuscript = this.normalizeManuscript(manuscript);

      // 코드 기반 계약(Contract) 조립 + URL/지도 제거 + 해시태그/제목 서버 강제
      const autoFix1 = this.autoFixBeforeFinalValidate({
        manuscript,
        photoCount: photoLabels.length,
        captions: (captions || []).map((c: any) => ({ index: c.index, caption: c.caption, tags: c.tags, ocr: c.ocr })),
        requiredKeywords,
        emphasisKeywords,
        placeName: order.placeName,
        searchKeywords: order.searchKeywords || '',
        inputHashtags: hashtags,
        hasLink: effectiveHasLink,
        linkUrl,
        hasMap: !!order.hasMap,
        placeAddress: order.placeAddress || '',
      });
      manuscript = autoFix1.text;

      // Step C: validate/correct once
      const validation1 = this.validateManuscript({
        manuscript,
        body: autoFix1.body,
        photoCount: photoLabels.length,
        captions: (captions || []).map((c: any) => ({ index: c.index, caption: c.caption, tags: c.tags, ocr: c.ocr })),
        requiredKeywords,
        emphasisKeywords,
        inputHashtags: hashtags,
        hasLink: effectiveHasLink,
        linkUrl,
        hasMap: !!order.hasMap,
        placeAddress: order.placeAddress || '',
      });

      if (!validation1.ok) {
        console.log(
          `${new Date().toISOString()} (MANUSCRIPT_VALIDATE) (FAIL) (${orderId}|failures=${validation1.failures.length})`,
        );

        const correctionPrompt = buildCorrectionPrompt({
          failures: validation1.failures,
          original: manuscript,
          photoLabels,
          captions,
          requiredKeywords,
          emphasisKeywords,
          personaId: String(order.personaId || ''),
          personaSnapshot: String(personaSnapshot || order.personaSnapshot || ''),
          hasLink: effectiveHasLink,
          linkUrl,
          hasMap: !!order.hasMap,
          placeAddress: order.placeAddress || '',
        });

        manuscript = await this.callGeminiGenerateText({ orderId, prompt: correctionPrompt, orderType: order.type, mode: effectiveMode, qualityMode });

        manuscript = this.normalizeManuscript(manuscript);

        // 보정 응답도 최종 계약으로 재조립
        const autoFix2 = this.autoFixBeforeFinalValidate({
          manuscript,
          photoCount: photoLabels.length,
          captions: (captions || []).map((c: any) => ({ index: c.index, caption: c.caption, tags: c.tags, ocr: c.ocr })),
          requiredKeywords,
          emphasisKeywords,
          placeName: order.placeName,
          searchKeywords: order.searchKeywords || '',
          inputHashtags: hashtags,
          hasLink: effectiveHasLink,
          linkUrl,
          hasMap: !!order.hasMap,
          placeAddress: order.placeAddress || '',
        });
        manuscript = autoFix2.text;

        const validation2 = this.validateManuscript({
          manuscript,
          body: autoFix2.body,
          photoCount: photoLabels.length,
          captions: (captions || []).map((c: any) => ({ index: c.index, caption: c.caption, tags: c.tags, ocr: c.ocr })),
          requiredKeywords,
          emphasisKeywords,
          inputHashtags: hashtags,
          hasLink: effectiveHasLink,
          linkUrl,
          hasMap: !!order.hasMap,
          placeAddress: order.placeAddress || '',
        });

        console.log(
          `${new Date().toISOString()} (MANUSCRIPT_VALIDATE) (${validation2.ok ? 'OK' : 'FAIL'}) (${orderId}|failures=${validation2.failures.length}|chars=${manuscript.length})`,
        );

        if (!validation2.ok) {
          // 마지막 안전장치: 서버가 계약 재조립 결과를 저장해 통과시키되, 원인 추적을 위해 로그/사유는 남긴다
          console.log(
            `${new Date().toISOString()} (MANUSCRIPT_VALIDATE) (FORCED_PASS) (${orderId}|failures=${validation2.failures.length})`,
          );
        }
      } else {
        console.log(
          `${new Date().toISOString()} (MANUSCRIPT_VALIDATE) (OK) (${orderId}|chars=${manuscript.length})`,
        );
      }

      // 저장 직전 최종 normalize (계약 공백/줄바꿈 안정화)
      manuscript = this.normalizeManuscript(manuscript);

      // Update order status to GENERATED (not ADMIN_REVIEW yet)
      await this.orderRepository.update(orderId, {
        status: OrderStatus.GENERATED,
        manuscript,
        lastFailureReason: null,
      });

      this.logger.log(`Manuscript generated for order ${orderId}`);
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runOnce();
        this.workerLog({
          event: 'END',
          orderId,
          mode: effectiveMode,
          attempt,
          ms: Date.now() - startMs,
          model: modelForLog,
        });
        return;
      } catch (err: any) {
        const retryable = this.isRetryable(err);
        const elapsed = Date.now() - startMs;

        if (!retryable || attempt >= maxAttempts) {
          // BullMQ의 attempts/backoff 옵션이 남아있어도, 워커 정책(최대 4회) 외 재시도를 막는다
          try {
            job.discard();
          } catch {
            // noop
          }
          this.workerLog({ event: 'END', orderId, mode: effectiveMode, attempt, ms: elapsed, model: modelForLog });
          throw err;
        }

        const delay = backoffs[Math.min(backoffs.length - 1, attempt - 1)];
        this.workerLog({ event: 'RETRY', orderId, mode: effectiveMode, attempt: attempt + 1, ms: delay, model: modelForLog });
        await this.sleep(delay);
      }
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GenerationJobData>, err: Error) {
    const orderId = job.data.orderId;
    this.logger.error(`Generation failed for order ${orderId}: ${err.message}`, err.stack);

    try {
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
        completedAt: null,
        lastFailureReason: this.toLastFailureReason(err),
      });

      if (!job.data.autoRegen) {
        await this.billingService.release(orderId).catch(releaseErr => {
          this.logger.warn(`Failed to release billing for order ${orderId}: ${releaseErr.message}`);
        });
      }
      // TODO: 알림(이메일/슬랙) 훅 연결
    } catch (updateErr) {
      this.logger.error(`Failed to update order ${orderId} after generation failure: ${updateErr.message}`);
    }
  }
}

