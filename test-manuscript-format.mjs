// E2E smoke test for manuscript formatting
// - Creates an order using local uploads
// - Submits as agency
// - Assigns persona + triggers generation as admin
// - Polls until GENERATED and validates formatting

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
const uploadsDir = path.join(__dirname, 'apps', 'api', 'uploads');

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

function pickUploadFiles(count = 15) {
  if (!fs.existsSync(uploadsDir)) throw new Error(`uploads dir not found: ${uploadsDir}`);
  const files = fs
    .readdirSync(uploadsDir)
    .map((name) => {
      const fullPath = path.join(uploadsDir, name);
      const st = fs.statSync(fullPath);
      return st.isFile() ? { name, fullPath, mtimeMs: st.mtimeMs, size: st.size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, count);

  if (files.length < count) throw new Error(`need ${count} upload images; got ${files.length}`);
  return files;
}

function escapePathSegment(s) {
  return encodeURIComponent(s).replace(/%2F/g, '/');
}

function buildOrderPayload(files) {
  const placeName = `TEST_CAFE_${crypto.randomUUID().slice(0, 8)}`;

  const photoUrls = files.map((f) => `${baseUrl}/uploads/${escapePathSegment(f.name)}`);
  const photoMetas = files.map((f, i) => {
    const url = photoUrls[i];
    const sizeKb = Math.max(1, Math.ceil(f.size / 1024));
    return { url, width: 1000, height: 1000, sizeKb };
  });

  return {
    place: { name: placeName, address: '서울 테스트구 테스트로 123' },
    guide: {
      searchKeywords: ['테스트카페', '원고검증'],
      includeText: '문장 단위 줄바꿈과 사진 블록 포맷을 검증합니다. 요. 습니다. 로 끝나는 문장도 줄바꿈되어야 합니다.',
      requiredKeywords: ['분위기', '메뉴', '추천'],
      emphasizeKeywords: ['재방문'],
      link: false,
      map: false,
      hashtag: true,
      hashtags: ['#테스트', '#원고', '#카페'],
    },
    referenceText: '참고 리뷰 텍스트입니다.',
    notes: '자동 E2E 포맷 테스트',
    targetChars: [1500, 2000],
    photoLimits: [15, 20],
    photos: photoUrls,
    photoMetas,
    saveAsDraft: false,
    submitCount: 1,
  };
}

function assertFormat(manuscript) {
  const normalized = String(manuscript || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const lastNonEmpty = [...lines].reverse().find((l) => l.trim().length > 0) || '';

  const hashtagLastLine = lastNonEmpty.trim().startsWith('해시태그:');
  const photoHeaderStandalone = !/^사진\s*\d+\S/m.test(normalized);
  const blankLineBetweenBlocks = /사진\s*\d+\s*\n[\s\S]*?\n\n사진\s*\d+\s*\n/.test(normalized);

  return { hashtagLastLine, photoHeaderStandalone, blankLineBetweenBlocks };
}

async function main() {
  console.log('=== 0) Pick 15 upload images ===');
  const files = pickUploadFiles(15);

  console.log('=== 1) Login as agency ===');
  const agencyToken = await login('agency1@test.com', 'agency123');

  console.log('=== 2) Create order ===');
  const payload = buildOrderPayload(files);
  const order = await httpJson(`${baseUrl}/orders`, { method: 'POST', token: agencyToken, body: payload });
  const orderId = order?.id;
  const orderStatus = order?.status;
  if (!orderId) throw new Error(`create order: missing id. response=${JSON.stringify(order)}`);
  console.log(`orderId=${orderId}`);

  console.log('=== 3) Submit order ===');
  if (orderStatus === 'DRAFT' || orderStatus === 'ADMIN_INTAKE') {
    await httpJson(`${baseUrl}/agency/orders/${orderId}/submit`, { method: 'POST', token: agencyToken });
  } else {
    console.log(`skip submit (status=${orderStatus ?? 'unknown'})`);
  }

  console.log('=== 4) Login as admin ===');
  const adminToken = await login('admin@test.com', 'admin123');

  console.log('=== 5) Assign persona + generate ===');
  await httpJson(`${baseUrl}/admin/orders/${orderId}/assign-persona`, {
    method: 'POST',
    token: adminToken,
    body: { personaId: 'default' },
  });
  await httpJson(`${baseUrl}/admin/orders/${orderId}/generate`, { method: 'POST', token: adminToken, body: {} });

  console.log('=== 6) Poll until manuscript is ready (max 360s) ===');
  const deadline = Date.now() + 360_000;
  let latest;
  while (Date.now() < deadline) {
    latest = await httpJson(`${baseUrl}/admin/orders/${orderId}`, { method: 'GET', token: adminToken });
    const status = latest?.order?.status;
    process.stdout.write(`status=${status}        \r`);
    if (status === 'FAILED') {
      process.stdout.write('\n');
      throw new Error(`generation failed; lastFailureReason=${latest?.order?.lastFailureReason ?? ''}`);
    }

    const okStatuses = new Set(['GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE']);
    if (okStatuses.has(status)) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write('\n');

  const finalStatus = latest?.order?.status ?? 'undefined';
  {
    const keys = latest && typeof latest === 'object' ? Object.keys(latest).join(',') : typeof latest;
    const okStatuses = new Set(['GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE']);
    if (!okStatuses.has(finalStatus)) {
      throw new Error(`not ready in time; status=${finalStatus} (responseKeys=${keys})`);
    }
  }

  const manuscript = String(latest?.order?.manuscript || '');
  if (!manuscript.trim()) throw new Error('manuscript is empty');

  console.log('=== 7) Validate format ===');
  const checks = assertFormat(manuscript);
  console.log(checks);

  console.log('=== Preview (first 40 lines) ===');
  manuscript
    .split(/\r\n|\n/)
    .slice(0, 40)
    .forEach((l) => console.log(l));

  if (!checks.hashtagLastLine || !checks.photoHeaderStandalone || !checks.blankLineBetweenBlocks) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exitCode = 1;
});
