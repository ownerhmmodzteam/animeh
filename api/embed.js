// Mode proxy untuk iframe yang diblokir (X-Frame-Options / CSP frame-ancestors) atau butuh Referer sumber.
// Mengambil HTML player, menyisipkan <base>, lalu menyajikannya TANPA header pemblokir iframe.
// Dikurung dengan CSP sandbox (origin terisolasi, tanpa popup & tanpa navigasi top).
const dns = require("dns").promises, net = require("net");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const priv = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(10|127|192\.168|169\.254)\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);
async function safe(u) {
  if (!/^https?:$/.test(u.protocol) || /^localhost$|\.(local|internal|localhost)$/i.test(u.hostname)) return false;
  const ips = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  return ips.length > 0 && !ips.some(i => priv(i.address));
}
module.exports = async (req, res) => {
  let u;
  try { u = new URL((req.query || {}).u); } catch (e) { return res.status(400).end(); }
  const ref = (req.query || {}).r;
  try {
    let r;
    for (let hop = 0; hop < 4; hop++) {
      if (!(await safe(u))) return res.status(403).end();
      r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(12000), headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8", "Accept-Language": "id,en;q=0.8", Referer: ref && /^https?:\/\//.test(ref) ? ref : u.origin + "/" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = new URL(r.headers.get("location"), u); continue; }
      break;
    }
    if (!r || !r.ok) return res.status(502).end();
    if (!/text\/html|application\/xhtml/i.test(r.headers.get("content-type") || "")) return res.status(415).end();
    let html = (await r.text()).slice(0, 2000000);
    const inj = `<base href="${u.href.replace(/"/g, "&quot;")}"><meta name="referrer" content="no-referrer">`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + inj) : inj + html;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-presentation");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.status(200).end(html);
  } catch (e) { res.status(502).end(); }
};
