// Mirainime — selector & endpoint mengikuti scraper milik user (mirainime.js)
const cheerio = require("cheerio");
const { http } = require("../http");
const N = require("../norm");
const BASE = "https://mirainime.com";
const abs = u => N.fixUrl(u, BASE);
const slugOf = s => { s = String(s).trim(); const m = s.match(/\/anime\/([\w-]+)/); return m ? m[1] : s.replace(/^\/+|\/+$/g, ""); };
const load = async p => cheerio.load(await http(BASE + p));
const XHR = ref => ({ "X-Requested-With": "XMLHttpRequest", Accept: "application/json", Referer: ref });

function grid($) {
  const out = [];
  $(".grid .ctx-card").each((_, el) => {
    const a = $(el).find("h2 a").first(), t = a.text().trim(), href = a.attr("href") || "";
    if (!t || !href) return;
    const meta = $(el).find(".border-t span").map((_, s) => $(s).text().trim()).get().filter(x => x && x !== "·");
    out.push({ id: slugOf(href), t, p: abs(N.imgSrc($(el).find("img").first())), sub: meta.slice(0, 3).join(" · ") });
  });
  if (!out.length) $("#all-anime-grid a.ctx-card").each((_, el) => {
    const t = $(el).find("h3").text().trim(), href = $(el).attr("href") || "";
    if (t && href) out.push({ id: slugOf(href), t, p: abs(N.imgSrc($(el).find("img").first())), r: $(el).find(".absolute span").text().trim().replace(/⭐\s*/, "") });
  });
  return out;
}
async function home(page = 1) { return { items: grid(await load(`/anime?page=${page}`)) }; }
async function search(q, page = 1) {
  const $ = await load(`/anime-list?${new URLSearchParams({ q, page })}`), items = [];
  $(".space-y-3 > div, div[data-bookmarked]").each((_, el) => {
    const a = $(el).find("h3 a").first(), t = a.text().trim(), href = a.attr("href") || "";
    if (t && href) items.push({ id: slugOf(href), t, p: abs(N.imgSrc($(el).find("img").first())), r: $(el).find(".text-xs.font-semibold").text().trim().replace(/⭐\s*/, ""), sub: $(el).find(".text-gray-400").first().text().trim() });
  });
  return { items };
}
async function epsFromDl(slug) {
  const hdr = XHR(`${BASE}/anime/${slug}/download`), page = p => http(`${BASE}/anime/${slug}/download?page=${p}&ajax=1`, { headers: hdr, json: true });
  try {
    const first = await page(1), all = [...(first.episodes || [])], last = Math.min(first.last_page || 1, 40);
    if (last > 1) (await Promise.all(Array.from({ length: last - 1 }, (_, i) => page(i + 2).then(j => j.episodes || []).catch(() => [])))).forEach(r => all.push(...r));
    return all.filter(e => e && e.num != null).map(e => ({ id: `${slug}:${e.num}`, n: String(e.num), t: `Episode ${e.num}` }));
  } catch (e) { return []; }
}
async function detail(id) {
  const slug = slugOf(id), $ = await load(`/anime/${slug}`);
  let schema = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const j = JSON.parse($(el).html()); const it = (j["@graph"] || []).find(g => g["@type"] === "TVSeries" || g["@type"] === "Movie"); if (it) schema = it; } catch (e) { /* skip */ }
  });
  const t = $("h1").first().text().trim() || (schema && schema.name) || slug;
  const p = abs(N.imgSrc($("img").filter((_, i) => $(i).attr("alt") === t).first()) || N.imgSrc($(".poster-skeleton + img").first()) || (schema && schema.image && schema.image[0]) || "");
  const g = [];
  $('a[href*="/genre/"]').each((_, el) => { const x = $(el).text().trim(); if (x && !g.includes(x)) g.push(x); });
  let r = $(".bg-purple-600\\/80").text().trim().replace(/⭐\s*/, "");
  if (!r) { const m = $("body").text().match(/⭐\s*([0-9.]+)/); if (m) r = m[1]; }
  const seen = new Set(), episodes = [];
  $('#episode-table-wrap a, a[href*="/episode/"]').each((_, el) => {
    const m = ($(el).attr("href") || "").match(/\/episode\/(\d+(?:\.\d+)?)/);
    if (m && !seen.has(m[1])) { seen.add(m[1]); episodes.push({ id: `${slug}:${m[1]}`, n: m[1], t: $(el).text().trim().replace(/\s+/g, " ") || `Episode ${m[1]}` }); }
  });
  const have = new Set(episodes.map(e => e.n));
  (await epsFromDl(slug)).forEach(e => { if (!have.has(e.n)) { have.add(e.n); episodes.push(e); } });
  if (!episodes.length) episodes.push({ id: `${slug}:1`, n: "1", t: "Tonton" });
  episodes.sort((a, b) => parseFloat(a.n) - parseFloat(b.n));
  return { id: slug, t, p, r, sy: $(".text-gray-300.leading-relaxed").first().text().trim() || (schema && schema.description) || "", g: g.length ? g : (schema && schema.genre) || [], info: {}, episodes };
}
async function episode(id) {
  const [slug, n] = String(id).split(":");
  const html = await http(`${BASE}/anime/${slug}/episode/${n}`, { headers: { Referer: BASE + "/" } });
  const streams = [];
  const m = html.match(/window\.b2PlayerOptions\s*=\s*(\{.+?\});/s);
  let title = "";
  if (m) try {
    const o = JSON.parse(m[1]); title = o.title || "";
    (o.gdriveSources || []).forEach(s => s.url && streams.push({ server: s.resolution || "Video", url: s.url, type: "video", size: s.size }));
  } catch (e) { /* lanjut ke iframe */ }
  if (!streams.length) cheerio.load(html)("iframe").each((i, el) => { const u = abs(cheerio.load(html)(el).attr("src")); if (u) streams.push({ server: `Server ${i + 1}`, url: u, type: "iframe" }); });
  return { t: title, streams, downloads: [], dlLazy: true };
}
async function download(id) {
  const [slug, n] = String(id).split(":"), hdr = XHR(`${BASE}/anime/${slug}/download`);
  let ep = null, last = 1;
  for (let p = 1; p <= last && p <= 40 && !ep; p++) {
    const j = await http(`${BASE}/anime/${slug}/download?page=${p}&ajax=1`, { headers: hdr, json: true });
    last = j.last_page || 1;
    ep = (j.episodes || []).find(e => parseInt(e.num, 10) === parseInt(n, 10));
  }
  if (!ep) return [];
  const out = await Promise.all((ep.resolutions || []).map(async r => {
    try {
      const d = await http(`${BASE}/download/url?${new URLSearchParams({ episode_id: ep.id, resolution: r.res })}`, { headers: hdr, json: true, ttl: 60000 });
      return { label: `${r.res}${r.size ? " · " + r.size : ""}`, url: d.url, alt: (d.alternates || []).map(a => a.url).filter(Boolean) };
    } catch (e) { return null; }
  }));
  return out.filter(x => x && x.url);
}
module.exports = { home, search, detail, episode, download };
