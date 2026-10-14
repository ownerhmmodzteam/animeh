const SRC = { mirainime: require("../lib/sources/mirainime"), animeindo: require("../lib/sources/animeindo"), animesail: require("../lib/sources/animesail") };
const META = [["mirainime", "Mirainime"], ["animeindo", "AnimeIndo"], ["animesail", "AnimeSail"]];
module.exports = async (req, res) => {
  const q = req.query || {}, act = q.action || "home", s = SRC[q.src || "mirainime"];
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  const ok = b => res.status(200).json(b), bad = (c, e) => res.status(c).json({ error: e });
  if (act === "sources") return ok({ sources: META.map(([id, name]) => ({ id, name })) });
  if (!s) return bad(400, "bad_source");
  const id = String(q.id || ""), page = Math.min(Math.max(+q.page || 1, 1), 100);
  const idOk = /^[\w\-./:%]+$/.test(id) && !id.includes("..") && !id.includes("//");
  try {
    if (act === "home") return ok(await s.home(page));
    if (act === "search") return q.q ? ok(await s.search(String(q.q).slice(0, 100), page)) : ok({ items: [] });
    if (!idOk) return bad(400, "bad_id");
    if (act === "detail") return ok(await s.detail(id));
    if (act === "episode") return ok(await s.episode(id));
    if (act === "download" && s.download) return ok({ downloads: await s.download(id) });
    return bad(400, "unknown_action");
  } catch (e) {
    return res.status(e.status === 404 ? 404 : 502).json({ error: "upstream", status: e.status || 0, message: String(e.message) });
  }
};
