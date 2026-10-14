// Adapter REST API Sanka Vollerei: https://www.sankavollerei.web.id/anime/:source/...
// Pola endpoint: /:source/home, /search/:q, /detail/:slug, /episode/:id (+ fallback /watch, /stream)
// Bentuk JSON belum dijamin sama antar sumber, jadi parser bersifat adaptif (cari list/field otomatis).
const { http } = require("../http");
const BASE = process.env.SANKA_BASE || "https://www.sankavollerei.web.id/anime";
const HDR = { Accept: "application/json, text/plain, */*", Referer: "https://www.sankavollerei.web.id/", Origin: "https://www.sankavollerei.web.id" };
const SOURCES = ["samehadaku", "animekuindo", "kusonime", "nimegami", "oploverz", "winbu", "animasu", "alqanime", "animekompi", "kura"];
const TITLE = ["title", "name", "judul", "animeTitle", "episodeTitle"];
const URLK = ["url", "link", "embed", "iframe", "src", "stream", "streamUrl", "embedUrl", "defaultStreamingUrl"];
const str = v => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const first = (o, ks) => { for (const k of ks) { const v = str(o && o[k]); if (v) return v; } return ""; };
const lastSeg = u => str(u).split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();
const idOf = o => { const s = first(o, ["slug", "animeId", "episodeId", "id", "endpoint", "href", "link", "url"]); return s.includes("/") ? lastSeg(s) : s; };
const unwrap = j => (j && typeof j === "object" && !Array.isArray(j) ? (j.data ?? j.result ?? j.results ?? j) : j);
const isHttp = v => typeof v === "string" && /^https?:\/\//i.test(v);

function walk(o, path, fn, ctx = "", depth = 0) {
  if (depth > 7 || o == null || typeof o !== "object") return;
  if (Array.isArray(o)) return o.slice(0, 150).forEach(x => walk(x, path, fn, ctx, depth + 1));
  const tt = first(o, ["title", "name"]), c = first(o, ["quality", "resolution"]) || (/\b\d{3,4}p\b|4K/i.test(tt) ? tt : ctx);
  fn(o, path, c);
  for (const [k, v] of Object.entries(o)) if (v && typeof v === "object") walk(v, path + "/" + k, fn, c, depth + 1);
}
function lists(o) {
  const out = [];
  walk(o, "", (x, p) => { for (const [k, v] of Object.entries(x)) if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object") out.push({ k: p + "/" + k, a: v }); });
  if (Array.isArray(o) && o.length && o[0] && typeof o[0] === "object") out.push({ k: "root", a: o });
  return out;
}
const bestList = (o, test, re) => {
  const L = lists(o).filter(l => l.a.some(test));
  const pref = re ? L.filter(l => re.test(l.k)) : [];
  return ((pref.length ? pref : L).sort((a, b) => b.a.length - a.a.length)[0] || { a: [] }).a;
};
const card = x => ({
  id: idOf(x), t: first(x, TITLE),
  p: first(x, ["poster", "image", "img", "thumbnail", "thumb", "cover", "imageUrl"]),
  sub: [first(x, ["episode", "episodes", "latestEpisode", "eps"]), first(x, ["status", "type"])].filter(Boolean).slice(0, 2).join(" · "),
  r: first(x, ["score", "rating"]),
});
const toItems = d => {
  const seen = new Set();
  return bestList(d, x => first(x, TITLE) && idOf(x)).map(card).filter(x => x.id && x.t && !seen.has(x.id) && seen.add(x.id));
};
const names = a => (Array.isArray(a) ? a : []).map(x => (typeof x === "string" ? x.trim() : first(x, TITLE))).filter(Boolean);

function make(src) {
  const get = (p, ttl) => http(`${BASE}/${src}${p}`, { headers: HDR, json: true, ttl });
  const q = page => (page > 1 ? `?page=${page}` : "");
  return {
    raw: p => (/^\/[\w\-./%:?=&]*$/.test(p) && !p.includes("..") && !p.includes("//") ? http(`${BASE}/${src}${p}`, { headers: HDR, json: true, ttl: 30000 }) : Promise.reject(new Error("bad_path"))),
    home: async (page = 1) => ({ items: toItems(unwrap(await get(`/home${q(page)}`))) }),
    search: async (kw, page = 1) => ({ items: toItems(unwrap(await get(`/search/${encodeURIComponent(kw)}${q(page)}`))) }),
    async detail(id) {
      const d = unwrap(await get(`/detail/${encodeURIComponent(id)}`)) || {};
      const root = d.detail || d.anime || d;
      const syn = root.synopsis ?? root.sinopsis ?? root.description ?? "";
      const info = {};
      ["status", "type", "studio", "season", "released", "duration", "aired", "producer"].forEach(k => { const v = first(root, [k]); if (v) info[k[0].toUpperCase() + k.slice(1)] = v; });
      const genres = names(root.genres || root.genre || root.genreList);
      const eps = bestList(d, x => idOf(x) && (first(x, TITLE) || first(x, ["episode", "number", "eps"])), /episode|eps|chapter/i).map((x, i) => {
        const label = first(x, ["episode", "number", "episodeNumber", "eps"]) || first(x, TITLE);
        const n = (label.match(/\d+(?:\.\d+)?/) || [])[0] || String(i + 1);
        return { id: idOf(x), n, t: first(x, TITLE) || `Episode ${n}` };
      }).filter(e => e.id);
      if (eps.length > 1 && +eps[0].n > +eps[eps.length - 1].n) eps.reverse();
      return {
        id, t: first(root, TITLE), p: first(root, ["poster", "image", "img", "thumbnail", "cover", "imageUrl"]),
        sy: typeof syn === "string" ? syn.trim() : Array.isArray(syn) ? syn.join("\n\n") : Array.isArray(syn.paragraphs) ? syn.paragraphs.join("\n\n") : "",
        g: genres, info, r: first(root, ["score", "rating"]), episodes: eps,
      };
    },
    async episode(id) {
      let last = null;
      for (const base of ["episode", "watch", "stream"]) {
        try {
          const d = unwrap(await get(`/${base}/${encodeURIComponent(id)}`, 120000)), streams = [], downloads = [], pend = [], seen = new Set();
          const add = (server, u) => { if (isHttp(u) && !seen.has(u)) { seen.add(u); streams.push({ server: server || `Server ${streams.length + 1}`, url: u, type: /\.(mp4|m3u8)(\?|$)/i.test(u) ? "video" : "iframe" }); } };
          walk(d, "", (o, path, ctx) => {
            const dl = /download|unduh/i.test(path), name = first(o, ["name", "server", "title", "label", "quality"]);
            for (const k of URLK) {
              const v = o[k];
              if (!isHttp(v)) continue;
              if (dl) { if (!downloads.some(x => x.url === v)) downloads.push({ label: [ctx, first(o, ["host", "provider", "name", "title", "label"])].filter(Boolean).join(" · ") || "Download", url: v }); }
              else if (/server|stream|mirror|embed|video|player|source/i.test(path) || /stream|embed|iframe/i.test(k)) add(k === "defaultStreamingUrl" ? "Default" : name, v);
            }
            if (!dl && /server/i.test(path) && !URLK.some(k => isHttp(o[k]))) { const sid = first(o, ["serverId", "id", "sid"]); if (sid) pend.push({ name: [ctx, name].filter(Boolean).join(" "), sid }); }
          });
          await Promise.all(pend.slice(0, 5).map(async s => {
            try { walk(unwrap(await get(`/server/${encodeURIComponent(s.sid)}`, 120000)), "/server", o => URLK.forEach(k => add(s.name, o[k]))); } catch (e) { /* lewati */ }
          }));
          if (streams.length || downloads.length) return { t: first(d, TITLE), streams, downloads };
        } catch (e) { last = e; }
      }
      throw last || new Error("Stream tidak ditemukan");
    },
  };
}
module.exports = { SOURCES, make };
