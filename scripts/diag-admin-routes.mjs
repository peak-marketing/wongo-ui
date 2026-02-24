const urls = [
  'http://127.0.0.1:3001/admin/billing/ledger',
  'http://127.0.0.1:3001/admin/settlements/kpi',
  'http://127.0.0.1:3001/admin/settlements/agencies',
];

async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

for (const url of urls) {
  try {
    const res = await fetchWithTimeout(url);
    console.log(`${url} => ${res.status}`);

    // If we ever see 404 here, dump a small body snippet to confirm it's the old "Cannot GET" express 404.
    if (res.status === 404) {
      const text = await res.text();
      console.log(text.slice(0, 200));
    }
  } catch (err) {
    console.log(`${url} => ERROR: ${err?.message ?? String(err)}`);
  }
}
