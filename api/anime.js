const sanka = require("../lib/sources/sanka");
const N = require("../lib/norm");
const BASES = { mirainime: "https://mirainime.com", animeindo: "https://ww2.animeindo.pro", animesail: "https://v1.animesail.xyz" };
const SRC = { mirainime: require("../lib/sources/mirainime"), animeindo: require("../lib/sources/animeindo"), animesail: require("../lib/sources/animesail") };
const META = [["mirainime", "Mirainime", "scraper"], ["animeindo", "AnimeIndo", "scraper"], ["animesail", "AnimeSail", "scraper"]];
sanka.SOURCES.forEach(n => { SRC[n] = sanka.make(n); META.push([n, n[0].toUpperCase() + n.slice(1), "api"]); });
module.exports = async (req, res) => {
  const q = req.query || {}, act = q.action || "home", s = SRC[q.src || "mirainime"];
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  const ok = b => res.status(200).json(b), bad = (c, e) => res.status(c).json({ error: e });
  if (act === "sources") return ok({ sources: META.map(([id, name, type]) => ({ id, name, type })) });
  if (!s) return bad(400, "bad_source");
  const id = String(q.id || ""), page = Math.min(Math.max(+q.page || 1, 1), 100);
  const idOk = /^[\w\-./:%]+$/.test(id) && !id.includes("..") && !id.includes("//");
  try {
    if (act === "raw") return s.raw ? ok(await s.raw(String(q.path || ""))) : bad(400, "no_raw");
    const base = BASES[q.src || "mirainime"] || "https://www.sankavollerei.web.id";
    if (act === "home") return ok({ items: N.items((await s.home(page)).items, base) });
    if (act === "search") return q.q ? ok({ items: N.items((await s.search(String(q.q).slice(0, 100), page)).items, base) }) : ok({ items: [] });
    if (!idOk) return bad(400, "bad_id");
    if (act === "detail") return ok(N.detail(await s.detail(id), base));
    if (act === "episode") return ok(N.episode(await s.episode(id), base));
    if (act === "download" && s.download) return ok({ downloads: N.downloads(await s.download(id), base) });
    return bad(400, "unknown_action");
  } catch (e) {
    return res.status(e.status === 404 ? 404 : 502).json({ error: "upstream", status: e.status || 0, message: String(e.message) });
  }
};
