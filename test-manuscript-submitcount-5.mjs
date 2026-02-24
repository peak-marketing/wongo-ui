// E2E verification for MANUSCRIPT submitCount=5
// Verifies:
// 1) /orders create once with submitCount=5 returns 5 ids
// 2) Postgres DB has 5 rows for those ids
// 3) /admin/orders list contains all 5 ids (source for admin intake UI)

import crypto from 'node:crypto';
import zlib from 'node:zlib';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

function crc32(buf) {
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
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const bytesPerPixel = 4;
  const rowLen = 1 + w * bytesPerPixel;
  const raw = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0;
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

async function uploadOnePng({ token, filename, buffer }) {
  const form = new FormData();
  form.append('files', new Blob([buffer], { type: 'image/png' }), filename);

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

function requireArrayOfUuids(value, count) {
  const ids = Array.isArray(value) ? value.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const bad = ids.find((id) => !uuidRe.test(id));
  if (bad) throw new Error(`invalid id format: ${bad}`);
  if (ids.length !== count) throw new Error(`expected ${count} ids, got ${ids.length}`);
  return ids;
}

async function main() {
  console.log(`baseUrl=${baseUrl}`);

  console.log('=== 1) Login as agency ===');
  const agencyToken = await login('agency1@test.com', 'agency123');

  const placeName = `TEST_SUBMITCOUNT5_${crypto.randomUUID().slice(0, 8)}`;
  const submitCount = 5;

  console.log('=== 1.5) Upload 5 photos (/uploads) ===');
  const photos = [];
  for (let i = 0; i < 5; i++) {
    const buf = makeSolidPng({ width: 256, height: 256, r: 230, g: 230, b: 230, a: 255 });
    const filename = `submitcount5_${placeName}_${i + 1}.png`;
    const url = await uploadOnePng({ token: agencyToken, filename, buffer: buf });
    photos.push(url);
  }
  console.log(`photosCount=${photos.length}`);

  console.log('=== 2) Create manuscript order (submitCount=5) ===');
  const created = await httpJson(`${baseUrl}/orders`, {
    method: 'POST',
    token: agencyToken,
    body: {
      place: {
        name: placeName,
        address: '테스트주소',
        mapLink: 'https://map.example.com/test',
      },
      guide: {
        searchKeywords: ['테스트키워드1', '테스트키워드2'],
        includeText: '테스트 includeText',
        requiredKeywords: ['필수키워드A'],
        emphasizeKeywords: ['강조키워드B'],
        link: false,
        map: false,
        hashtag: false,
        hashtags: [],
      },
      referenceText: '테스트 referenceText',
      notes: 'E2E submitCount=5',
      photos,
      photoLimits: [5, 20],
      saveAsDraft: false,
      submitCount,
    },
  });

  const ids = requireArrayOfUuids(created?.ids, submitCount);
  console.log(`OK: created.ids length=${ids.length}`);
  console.log(`placeName=${placeName}`);

  console.log('=== 3) Login as admin ===');
  const adminToken = await login('admin@test.com', 'admin123');

  console.log('=== 4) Check /admin/orders contains all ids ===');
  const adminOrders = await httpJson(`${baseUrl}/admin/orders`, { method: 'GET', token: adminToken });
  const list = Array.isArray(adminOrders) ? adminOrders : Array.isArray(adminOrders?.items) ? adminOrders.items : [];
  const set = new Set(list.map((o) => String(o?.id || '')));
  const missing = ids.filter((id) => !set.has(id));
  if (missing.length > 0) {
    throw new Error(`admin list missing ${missing.length} orders: ${missing.join(', ')}`);
  }
  console.log('OK: all 5 ids present in /admin/orders list');

  // Print the ids for DB verification step (docker exec psql)
  console.log('=== IDS (for DB verify) ===');
  for (const id of ids) console.log(id);
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exitCode = 1;
});
