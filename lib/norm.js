// Normalisasi data semua sumber: URL, iframe (URL / HTML / ter-escape / base64), judul, episode, stream.
const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

function fixUrl(u, base) {
  u = clean(u);
  if (!u || /^(data:|javascript:|blob:|about:)/i.test(u)) return "";
  try {
    const x = new URL(u.startsWith("//") ? "https:" + u : u, base || undefined);
    if (!/^https?:$/.test(x.protocol)) return "";
    if (x.protocol === "http:") x.protocol = "https:"; // hindari mixed-content di halaman https
    return x.href;
  } catch (e) { return ""; }
}
// ambil URL dari: URL polos, //host/x, <iframe src>, HTML ter-escape (&lt;iframe), JSON-escaped, atau base64 dari semuanya
function embedUrl(v, base) {
  let s = clean(v);
  if (!s) return "";
  for (let i = 0; i < 2; i++) {
    if (/^[A-Za-z0-9+/=_-]{24,}$/.test(s)) {
      try {
        const d = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8").trim();
        if (/^(<|https?:|\/\/)/i.test(d)) s = d;
      } catch (e) { /* bukan base64 */ }
    }
    s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").replace(/\\\//g, "/").replace(/\\"/g, '"');
  }
  if (base && /^\/[^/]/.test(s)) return fixUrl(s, base);
  const m = s.match(/<(?:iframe|embed|video|source)\b[^>]*?\b(?:src|data-src|data-lazy-src)\s*=\s*["']?([^"'\s>]+)/i) || s.match(/https?:\/\/[^\s"'<>\\]+/i) || s.match(/^\/\/[^\s"'<>\\]+/);
  return m ? fixUrl(m[1] || m[0], base) : "";
}
function tidy(u) {
  let m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = u.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : u;
}
const kind = u => (/\.m3u8(\?|#|$)/i.test(u) ? "hls" : /\.(mp4|m4v|webm|ogv)(\?|#|$)/i.test(u) ? "video" : "iframe");
const imgSrc = el => {
  const v = ["data-src", "data-lazy-src", "data-original", "src"].map(k => el.attr(k)).find(x => x && !/^data:/i.test(x));
  return v || clean(el.attr("srcset")).split(",")[0].trim().split(" ")[0] || "";
};
const cleanTitle = t => clean(t).replace(/\s*[-–|:]?\s*(?:Subtitle\s+Indonesia|Sub\s+Indo(?:nesia)?|Subtitle\s+Indo)\s*$/i, "").trim();
// nomor episode: prioritaskan kata "episode/eps/ep", kalau tidak ada ambil angka terakhir
function epNo(label, i) {
  const s = clean(label);
  const m = s.match(/(?:episode|eps?|e)\s*[-.:#]?\s*(\d+(?:\.\d+)?)/i) || s.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
  return m ? m[1] : String(i + 1);
}
const rating = r => { const x = clean(r).replace(/[★⭐]/g, "").trim(); return /^\d+(\.\d+)?$/.test(x) ? x : ""; };

function items(arr, base) {
  const seen = new Set();
  return (arr || []).map(x => ({ id: clean(x.id), t: cleanTitle(x.t), p: fixUrl(x.p, base), sub: clean(x.sub).slice(0, 60), r: rating(x.r) }))
    .filter(x => x.id && x.t && !seen.has(x.id) && seen.add(x.id));
}
function episodes(arr) {
  const seen = new Set();
  const out = (arr || []).map((e, i) => { const n = epNo(e.n || e.t, i); return { id: clean(e.id), n, t: clean(e.t) || `Episode ${n}` }; })
    .filter(e => e.id && !seen.has(e.id) && seen.add(e.id));
  const nums = out.map(e => parseFloat(e.n));
  if (nums.length > 1 && nums.every(n => !isNaN(n)) && nums.some((n, i) => i && n < nums[i - 1])) out.sort((a, b) => parseFloat(a.n) - parseFloat(b.n));
  return out;
}
function detail(d, base) {
  const info = {};
  Object.entries(d.info || {}).forEach(([k, v]) => { const x = clean(v); if (x && x.length < 80) info[clean(k)] = x; });
  return {
    id: clean(d.id), t: cleanTitle(d.t), p: fixUrl(d.p, base), r: rating(d.r || d.rating),
    sy: clean(String(d.sy || "").replace(/<[^>]+>/g, " ")), g: [...new Set((d.g || []).map(clean).filter(Boolean))].slice(0, 12),
    info, episodes: episodes(d.episodes),
  };
}
function streams(arr, base) {
  const seen = new Set();
  return (arr || []).map(s => {
    let url = s.type === "video" ? fixUrl(s.url, base) : embedUrl(s.url, base);
    if (!url) return null;
    url = tidy(url);
    const k = kind(url), type = k === "iframe" && s.type === "video" ? "video" : k;
    return { server: clean(s.server) || "Server", url, type, size: s.size ? clean(s.size) : undefined };
  }).filter(s => s && !seen.has(s.url) && seen.add(s.url));
}
const downloads = (arr, base) => {
  const seen = new Set();
  return (arr || []).map(x => ({ label: clean(x.label) || "Download", url: fixUrl(x.url, base), alt: (x.alt || []).map(a => fixUrl(a, base)).filter(Boolean) }))
    .filter(x => x.url && !seen.has(x.url) && seen.add(x.url));
};
const episode = (r, base) => ({ t: clean(r.t), streams: streams(r.streams, base), downloads: downloads(r.downloads, base), dlLazy: !!r.dlLazy });

module.exports = { clean, fixUrl, embedUrl, tidy, kind, imgSrc, cleanTitle, epNo, items, episodes, detail, streams, downloads, episode };
