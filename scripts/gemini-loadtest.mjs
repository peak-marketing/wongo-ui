import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load local .env (ignored by git) for developer convenience.
// - Does NOT overwrite already-set environment variables.
// - Keep it minimal to avoid adding new dependencies.
const tryLoadDotEnv = () => {
  try {
    const envPath = path.join(root, '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const s = String(line).trim();
      if (!s || s.startsWith('#')) continue;
      const eq = s.indexOf('=');
      if (eq <= 0) continue;
      const key = s.slice(0, eq).trim();
      let value = s.slice(eq + 1).trim();
      if (!key) continue;
      if (process.env[key] !== undefined) continue;
      // Strip surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // best-effort only
  }
};

tryLoadDotEnv();

const distClientPath = path.join(root, 'apps', 'api', 'dist', 'src', 'ai', 'gemini.client.js');

let mod;
try {
  mod = await import(pathToFileURL(distClientPath).href);
} catch (e) {
  throw new Error(
    `Failed to import built gemini client: ${distClientPath}\n` +
      `Run "pnpm -C apps/api build" first.\n` +
      String(e?.message || e),
  );
}

const geminiGenerateContent = mod.geminiGenerateContent;
if (typeof geminiGenerateContent !== 'function') {
  throw new Error('geminiGenerateContent export not found in built module');
}

const getGeminiConcurrencySnapshot =
  typeof mod.getGeminiConcurrencySnapshot === 'function' ? mod.getGeminiConcurrencySnapshot : null;

const count = Math.min(Math.max(Number(process.env.GEMINI_LOADTEST_COUNT || '15'), 1), 200);
const promptChars = Math.min(Math.max(Number(process.env.GEMINI_LOADTEST_PROMPT_CHARS || '200'), 20), 20000);
const model = String(process.env.GEMINI_MODEL_BASE || 'gemini-3-flash-preview').trim();
const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || '60000'), 1), 600000);

const base = 'LOADTEST ping ';
const repeat = Math.max(1, Math.ceil(promptChars / base.length));
const prompt = base.repeat(repeat).slice(0, promptChars);

const statuses = new Map();
const startedAt = Date.now();

let firstFailureDetailsPrinted = false;

const toOneLine = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const toDisplay = (v) => (v === undefined || v === null ? '' : String(v));

const formatDetailsForConsole = (details) => {
  if (details === undefined || details === null) return '(no details)';

  let s;
  try {
    s = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
  } catch {
    s = String(details);
  }

  s = String(s);
  const lines = s.split(/\r?\n/);

  // Keep it readable: print full if short, otherwise summarize to 3~5 lines.
  const shortEnough = s.length <= 1200 && lines.length <= 20;
  if (shortEnough) return s.trim() || '(empty details)';

  const head = lines.slice(0, 4).join('\n');
  return `${head}\n... (truncated, ${s.length} chars)`;
};

const extractFailureInfo = (error) => {
  const httpStatus = Number(error?.statusCode ?? error?.gemini?.statusCode ?? 0) || 0;
  const errStatus = error?.gemini?.errorBody?.error?.status ?? error?.status;
  const errCode = error?.gemini?.errorBody?.error?.code ?? error?.code;
  const errMessage = error?.gemini?.errorBody?.error?.message ?? error?.message ?? String(error);
  const errDetails = error?.gemini?.errorBody?.error?.details ?? error?.details;

  return {
    httpStatus,
    status: errStatus,
    code: errCode,
    message: errMessage,
    details: errDetails,
  };
};

const jobs = Array.from({ length: count }).map((_, i) => {
  const jobId = `loadtest_${startedAt}_${i + 1}`;
  statuses.set(jobId, '호출대기중');
  const started = Date.now();
  return geminiGenerateContent({
    jobId,
    model,
    parts: [{ text: prompt }],
    timeoutMs,
    statusWriter: (s) => statuses.set(jobId, String(s)),
  })
    .then((r) => ({ kind: 'ok', jobId, started, ended: Date.now(), result: r }))
    .catch((e) => {
      statuses.set(jobId, '실패');

      const info = extractFailureInfo(e);
      // Required one-line failure format:
      // jobId | httpStatus | error.status | error.code | error.message
      console.log(
        `${jobId} | ${info.httpStatus || ''} | ${toDisplay(info.status)} | ${toDisplay(info.code)} | ${toOneLine(info.message)}`,
      );

      if (!firstFailureDetailsPrinted) {
        firstFailureDetailsPrinted = true;
        console.log(`FIRST_FAILURE_DETAILS (${jobId})`);
        console.log(formatDetailsForConsole(info.details));
      }

      return { kind: 'fail', jobId, started, ended: Date.now(), error: e };
    });
});

const settled = await Promise.all(jobs);
const endedAt = Date.now();

const ok = settled.filter((r) => r.kind === 'ok').length;
const fail = settled.length - ok;
const totalMs = endedAt - startedAt;
const avgJobMs = settled.length
  ? Math.trunc(settled.reduce((acc, r) => acc + (r.ended - r.started), 0) / settled.length)
  : 0;

let status429Count = 0;
let status503Count = 0;
let maxRetry = 0;

for (const item of settled) {
  if (item.kind === 'ok') {
    status429Count += Number(item.result?.status429Count || 0);
    status503Count += Number(item.result?.status503Count || 0);
    maxRetry = Math.max(maxRetry, Number(item.result?.retryCount || 0));
  } else {
    const tele = item.error?.gemini?.telemetry;
    status429Count += Number(tele?.status429Count || 0);
    status503Count += Number(tele?.status503Count || 0);
    maxRetry = Math.max(maxRetry, Number(tele?.retryCount || 0));
  }
}

const dist = {
  호출대기중: 0,
  생성중: 0,
  재시도중: 0,
  완료: 0,
  실패: 0,
};
for (const st of statuses.values()) {
  if (st in dist) dist[st] += 1;
}

const line = (k, v) => process.stdout.write(`${k}: ${v}\n`);
line('총 작업수', count);
line('완료 수', ok);
line('실패 수', fail);
line('429 발생 횟수', status429Count);
line('503 발생 횟수', status503Count);
line('작업당 평균 소요시간(ms)', avgJobMs);
line('전체 소요시간(ms)', totalMs);
line('maxRetry', maxRetry);
line(
  '상태 분포',
  `호출대기중=${dist['호출대기중']}, 생성중=${dist['생성중']}, 재시도중=${dist['재시도중']}, 완료=${dist['완료']}, 실패=${dist['실패']}`,
);
line('model', model);
line('promptChars', prompt.length);

const initialConcurrency = Math.max(1, Number(process.env.GEMINI_CONCURRENCY || '5'));
const snap = getGeminiConcurrencySnapshot ? getGeminiConcurrencySnapshot() : null;
const maxActiveObserved = Number(snap?.limiter?.maxActiveObserved || 0);
const finalConcurrency = Number(snap?.safeMode?.currentConcurrency || snap?.limiter?.limit || initialConcurrency);
const safeModeReducedCount = Number(snap?.safeMode?.reducedCount || 0);

line('Gemini limiter maxActiveObserved', maxActiveObserved || '(unknown)');
line('active 최대값이 5 초과?', maxActiveObserved ? String(maxActiveObserved > 5) : '(unknown)');
line('active 최대값이 GEMINI_CONCURRENCY 초과?', maxActiveObserved ? String(maxActiveObserved > initialConcurrency) : '(unknown)');
line('세이프모드 발동', String(safeModeReducedCount > 0));
if (safeModeReducedCount > 0) {
  line('세이프모드 최종 동시성', finalConcurrency);
}
