// fetch + cache + retry, dipakai semua sumber
const cache = new Map();
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
async function http(url, o = {}) {
  const key = url + (o.json ? "#j" : "");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < (o.ttl ?? 300000)) return hit.v;
  let err;
  for (let i = 0; i <= (o.retries ?? 1); i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8", ...(o.headers || {}) },
        signal: AbortSignal.timeout(o.timeout || 15000), redirect: "follow",
      });
      if (!r.ok) { err = Object.assign(new Error(`HTTP ${r.status} ${url}`), { status: r.status }); if (r.status < 500 && r.status !== 429) break; continue; }
      const v = o.json ? await r.json() : await r.text();
      if (cache.size > 300) cache.clear();
      cache.set(key, { t: Date.now(), v });
      return v;
    } catch (e) { err = e; }
  }
  throw err;
}
module.exports = { http, UA };
