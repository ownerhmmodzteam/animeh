const https = require("https");
const OK = ["mirainime.com", "animeindo.pro", "animesail.xyz", "anisail.com", "wp.com"];
module.exports = (req, res, depth = 0) => {
  let u;
  try { u = new URL((req.query || {}).u); } catch (e) { return res.status(400).end(); }
  if (u.protocol !== "https:" || !OK.some(h => u.hostname === h || u.hostname.endsWith("." + h))) return res.status(403).end();
  https.get(u, { headers: { "User-Agent": "Mozilla/5.0", Referer: u.origin + "/" } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && depth < 2) {
      r.resume();
      return module.exports({ query: { u: new URL(r.headers.location, u).href } }, res, depth + 1);
    }
    if (r.statusCode !== 200 || !/^image\//.test(r.headers["content-type"] || "")) { r.resume(); return res.status(404).end(); }
    res.setHeader("Content-Type", r.headers["content-type"]);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, immutable");
    r.pipe(res);
  }).on("error", () => res.status(502).end());
};
