// E2E: use local folder images + guide.txt to generate manuscript
// - Upload images to /uploads as agency
// - Create order based on guide
// - Trigger generation as admin
// - Save final manuscript to output file

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('1');
const guidePath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(inputDir, '가이드.txt');

async function httpRaw(url, { method = 'GET', token, headers, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body,
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

async function httpJson(url, { method = 'GET', token, body } = {}) {
  return httpRaw(url, {
    method,
    token,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function login(email, password) {
  const data = await httpJson(`${baseUrl}/auth/login`, { method: 'POST', body: { email, password } });
  if (!data?.accessToken) throw new Error('login: accessToken missing');
  return data.accessToken;
}

function listImages(dir) {
  if (!fs.existsSync(dir)) throw new Error(`inputDir not found: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((n) => /\.(jpg|jpeg|png|webp)$/i.test(n))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const st = fs.statSync(fullPath);
      return st.isFile() ? { name, fullPath, size: st.size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      // natural sort by number prefix if present
      const na = Number(String(a.name).match(/^\d+/)?.[0] || 0);
      const nb = Number(String(b.name).match(/^\d+/)?.[0] || 0);
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name);
    });

  if (files.length === 0) throw new Error(`no image files in ${dir}`);
  return files;
}

function parseGuide(txt) {
  const t = String(txt || '').replace(/\r\n?/g, '\n');

  const pickAfter = (label) => {
    const re = new RegExp(`${label}\\s*-\\s*([^\n]*)`, 'i');
    const m = t.match(re);
    return m?.[1]?.trim() || '';
  };

  const placeName = pickAfter('업체명');
  const placeAddress = pickAfter('업체주소');

  // search keywords: take all lines after '검색키워드 -' until blank line
  const searchKeywords = (() => {
    const lines = t.split('\n');
    const start = lines.findIndex((l) => /검색키워드\s*-/.test(l));
    if (start < 0) return [];
    const first = lines[start].replace(/.*검색키워드\s*-\s*/i, '').trim();
    const rest = [];
    for (let i = start + 1; i < lines.length; i++) {
      const s = lines[i].trim();
      if (!s) break;
      if (/업체명\s*-|업체주소\s*-|원고에 들어갈 내용\s*-|필수\/강조 내용\s*-|본문에 포함할 링크|네이버 지도 삽입|해시태그작성|동영상/i.test(s)) break;
      rest.push(s);
    }
    // 원본 입력은 문장/구문 단위가 아니어서 공백으로 쪼개면 의미가 깨질 수 있어,
    // 줄 단위로만 키워드를 유지한다.
    return [first, ...rest].map((s) => s.trim()).filter(Boolean);
  })();

  // includeText: bullet lines under '원고에 들어갈 내용 -'
  const includeText = (() => {
    const lines = t.split('\n');
    const start = lines.findIndex((l) => /원고에 들어갈 내용\s*-/.test(l));
    if (start < 0) return '';
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      const s = lines[i].trim();
      if (!s) break;
      if (/필수\/강조 내용\s*-|본문에 포함할 링크|네이버 지도 삽입|해시태그작성|동영상/i.test(s)) break;
      out.push(s);
    }
    return out.join(' ');
  })();

  const linkUrl = (() => {
    const m = t.match(/https?:\/\/[^\s)]+/i);
    return m?.[0]?.trim() || '';
  })();

  const hasMap = /네이버\s*지도\s*삽입\(O\s*\/\s*X\)\s*-\s*O/i.test(t);

  const rawHashBlock = (() => {
    const idx = t.split('\n').findIndex((l) => /해시태그작성\(O\s*\/\s*X\)/i.test(l));
    if (idx < 0) return '';
    const lines = t.split('\n').slice(idx + 1);
    const out = [];
    for (const l of lines) {
      const s = l.trim();
      if (!s) break;
      if (/동영상|원고\s*\d+개당\s*사진/i.test(s)) break;
      if (/^\[\s*최대\s*\d+\s*개\s*\]$/i.test(s)) continue;
      out.push(s);
    }
    return out.join(' ');
  })();

  const hashtags = rawHashBlock
    .replace(/\[\s*최대\s*\d+\s*개\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .split(/\/|,|\|/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => `#${s}`);

  return {
    placeName,
    placeAddress,
    searchKeywords,
    includeText,
    linkUrl,
    hasLink: Boolean(linkUrl),
    hasMap,
    hashtags,
    guideRaw: t.trim(),
  };
}

async function uploadImages(files, token) {
  const form = new FormData();
  for (const f of files) {
    const buf = fs.readFileSync(f.fullPath);
    const blob = new Blob([buf]);
    form.append('files', blob, f.name);
  }
  const data = await httpRaw(`${baseUrl}/uploads`, { method: 'POST', token, body: form });
  const urls = Array.isArray(data?.urls) ? data.urls : [];
  if (urls.length !== files.length) {
    throw new Error(`upload mismatch: files=${files.length} urls=${urls.length}`);
  }
  return urls;
}

function buildOrderPayload({ guide, photoUrls, photoFiles }) {
  const placeName = guide.placeName || `TEST_PLACE_${crypto.randomUUID().slice(0, 8)}`;

  const photoMetas = photoFiles.map((f, i) => {
    const sizeKb = Math.max(1, Math.ceil(f.size / 1024));
    return { url: photoUrls[i], width: 1000, height: 1000, sizeKb };
  });

  const includeText = [
    guide.includeText ? `원고에 들어갈 내용: ${guide.includeText}` : '',
    // 백엔드 워커가 linkUrl을 guideContent/notes 등에서 추출하므로,
    // hasLink=true일 때는 URL을 반드시 텍스트로 포함시켜준다.
    guide.hasLink && guide.linkUrl ? `링크: ${guide.linkUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    place: { name: placeName, address: guide.placeAddress || '' },
    guide: {
      searchKeywords: guide.searchKeywords.length ? guide.searchKeywords : [],
      includeText,
      requiredKeywords: [],
      emphasizeKeywords: [],
      link: guide.hasLink,
      map: guide.hasMap,
      hashtag: true,
      hashtags: guide.hashtags,
    },
    referenceText: '',
    notes: `E2E 폴더 가이드 테스트: ${path.basename(inputDir)}`,
    targetChars: [1500, 2000],
    photoLimits: [photoUrls.length, photoUrls.length],
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
  // Violation examples:
  // - "사진 1도심 한복판" (no space)
  // - "사진 1 도심 한복판" (same line)
  // Header must be exactly "사진 N" on its own line.
  const photoHeaderStandalone = !/^사진\s*\d+(?!\s*$)/m.test(normalized);
  const blankLineBetweenBlocks = /사진\s*\d+\s*\n[\s\S]*?\n\n사진\s*\d+\s*\n/.test(normalized);

  return { hashtagLastLine, photoHeaderStandalone, blankLineBetweenBlocks };
}

async function main() {
  console.log(`=== Input dir: ${inputDir} ===`);
  if (!fs.existsSync(guidePath)) throw new Error(`guide file not found: ${guidePath}`);

  // quick health check
  await httpJson(`${baseUrl}/health`, { method: 'GET' });

  const guideText = fs.readFileSync(guidePath, 'utf8');
  const guide = parseGuide(guideText);
  console.log('=== Guide parsed ===');
  console.log({
    placeName: guide.placeName,
    placeAddress: guide.placeAddress,
    searchKeywordsCount: guide.searchKeywords.length,
    hasLink: guide.hasLink,
    hasMap: guide.hasMap,
    hashtags: guide.hashtags,
  });

  const photoFiles = listImages(inputDir);
  console.log(`=== Found ${photoFiles.length} images ===`);

  console.log('=== 1) Login as agency ===');
  const agencyToken = await login('agency1@test.com', 'agency123');

  console.log('=== 2) Upload images (/uploads) ===');
  const photoUrls = await uploadImages(photoFiles, agencyToken);

  console.log('=== 3) Create order (/orders) ===');
  const payload = buildOrderPayload({ guide, photoUrls, photoFiles });
  const order = await httpJson(`${baseUrl}/orders`, { method: 'POST', token: agencyToken, body: payload });
  const orderId = order?.id;
  const orderStatus = order?.status;
  if (!orderId) throw new Error(`create order: missing id. response=${JSON.stringify(order)}`);
  console.log(`orderId=${orderId} status=${orderStatus}`);

  console.log('=== 4) Login as admin ===');
  const adminToken = await login('admin@test.com', 'admin123');

  console.log('=== 5) Assign persona + generate ===');
  await httpJson(`${baseUrl}/admin/orders/${orderId}/assign-persona`, {
    method: 'POST',
    token: adminToken,
    body: { personaId: 'default' },
  });
  await httpJson(`${baseUrl}/admin/orders/${orderId}/generate`, { method: 'POST', token: adminToken, body: {} });

  console.log('=== 6) Poll until manuscript is ready (max 600s) ===');
  const deadline = Date.now() + 600_000;
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
  const okStatuses = new Set(['GENERATED', 'ADMIN_REVIEW', 'AGENCY_REVIEW', 'COMPLETE']);
  if (!okStatuses.has(finalStatus)) throw new Error(`not ready in time; status=${finalStatus}`);

  const manuscript = String(latest?.order?.manuscript || '');
  if (!manuscript.trim()) throw new Error('manuscript is empty');

  console.log('=== 7) Validate format ===');
  const checks = assertFormat(manuscript);
  console.log(checks);

  const outDir = path.resolve('outputs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `manuscript_${orderId}.txt`);
  fs.writeFileSync(outPath, manuscript, 'utf8');

  const metaPath = path.join(outDir, `manuscript_${orderId}.meta.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        orderId,
        finalStatus,
        guide: {
          placeName: guide.placeName,
          placeAddress: guide.placeAddress,
          hasLink: guide.hasLink,
          hasMap: guide.hasMap,
          hashtags: guide.hashtags,
          searchKeywords: guide.searchKeywords,
        },
        photoCount: photoUrls.length,
        photoUrls,
        checks,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`=== DONE ===`);
  console.log(`saved: ${outPath}`);
  console.log(`meta:  ${metaPath}`);
  console.log('=== Preview (first 30 lines) ===');
  manuscript
    .split(/\r\n|\n/)
    .slice(0, 30)
    .forEach((l) => console.log(l));
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exitCode = 1;
});
