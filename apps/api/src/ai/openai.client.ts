type OpenAIPart = { text?: string; inlineData?: { mimeType: string; data: string } };

type OpenAIErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string;
  };
};

export type OpenAILimitType = 'rpm' | 'tpm' | 'rpd' | 'unknown';

export type OpenAIGenerateContentArgs = {
  jobId: string;
  model: string;
  parts: OpenAIPart[];
  timeoutMs?: number;
  statusWriter?: (statusKo: OpenAIJobStatusKo, meta?: { attempt: number; statusCode?: number; limitType?: OpenAILimitType }) =>
    | void
    | Promise<void>;
};

export type OpenAIJobStatusKo = '호출대기중' | '생성중' | '재시도중' | '완료' | '실패';

export type OpenAIGenerateContentResult = {
  text: string;
  statusCode: number;
  model: string;
  promptChars: number;
  promptTokensEst: number;
  attemptsUsed: number;
  retryCount: number;
  rateWaitMsTotal: number;
  backoffWaitMsTotal: number;
  status429Count: number;
  status5xxCount: number;
};

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private maxActiveObserved = 0;

  constructor(private limit: number) {}

  get snapshot() {
    return {
      active: this.active,
      pending: this.queue.length,
      limit: this.limit,
      maxActiveObserved: this.maxActiveObserved,
    };
  }

  setLimit(nextLimit: number) {
    const n = Math.max(0, Math.trunc(Number(nextLimit)));
    this.limit = Number.isFinite(n) ? n : this.limit;
  }

  async acquire(): Promise<() => void> {
    if (this.limit <= 0) {
      return () => undefined;
    }

    if (this.active < this.limit) {
      this.active += 1;
      this.maxActiveObserved = Math.max(this.maxActiveObserved, this.active);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.active -= 1;
        if (this.active < this.limit) {
          const next = this.queue.shift();
          if (next) next();
        }
      };
    }

    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    this.maxActiveObserved = Math.max(this.maxActiveObserved, this.active);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      if (this.active < this.limit) {
        const next = this.queue.shift();
        if (next) next();
      }
    };
  }
}

const toInt = (value: unknown, fallback: number) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const estimateTokens = (chars: number) => Math.max(1, Math.ceil(chars / 4));

export const inferLimitType = (input: unknown): OpenAILimitType => {
  const s = String(input ?? '').toLowerCase();
  if (/\brpm\b|requests\s*per\s*minute|per\s*minute\s*requests|rate\s*limit/i.test(s)) return 'rpm';
  if (/\btpm\b|tokens\s*per\s*minute|per\s*minute\s*tokens/i.test(s)) return 'tpm';
  if (/\brpd\b|requests\s*per\s*day|per\s*day\s*requests/i.test(s)) return 'rpd';
  return 'unknown';
};

const parseErrorBody = (rawText: string): OpenAIErrorBody | null => {
  const t = String(rawText || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getFetch = (): ((...args: any[]) => Promise<any>) => {
  const fetchFn: any = (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  return fetchFn;
};

const getApiKeyOrThrow = () => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  return apiKey;
};

const getBaseUrl = () => {
  const u = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
  return u.replace(/\/+$/, '');
};

const getConcurrency = () => {
  const v = process.env.OPENAI_CONCURRENCY;
  return Math.max(1, toInt(v, 5));
};

const limiter = new Semaphore(getConcurrency());

type OpenAIConcurrencyChangeEvent = {
  prev: number;
  next: number;
  reason: string;
  at: string;
};

type OpenAIConcurrencyReducer = (event: OpenAIConcurrencyChangeEvent) => void | Promise<void>;

const concurrencyReducers: OpenAIConcurrencyReducer[] = [];

export const registerOpenAIConcurrencyReducer = (reducer: OpenAIConcurrencyReducer) => {
  concurrencyReducers.push(reducer);
};

const toBool = (value: unknown, fallback: boolean) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'off') return false;
  return fallback;
};

const getSafeModeConfig = () => {
  return {
    enabled: toBool(process.env.OPENAI_SAFE_MODE_ENABLED, true),
    threshold: Math.max(1, toInt(process.env.OPENAI_SAFE_MODE_THRESHOLD, 3)),
    min: Math.max(1, toInt(process.env.OPENAI_SAFE_MODE_MIN, 3)),
  };
};

let consecutive429 = 0;
let safeModeReducedCount = 0;
let safeModeLastReductionAt: string | null = null;

const resetConsecutive429 = () => {
  consecutive429 = 0;
};

const note429AndMaybeReduceConcurrency = async (reason: string) => {
  const { enabled, threshold, min } = getSafeModeConfig();
  if (!enabled) return;

  consecutive429 += 1;
  if (consecutive429 < threshold) return;

  const prev = limiter.snapshot.limit;
  const next = Math.max(min, prev - 1);
  if (next >= prev) {
    resetConsecutive429();
    return;
  }

  limiter.setLimit(next);
  safeModeReducedCount += 1;
  safeModeLastReductionAt = new Date().toISOString();
  console.log(`(${safeModeLastReductionAt}) (OPENAI_SAFE_MODE) reduce concurrency: ${prev}->${next} (reason: ${reason})`);

  const event: OpenAIConcurrencyChangeEvent = {
    prev,
    next,
    reason,
    at: safeModeLastReductionAt,
  };

  await Promise.all(
    concurrencyReducers.map(async (fn) => {
      try {
        await fn(event);
      } catch (e: any) {
        console.log(`(${new Date().toISOString()}) (OPENAI_SAFE_MODE) reducer failed: ${String(e?.message || e)}`);
      }
    }),
  );

  resetConsecutive429();
};

const getRetryConfig = () => {
  return {
    maxRetries: toInt(process.env.OPENAI_RETRY_MAX, 5),
    backoffBaseMs: toInt(process.env.OPENAI_BACKOFF_BASE_MS, 1000),
    backoffMaxMs: toInt(process.env.OPENAI_BACKOFF_MAX_MS, 30000),
  };
};

const getMinIntervalMs = () => {
  const v = process.env.OPENAI_MIN_INTERVAL_MS;
  const n = Math.trunc(Number(v ?? 0));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const getRequestTimeoutMs = () => {
  const v = process.env.OPENAI_REQUEST_TIMEOUT_MS;
  const n = Math.trunc(Number(v ?? 120_000));
  return Number.isFinite(n) && n > 0 ? n : 120_000;
};

let lastCallAtMs = 0;

const calcBackoffMs = (retryIndex: number, baseMs: number, maxMs: number) => {
  const exp = Math.min(retryIndex, 10);
  const raw = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, exp)));
  return Math.max(0, Math.trunc(Math.random() * raw));
};

const extractTextFromResponse = (data: any): string => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  // Some clients return an array; best-effort join
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c?.text === 'string' ? c.text : typeof c === 'string' ? c : ''))
      .filter(Boolean)
      .join('');
  }
  return '';
};

const isAbortError = (err: any): boolean => {
  return err?.name === 'AbortError' || /aborted/i.test(String(err?.message || '')) || err?.transient === true;
};

const isRetryableStatus = (statusCode: number) => statusCode === 429 || statusCode === 503 || statusCode >= 500;

const toContentArray = (parts: OpenAIPart[]) => {
  const out: any[] = [];
  for (const p of Array.isArray(parts) ? parts : []) {
    if (typeof p?.text === 'string' && p.text.length > 0) {
      out.push({ type: 'text', text: p.text });
    }
    const inline = p?.inlineData;
    if (inline && typeof inline?.mimeType === 'string' && typeof inline?.data === 'string' && inline.data) {
      const url = `data:${inline.mimeType};base64,${inline.data}`;
      out.push({ type: 'image_url', image_url: { url } });
    }
  }
  return out;
};

export async function openaiGenerateContent(args: OpenAIGenerateContentArgs): Promise<OpenAIGenerateContentResult> {
  const apiKey = getApiKeyOrThrow();
  const fetchFn = getFetch();

  await args.statusWriter?.('호출대기중', { attempt: 1 });

  const ts = new Date().toISOString();
  const promptText = args.parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('');
  const promptChars = promptText.length;
  const promptTokensEst = estimateTokens(promptChars);

  const { maxRetries, backoffBaseMs, backoffMaxMs } = getRetryConfig();
  const maxAttempts = 1 + Math.max(0, maxRetries);

  const minIntervalMs = getMinIntervalMs();
  let rateWaitMsTotal = 0;
  let backoffWaitMsTotal = 0;
  let status429Count = 0;
  let status5xxCount = 0;

  const beforeQueue = limiter.snapshot;
  if (beforeQueue.pending > 0 || beforeQueue.active >= beforeQueue.limit) {
    console.log(
      `(${ts}) (OPENAI_QUEUE) (WAIT) (${args.jobId}|active=${beforeQueue.active}|pending=${beforeQueue.pending}|limit=${beforeQueue.limit})`,
    );
  }

  const release = await limiter.acquire();
  const acquired = new Date().toISOString();
  const snap = limiter.snapshot;
  console.log(`(${acquired}) (OPENAI_SEMAPHORE) (ACQUIRE) (${args.jobId}|inflightCount=${snap.active})`);
  console.log(
    `(${acquired}) (OPENAI_REQUEST) (START) (${args.jobId}|model=${args.model}|requestSizeChars=${promptChars}|requestSizeTokensEst=${promptTokensEst}|active=${snap.active}|pending=${snap.pending}|limit=${snap.limit})`,
  );

  try {
    const url = `${getBaseUrl()}/chat/completions`;

    const rateLimitWait = async (attempt: number) => {
      if (minIntervalMs <= 0) {
        lastCallAtMs = Date.now();
        return 0;
      }
      const now = Date.now();
      const nextAllowed = lastCallAtMs + minIntervalMs;
      const waitMs = Math.max(0, nextAllowed - now);
      if (waitMs > 0) {
        console.log(
          `(${new Date().toISOString()}) (OPENAI_RATE_WAIT) (${args.jobId}|attempt=${attempt}|waitMs=${waitMs}|minIntervalMs=${minIntervalMs})`,
        );
        await sleep(waitMs);
      }
      lastCallAtMs = Date.now();
      return waitMs;
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutMs = toInt(args.timeoutMs ?? getRequestTimeoutMs(), 120_000);
      const timeoutError: any = new Error(`OpenAI request timeout (${timeoutMs}ms)`);
      timeoutError.name = 'AbortError';
      timeoutError.transient = true;
      const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);

      let statusCode = 0;
      let errorText = '';
      let errorBody: OpenAIErrorBody | null = null;

      try {
        await args.statusWriter?.('생성중', { attempt });
        rateWaitMsTotal += await rateLimitWait(attempt);

        const content = toContentArray(args.parts);
        const resp = await fetchFn(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: args.model,
              messages: [{ role: 'user', content }],
              temperature: 0.8,
            }),
            signal: controller.signal,
          } as any,
        );

        statusCode = resp?.status ?? 0;
        if (resp?.ok) {
          resetConsecutive429();
          const data: any = await resp.json().catch(() => null);
          const text = extractTextFromResponse(data);
          console.log(
            `(${new Date().toISOString()}) (OPENAI_RESPONSE) (SUCCESS) (${args.jobId}|model=${args.model}|attempt=${attempt}|statusCode=${statusCode}|respChars=${text.length})`,
          );
          if (!text.trim()) {
            const err: any = new Error('OpenAI returned empty text');
            err.statusCode = statusCode;
            throw err;
          }

          await args.statusWriter?.('완료', { attempt, statusCode });
          return {
            text,
            statusCode,
            model: args.model,
            promptChars,
            promptTokensEst,
            attemptsUsed: attempt,
            retryCount: Math.max(0, attempt - 1),
            rateWaitMsTotal,
            backoffWaitMsTotal,
            status429Count,
            status5xxCount,
          };
        }

        errorText = await resp.text().catch(() => '');
        errorBody = parseErrorBody(errorText);
        const msg = errorBody?.error?.message ?? '';
        const type = errorBody?.error?.type ?? '';
        const code = errorBody?.error?.code ?? '';
        const limitType = statusCode === 429 ? inferLimitType(msg || errorText) : 'unknown';

        if (statusCode === 429) status429Count += 1;
        if (statusCode >= 500) status5xxCount += 1;

        console.log(
          `(${new Date().toISOString()}) (OPENAI_RESPONSE) (FAIL) (` +
            `${args.jobId}|model=${args.model}|attempt=${attempt}|statusCode=${statusCode}|limitType=${limitType}` +
            `|error.message=${String(msg)}|error.type=${String(type)}|error.code=${String(code)}` +
            `|errorBody=${safeJsonStringify(errorBody)})`,
        );

        const msgOneLine = String(msg || errorText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);
        const err: any = new Error(
          msgOneLine
            ? `OpenAI request failed (status=${statusCode}): ${msgOneLine}`
            : `OpenAI request failed (status=${statusCode})`,
        );
        err.statusCode = statusCode;
        if (statusCode === 429) {
          await note429AndMaybeReduceConcurrency('429 burst');
          err._openaiSafeModeNoted = true;
        } else {
          resetConsecutive429();
        }
        err.openai = {
          statusCode,
          errorText,
          errorBody,
          limitType,
          telemetry: {
            attemptsUsed: attempt,
            retryCount: Math.max(0, attempt - 1),
            rateWaitMsTotal,
            backoffWaitMsTotal,
            status429Count,
            status5xxCount,
          },
        };
        throw err;
      } catch (e: any) {
        const aborted = isAbortError(e);
        const code = toInt(e?.statusCode ?? statusCode, 0);
        const retryable = aborted || isRetryableStatus(code);

        if (code === 429) {
          if ((e as any)?._openaiSafeModeNoted !== true) {
            await note429AndMaybeReduceConcurrency('429 burst');
          }
        } else {
          resetConsecutive429();
        }

        const limitType = (e as any)?.openai?.limitType;

        if (!retryable || attempt >= maxAttempts) {
          if (aborted) {
            console.log(
              `(${new Date().toISOString()}) (OPENAI_RESPONSE) (ABORT) (${args.jobId}|model=${args.model}|attempt=${attempt}|timeoutMs=${timeoutMs})`,
            );
          }
          await args.statusWriter?.('실패', { attempt, statusCode: code || statusCode });
          throw e;
        }

        const retryIndex = attempt;
        const waitMs = calcBackoffMs(retryIndex, backoffBaseMs, backoffMaxMs);
        await args.statusWriter?.('재시도중', { attempt, statusCode: code || statusCode, limitType });
        console.log(
          `(${new Date().toISOString()}) (OPENAI_RETRY) (` +
            `${args.jobId}|model=${args.model}|attempt=${attempt}|nextAttempt=${attempt + 1}` +
            `|waitMs=${waitMs}|statusCode=${code || 0}` +
            `)`,
        );
        backoffWaitMsTotal += waitMs;
        await sleep(waitMs);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('OpenAI retry loop exited unexpectedly');
  } finally {
    const releasingAt = new Date().toISOString();
    const snapBeforeRelease = limiter.snapshot;
    console.log(`(${releasingAt}) (OPENAI_SEMAPHORE) (RELEASE) (${args.jobId}|inflightCount=${snapBeforeRelease.active})`);
    release();
  }
}
