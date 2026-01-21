type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

type GeminiErrorBody = {
  error?: {
    message?: string;
    status?: string;
    details?: unknown;
    code?: number;
  };
};

export type GeminiLimitType = 'rpm' | 'tpm' | 'rpd' | 'unknown';

export type GeminiGenerateContentArgs = {
  jobId: string;
  model: string;
  parts: GeminiPart[];
  timeoutMs?: number;
  statusWriter?: (statusKo: GeminiJobStatusKo, meta?: { attempt: number; statusCode?: number; limitType?: GeminiLimitType }) =>
    | void
    | Promise<void>;
};

export type GeminiJobStatusKo = '호출대기중' | '생성중' | '재시도중' | '완료' | '실패';

export type GeminiGenerateContentResult = {
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
  status503Count: number;
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

export const inferLimitType = (input: unknown): GeminiLimitType => {
  const s = String(input ?? '').toLowerCase();

  // Common patterns from Google APIs / Gemini quota errors.
  // We keep it intentionally broad to catch localized variations.
  if (/(\brpm\b|requests\s*per\s*minute|per\s*minute\s*requests)/i.test(s)) return 'rpm';
  if (/(\btpm\b|tokens\s*per\s*minute|per\s*minute\s*tokens)/i.test(s)) return 'tpm';
  if (/(\brpd\b|requests\s*per\s*day|per\s*day\s*requests)/i.test(s)) return 'rpd';

  return 'unknown';
};

const parseErrorBody = (rawText: string): GeminiErrorBody | null => {
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
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
  return apiKey;
};

const getConcurrency = () => {
  const v = process.env.GEMINI_CONCURRENCY;
  // default=5
  return Math.max(1, toInt(v, 5));
};

// Singleton limiter per Node.js process
const limiter = new Semaphore(getConcurrency());

type GeminiConcurrencyChangeEvent = {
  prev: number;
  next: number;
  reason: string;
  at: string;
};

type GeminiConcurrencyReducer = (event: GeminiConcurrencyChangeEvent) => void | Promise<void>;

const concurrencyReducers: GeminiConcurrencyReducer[] = [];

export const registerGeminiConcurrencyReducer = (reducer: GeminiConcurrencyReducer) => {
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
    enabled: toBool(process.env.GEMINI_SAFE_MODE_ENABLED, true),
    threshold: Math.max(1, toInt(process.env.GEMINI_SAFE_MODE_THRESHOLD, 3)),
    min: Math.max(1, toInt(process.env.GEMINI_SAFE_MODE_MIN, 3)),
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
    // Nothing to reduce (already at/below min)
    resetConsecutive429();
    return;
  }

  limiter.setLimit(next);
  safeModeReducedCount += 1;
  safeModeLastReductionAt = new Date().toISOString();
  console.log(`(${safeModeLastReductionAt}) (GEMINI_SAFE_MODE) reduce concurrency: ${prev}->${next} (reason: ${reason})`);

  const event: GeminiConcurrencyChangeEvent = {
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
        console.log(
          `(${new Date().toISOString()}) (GEMINI_SAFE_MODE) reducer failed: ${String(e?.message || e)}`,
        );
      }
    }),
  );

  // Reset burst counter after a reduction.
  resetConsecutive429();
};

export const getGeminiConcurrencySnapshot = () => {
  const cfg = getSafeModeConfig();
  const snap = limiter.snapshot;
  return {
    limiter: snap,
    safeMode: {
      enabled: cfg.enabled,
      threshold: cfg.threshold,
      min: cfg.min,
      consecutive429,
      reducedCount: safeModeReducedCount,
      lastReductionAt: safeModeLastReductionAt,
      currentConcurrency: snap.limit,
    },
  };
};

const getRetryConfig = () => {
  return {
    maxRetries: toInt(process.env.GEMINI_RETRY_MAX, 5), // retries after the first try
    backoffBaseMs: toInt(process.env.GEMINI_BACKOFF_BASE_MS, 1000),
    backoffMaxMs: toInt(process.env.GEMINI_BACKOFF_MAX_MS, 30000),
  };
};

const getMinIntervalMs = () => {
  const v = process.env.GEMINI_MIN_INTERVAL_MS;
  // default=1000ms
  const n = Math.trunc(Number(v ?? 1000));
  return Number.isFinite(n) && n >= 0 ? n : 1000;
};

const getRequestTimeoutMs = () => {
  const v = process.env.GEMINI_REQUEST_TIMEOUT_MS;
  // default=120000ms (2 minutes)
  const n = Math.trunc(Number(v ?? 120_000));
  return Number.isFinite(n) && n > 0 ? n : 120_000;
};

// last Gemini call start time (per Node.js process)
let lastCallAtMs = 0;

const calcBackoffMs = (retryIndex: number, baseMs: number, maxMs: number) => {
  const exp = Math.min(retryIndex, 10);
  const raw = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, exp)));
  // full jitter: random(0, raw)
  return Math.max(0, Math.trunc(Math.random() * raw));
};

const extractTextFromResponse = (data: any): string => {
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('')
    : '';
  return String(text || '');
};

const isAbortError = (err: any): boolean => {
  return err?.name === 'AbortError' || /aborted/i.test(String(err?.message || '')) || err?.transient === true;
};

const isRetryableStatus = (statusCode: number) => statusCode === 429 || statusCode === 503;

export async function geminiGenerateContent(args: GeminiGenerateContentArgs): Promise<GeminiGenerateContentResult> {
  const apiKey = getApiKeyOrThrow();
  const fetchFn = getFetch();

  // Queue entry (best-effort)
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
  let status503Count = 0;

  const beforeQueue = limiter.snapshot;
  if (beforeQueue.pending > 0 || beforeQueue.active >= beforeQueue.limit) {
    console.log(
      `(${ts}) (GEMINI_QUEUE) (WAIT) (${args.jobId}|active=${beforeQueue.active}|pending=${beforeQueue.pending}|limit=${beforeQueue.limit})`,
    );
  }

  const release = await limiter.acquire();
  const acquired = new Date().toISOString();
  const snap = limiter.snapshot;
  console.log(`(${acquired}) (GEMINI_SEMAPHORE) (ACQUIRE) (${args.jobId}|inflightCount=${snap.active})`);
  console.log(
    `(${acquired}) (GEMINI_REQUEST) (START) (${args.jobId}|model=${args.model}|requestSizeChars=${promptChars}|requestSizeTokensEst=${promptTokensEst}|active=${snap.active}|pending=${snap.pending}|limit=${snap.limit})`,
  );

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

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
          `(${new Date().toISOString()}) (RATE_WAIT) (${args.jobId}|attempt=${attempt}|waitMs=${waitMs}|minIntervalMs=${minIntervalMs})`,
        );
        await sleep(waitMs);
      }
      lastCallAtMs = Date.now();
      return waitMs;
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutMs = toInt(args.timeoutMs ?? getRequestTimeoutMs(), 120_000);
      const timeoutError: any = new Error(`Gemini request timeout (${timeoutMs}ms)`);
      timeoutError.name = 'AbortError';
      timeoutError.transient = true;
      const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);

      let statusCode = 0;
      let errorText = '';
      let errorBody: GeminiErrorBody | null = null;

      try {
        // attempt 시작 시점에 "생성중"으로 전환 (재시도 후 재진입도 포함)
        await args.statusWriter?.('생성중', { attempt });

        // 요청 간 최소 간격 강제 (호출 직전)
        rateWaitMsTotal += await rateLimitWait(attempt);

        const resp = await fetchFn(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: args.parts }] }),
            signal: controller.signal,
          } as any,
        );

        statusCode = resp?.status ?? 0;

        if (resp?.ok) {
          resetConsecutive429();
          const data: any = await resp.json().catch(() => null);
          const text = extractTextFromResponse(data);
          console.log(
            `(${new Date().toISOString()}) (GEMINI_RESPONSE) (SUCCESS) (${args.jobId}|model=${args.model}|attempt=${attempt}|statusCode=${statusCode}|respChars=${text.length})`,
          );
          if (!text.trim()) {
            const err: any = new Error('Gemini returned empty text');
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
            status503Count,
          };
        }

        errorText = await resp.text().catch(() => '');
        errorBody = parseErrorBody(errorText);

        const msg = errorBody?.error?.message ?? '';
        const status = errorBody?.error?.status ?? '';
        const details = errorBody?.error?.details;
        const limitType = statusCode === 429 ? inferLimitType(msg || errorText) : 'unknown';

        if (statusCode === 429) status429Count += 1;
        if (statusCode === 503) status503Count += 1;

        console.log(
          `(${new Date().toISOString()}) (GEMINI_RESPONSE) (FAIL) (` +
            `${args.jobId}|model=${args.model}|attempt=${attempt}|statusCode=${statusCode}|limitType=${limitType}` +
            `|error.message=${String(msg)}|error.status=${String(status)}|error.details=${safeJsonStringify(details)})`,
        );

        const msgOneLine = String(msg || errorText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);
        const err: any = new Error(
          msgOneLine
            ? `Gemini request failed (status=${statusCode}): ${msgOneLine}`
            : `Gemini request failed (status=${statusCode})`,
        );
        err.statusCode = statusCode;
        if (statusCode === 429) {
          await note429AndMaybeReduceConcurrency('429 burst');
          err._geminiSafeModeNoted = true;
        } else {
          resetConsecutive429();
        }
        err.gemini = {
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
            status503Count,
          },
        };
        throw err;
      } catch (e: any) {
        const aborted = isAbortError(e);
        const code = toInt(e?.statusCode ?? statusCode, 0);
        const retryable = aborted || isRetryableStatus(code);

        if (code === 429) {
          if ((e as any)?._geminiSafeModeNoted !== true) {
            await note429AndMaybeReduceConcurrency('429 burst');
          }
        } else {
          resetConsecutive429();
        }

        const limitType = (e as any)?.gemini?.limitType;

        if (!retryable || attempt >= maxAttempts) {
          if (aborted) {
            console.log(
              `(${new Date().toISOString()}) (GEMINI_RESPONSE) (ABORT) (${args.jobId}|model=${args.model}|attempt=${attempt}|timeoutMs=${timeoutMs})`,
            );
          }

          await args.statusWriter?.('실패', { attempt, statusCode: code || statusCode });
          throw e;
        }

        const retryIndex = attempt; // 1..maxRetries (after attempt N fails, we wait before attempt N+1)
        const waitMs = calcBackoffMs(retryIndex, backoffBaseMs, backoffMaxMs);

        await args.statusWriter?.('재시도중', { attempt, statusCode: code || statusCode, limitType });
        console.log(
          `(${new Date().toISOString()}) (GEMINI_RETRY) (` +
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

    // Unreachable
    throw new Error('Gemini retry loop exited unexpectedly');
  } finally {
    const releasingAt = new Date().toISOString();
    const snapBeforeRelease = limiter.snapshot;
    console.log(`(${releasingAt}) (GEMINI_SEMAPHORE) (RELEASE) (${args.jobId}|inflightCount=${snapBeforeRelease.active})`);
    release();
  }
}
