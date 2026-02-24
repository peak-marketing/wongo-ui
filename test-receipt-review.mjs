// E2E smoke test for RECEIPT_REVIEW
// - Logs in as agency, creates receipt-review order (outputCount=10)
// - Logs in as admin, assigns persona + triggers generation
// - Polls until GENERATED
// - Validates:
//   - RANDOM: each output < 300 chars
//   - FIXED: each output === fixedChars chars
//   - emoji not spammed; menuName is mentioned (best-effort)

import { setTimeout as sleep } from 'node:timers/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

function crc32(buf) {
  // Standard PNG CRC32 (IEEE 802.3)
  // Table is generated lazily to keep the file small.
  if (!crc32._table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    crc32._table = table;
  }

  let c = 0xffffffff;
  const table = crc32._table;
  for (const b of buf) {
    c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data || '');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, dataBuf]));
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function makeSolidPng({ width, height, r, g, b, a }) {
  const w = Math.max(1, Math.min(1024, width | 0));
  const h = Math.max(1, Math.min(1024, height | 0));
  const rr = Math.max(0, Math.min(255, r | 0));
  const gg = Math.max(0, Math.min(255, g | 0));
  const bb = Math.max(0, Math.min(255, b | 0));
  const aa = Math.max(0, Math.min(255, a | 0));

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const bytesPerPixel = 4;
  const rowLen = 1 + w * bytesPerPixel; // filter byte + pixels
  const raw = Buffer.alloc(rowLen * h);

  for (let y = 0; y < h; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < w; x++) {
      const p = rowStart + 1 + x * bytesPerPixel;
      raw[p] = rr;
      raw[p + 1] = gg;
      raw[p + 2] = bb;
      raw[p + 3] = aa;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function extToMime(ext) {
  const lower = String(ext || '').toLowerCase();
  if (lower === '.png') return 'image/png';
  if (lower === '.jpg' || lower === '.jpeg') return 'image/jpeg';
  if (lower === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function uploadOnePhoto({ token, filePath }) {
  const filename = path.basename(filePath);
  const buf = await fs.readFile(filePath);
  const ext = path.extname(filename);
  const mime = extToMime(ext);

  const form = new FormData();
  form.append('files', new Blob([buf], { type: mime }), filename);

  const res = await fetch(`${baseUrl}/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = typeof json?.message === 'string' ? json.message : `HTTP ${res.status}`;
    throw new Error(`POST ${baseUrl}/uploads -> ${msg}`);
  }
  const urls = Array.isArray(json?.urls) ? json.urls : [];
  const url = String(urls?.[0] || '').trim();
  if (!url) throw new Error(`upload: missing url. response=${JSON.stringify(json)}`);
  return url;
}

async function httpJson(url, { method = 'GET', token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = typeof json?.message === 'string' ? json.message : `HTTP ${res.status}`;
    throw new Error(`${method} ${url} -> ${msg}`);
  }
  return json;
}

async function login(email, password) {
  const data = await httpJson(`${baseUrl}/auth/login`, { method: 'POST', body: { email, password } });
  if (!data?.accessToken) throw new Error('login: accessToken missing');
  return data.accessToken;
}

const tryGetEmojiRegex = () => {
  try {
    return new RegExp('\\p{Extended_Pictographic}', 'gu');
  } catch {
    return null;
  }
};

function countEmoji(text) {
  const re = tryGetEmojiRegex();
  if (!re) return { total: 0, sentenceEnd: 0 };
  const total = (String(text || '').match(re) || []).length;
  const sentenceEnd = (String(text || '').match(/([.!?…。！？…])\s*\p{Extended_Pictographic}/gu) || []).length;
  return { total, sentenceEnd };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function parseBoolFlag(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'n') return false;
  }
  return undefined;
}

async function getAdminOrder({ adminToken, orderId }) {
  return httpJson(`${baseUrl}/admin/orders/${orderId}`, { method: 'GET', token: adminToken });
}

async function pollUntilReady({ adminToken, orderId, maxWaitSeconds, pollIntervalMs }) {
  const deadline = Date.now() + maxWaitSeconds * 1000;
  let latest;
  while (Date.now() < deadline) {
    latest = await getAdminOrder({ adminToken, orderId });
    const status = latest?.order?.status;
    process.stdout.write(`status=${status}        \r`);
    if (status === 'FAILED') {
      process.stdout.write('\n');
      throw new Error(`generation failed; lastFailureReason=${latest?.order?.lastFailureReason ?? ''}`);
    }
    const okStatuses = new Set(['GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE']);
    if (okStatuses.has(status)) break;
    await sleep(pollIntervalMs);
  }
  process.stdout.write('\n');
  return latest;
}

function validateOutputs({ outputs, expectedCount, expectedExactChars, menuName }) {
  if (outputs.length !== expectedCount) {
    throw new Error(`expected ${expectedCount} outputs; got ${outputs.length}`);
  }

  outputs.forEach((t, idx) => {
    const s = String(t || '');
    if (typeof expectedExactChars === 'number') {
      if (s.length !== expectedExactChars) {
        throw new Error(`output[${idx}] length=${s.length} (!==${expectedExactChars})`);
      }
      return;
    }
    if (s.length >= 300) {
      throw new Error(`output[${idx}] length=${s.length} (>=300)`);
    }
  });

  outputs.forEach((t, idx) => {
    const { total, sentenceEnd } = countEmoji(t);
    if (total > 2 || sentenceEnd > 1) {
      throw new Error(`output[${idx}] emoji overuse: total=${total} sentenceEnd=${sentenceEnd}`);
    }
  });

  const mentionedCount = menuName ? outputs.filter((t) => String(t || '').includes(menuName)).length : 0;
  return { mentionedCount };
}

function validateKeywordPresence({ outputs, requiredKeywords }) {
  const keys = Array.isArray(requiredKeywords)
    ? requiredKeywords.map((k) => String(k || '').trim()).filter((k) => k.length > 0)
    : [];
  if (keys.length === 0) return;

  outputs.forEach((t, idx) => {
    const s = String(t || '');
    const ok = keys.some((k) => s.includes(k));
    if (!ok) {
      throw new Error(`output[${idx}] missing requiredKeywords (needs >=1 of ${keys.join(', ')})`);
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = String(args.mode ?? process.env.RECEIPT_E2E_MODE ?? 'RANDOM')
    .trim()
    .toUpperCase() === 'FIXED'
    ? 'FIXED'
    : 'RANDOM';
  const fixedCharsRaw = Number.parseInt(String(args.fixedChars ?? process.env.RECEIPT_E2E_FIXED_CHARS ?? ''), 10);
  const fixedChars = Number.isFinite(fixedCharsRaw) ? fixedCharsRaw : undefined;
  if (mode === 'FIXED') {
    if (!Number.isFinite(Number(fixedChars)) || Number(fixedChars) < 10 || Number(fixedChars) > 299) {
      throw new Error(`FIXED mode requires --fixedChars 10~299 (got ${args.fixedChars})`);
    }
  }

  const qualityMode =
    parseBoolFlag(args.quality) ??
    parseBoolFlag(args.pro) ??
    parseBoolFlag(process.env.RECEIPT_E2E_QUALITY);
  const maxWaitSeconds = Number.parseInt(String(args.waitSec ?? process.env.RECEIPT_E2E_WAIT_SEC ?? '900'), 10);
  const pollIntervalMs = Number.parseInt(String(args.pollMs ?? process.env.RECEIPT_E2E_POLL_MS ?? '3000'), 10);

  const expectedCount = Number.parseInt(String(args.outputCount ?? process.env.RECEIPT_E2E_OUTPUTS ?? '10'), 10);
  if (!Number.isFinite(expectedCount) || expectedCount <= 0) throw new Error(`invalid outputCount=${args.outputCount}`);

  console.log('=== 1) Login as agency ===');
  const agencyToken = await login('agency1@test.com', 'agency123');

  let orderId = typeof args.orderId === 'string' ? args.orderId.trim() : '';
  let menuName = typeof args.menuName === 'string' ? args.menuName.trim() : '';
  let placeName = typeof args.placeName === 'string' ? args.placeName.trim() : '';

  const requiredKeywords = ['맛', '분위기'];
  let photoUrl = '';

  if (!orderId) {
    menuName = menuName || `테스트메뉴_${crypto.randomUUID().slice(0, 6)}`;
    placeName = placeName || `TEST_RECEIPT_${crypto.randomUUID().slice(0, 8)}`;

    if (args.photo) {
      console.log('=== 1.5) Upload photo (/uploads) ===');
      const photoArg = typeof args.photo === 'string' ? args.photo.trim() : '';
      if (photoArg) {
        photoUrl = await uploadOnePhoto({ token: agencyToken, filePath: photoArg });
      } else {
        // Use a generated PNG (avoid 1x1; some models reject ultra-small images)
        const tmpPath = path.join(process.cwd(), `._tmp_receipt_${crypto.randomUUID().slice(0, 8)}.png`);
        const buf = makeSolidPng({ width: 256, height: 256, r: 240, g: 240, b: 240, a: 255 });
        await fs.writeFile(tmpPath, buf);
        photoUrl = await uploadOnePhoto({ token: agencyToken, filePath: tmpPath });
        await fs.unlink(tmpPath).catch(() => undefined);
      }
      console.log(`photoUrl=${photoUrl}`);
    }

    console.log(`=== 2) Create receipt-review order (outputCount=${expectedCount}) ===`);
    console.log(`qualityMode=${qualityMode === true ? 'true(Pro)' : 'false(Flash-Lite default)'} (arg: --quality/--pro)`);
    console.log(`mode=${mode}${mode === 'FIXED' ? ` fixedChars=${fixedChars}` : ''} (args: --mode/--fixedChars)`);
    const created = await httpJson(`${baseUrl}/orders/receipt-review`, {
      method: 'POST',
      token: agencyToken,
      body: {
        placeName,
        menuName,
        mode,
        fixedChars: mode === 'FIXED' ? fixedChars : undefined,
        photoUrl: photoUrl || undefined,
        requiredKeywords,
        emoji: true,
        qualityMode: qualityMode === true,
        outputCount: expectedCount,
        extraInstruction: '과장 없이, 가격/주소/링크 언급 금지. 반말 금지. 자연스럽게.',
        notes: 'E2E receipt test',
        saveAsDraft: false,
      },
    });
    orderId = created?.id;
    if (!orderId) throw new Error(`create receipt order: missing id. response=${JSON.stringify(created)}`);
    console.log(`orderId=${orderId}`);
    console.log(`placeName=${placeName}`);
    console.log(`menuName=${menuName}`);

    if (args['create-only']) {
      console.log('create-only: exiting early');
      return;
    }
  } else {
    // 폴링/검증만 할 때도 menuName은 best-effort 체크에 사용
    menuName = menuName || '';
  }

  console.log('=== 3) Login as admin ===');
  const adminToken = await login('admin@test.com', 'admin123');

  if (!args['wait-only']) {
    console.log('=== 4) Assign persona + generate ===');
    await httpJson(`${baseUrl}/admin/orders/${orderId}/assign-persona`, {
      method: 'POST',
      token: adminToken,
      body: { personaId: 'default' },
    });
    await httpJson(`${baseUrl}/admin/orders/${orderId}/generate`, {
      method: 'POST',
      token: adminToken,
      body: qualityMode === true ? { qualityMode: true } : {},
    });

    if (args['generate-only']) {
      console.log('generate-only: exiting early');
      return;
    }
  }

  console.log(`=== 5) Poll until generated (max ${maxWaitSeconds}s) ===`);
  const latest = await pollUntilReady({ adminToken, orderId, maxWaitSeconds, pollIntervalMs });

  const finalStatus = latest?.order?.status;
  const okStatuses = new Set(['GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE']);
  if (!okStatuses.has(finalStatus)) {
    // 장시간 생성일 수 있으니, 이 케이스는 스택 트레이스로 소란스럽게 만들지 않는다.
    console.log(
      `not ready; status=${finalStatus} geminiStatusKo=${latest?.order?.geminiStatusKo ?? ''} lastFailureReason=${latest?.order?.lastFailureReason ?? ''}`,
    );
    process.exitCode = 2;
    return;
  }

  const payload = latest?.order?.payload || {};
  const storedMode = String(payload?.mode || '').trim().toUpperCase();
  const storedFixed = payload?.fixedChars === null || payload?.fixedChars === undefined ? undefined : Number(payload.fixedChars);
  console.log('payload.mode/fixedChars:', { mode: storedMode || '(missing)', fixedChars: storedFixed });
  if (mode === 'FIXED') {
    if (storedMode !== 'FIXED') throw new Error(`payload.mode mismatch (expected FIXED, got ${storedMode || '(missing)'})`);
    if (Number(storedFixed) !== Number(fixedChars)) {
      throw new Error(`payload.fixedChars mismatch (expected ${fixedChars}, got ${storedFixed})`);
    }
  }
  const outputsRaw = Array.isArray(payload?.outputs) ? payload.outputs : [];
  const outputs = outputsRaw
    .map((x) => {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object' && typeof x.text === 'string') return x.text;
      return String(x ?? '');
    })
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 0);

  if (args.photo) {
    console.log('=== 5.5) Validate: photoUrl stored in payload/outputs ===');
    const pPhoto = String(payload?.photoUrl || '').trim();
    if (!pPhoto) throw new Error('payload.photoUrl missing (expected when --photo)');
    const outputObjs = Array.isArray(outputsRaw) ? outputsRaw.filter((x) => x && typeof x === 'object') : [];
    if (outputObjs.length > 0) {
      const wrong = outputObjs.filter((o) => String(o.photoUrl || '').trim() !== pPhoto);
      if (wrong.length > 0) throw new Error('outputs[*].photoUrl mismatch with payload.photoUrl');
    }
    console.log('OK: payload.photoUrl and outputs[*].photoUrl present');
  }

  console.log(`=== 6) Validate: outputs length (${mode === 'FIXED' ? `exact ${fixedChars}` : '< 300'}) / emoji limits ===`);
  const { mentionedCount } = validateOutputs({
    outputs,
    expectedCount,
    expectedExactChars: mode === 'FIXED' ? fixedChars : undefined,
    menuName,
  });
  console.log(`OK: length=${mode === 'FIXED' ? `exact ${fixedChars}` : '< 300'}, emoji within limits`);

  console.log('=== 6.5) Validate: requiredKeywords (>=1 per output) ===');
  validateKeywordPresence({ outputs, requiredKeywords });
  console.log('OK: each output contains >=1 required keyword');

  if (menuName) {
    console.log('=== 7) Validate: menuName mentioned (best-effort) ===');
    console.log({ menuName, mentionedCount });
    if (mentionedCount === 0) {
      console.warn('WARN: menuName not found in outputs (model may rephrase).');
    }
  }

  console.log('=== Sample outputs (first 3) ===');
  outputs.slice(0, 3).forEach((t, idx) => {
    console.log(`--- #${idx + 1} (${String(t || '').length} chars) ---`);
    console.log(String(t || ''));
  });

  // Persist an evidence artifact to outputs/ for easy sharing.
  try {
    const outDir = path.resolve('outputs');
    await fs.mkdir(outDir, { recursive: true });

    const meta = {
      orderId,
      finalStatus,
      expectedCount,
      menuName,
      placeName,
      requiredKeywords,
      photo: {
        requested: Boolean(args.photo),
        payloadPhotoUrl: String(payload?.photoUrl || '').trim(),
      },
      validations: {
        maxCharsPerOutput: 299,
        emojiMaxTotal: 2,
        emojiMaxSentenceEnd: 1,
        mentionedCount,
      },
      outputs,
      savedAt: new Date().toISOString(),
    };

    const metaPath = path.join(outDir, `receipt_review_${orderId}.meta.json`);
    const textPath = path.join(outDir, `receipt_review_${orderId}.txt`);

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    await fs.writeFile(
      textPath,
      outputs.map((t, i) => `#${i + 1}\n${t}\n`).join('\n'),
      'utf8',
    );

    console.log(`saved meta: ${metaPath}`);
    console.log(`saved text: ${textPath}`);
  } catch (e) {
    console.warn(`WARN: failed to save outputs artifact: ${String(e?.message || e)}`);
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exitCode = 1;
});
