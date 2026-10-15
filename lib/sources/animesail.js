// AnimeSail — logika mengikuti scraper milik user (animesail.js), versi fetch + cheerio
const cheerio = require("cheerio");
const { http } = require("../http");
const N = require("../norm");
const BASE = "https://v1.animesail.xyz";
const HDR = { Cookie: "_as_ipin_tz=Asia%2FJakarta; _as_ipin_lc=id-ID; _as_ipin_ct=ID", Referer: BASE + "/", Accept: "text/html,application/xhtml+xml,*/*;q=0.8" };
const norm = u => { u = String(u || "").trim(); return /^https?:/.test(u) ? u.replace(/^https?:\/\/(?:anisail\.com|animesail\.(?:xyz|net|tv|id))/i, BASE) : BASE + "/" + u.replace(/^\/+/, ""); };
const pth = u => { try { return new URL(norm(u)).pathname; } catch (e) { return ""; } };
const load = async p => cheerio.load(await http(norm(p), { headers: HDR }));
function cards($) {
  const out = [], seen = new Set();
  $(".bsx").each((_, el) => {
    const a = $(el).find("a").first(), href = a.attr("href") || "";
    const t = $(el).find(".tt h2, h2, h3").first().text().trim() || a.attr("title") || "";
    const img = N.imgSrc($(el).find("img").first());
    const type = $(el).find(".tt span").text().trim(), y = type.match(/\b(19\d\d|20\d\d)\b/);
    if (!t || !href || seen.has(href)) return;
    seen.add(href);
    out.push({ id: pth(href), t, p: img, sub: [/Movie|ONA|TV/.exec(type)?.[0], y && y[1]].filter(Boolean).join(" · ") });
  });
  return out;
}
const home = async (page = 1) => ({ items: cards(await load(page > 1 ? `/page/${page}/` : "/")) });
const search = async (q, page = 1) => ({ items: cards(await load(`/?s=${encodeURIComponent(q)}${page > 1 ? `&page=${page}` : ""}`)) });
async function downloadTable(path) {
  try {
    const $ = await load(path), out = [];
    $("table tr").each((_, tr) => {
      const q = $(tr).find("td").first().text().trim();
      $(tr).find("a[data-href]").each((_, a) => {
        const u = ($(a).attr("data-href") || "").trim();
        if (q && u && u !== "#/") out.push({ label: `${q} · ${$(a).text().trim() || $(a).attr("title") || "Link"}`, url: u });
      });
    });
    return out;
  } catch (e) { return []; }
}
async function episode(id) {
  const $ = await load(id), streams = [];
  const push = (server, html) => {
    try {
      const $e = cheerio.load(html), src = $e("iframe").attr("src") || "";
      if (!src) return;
      streams.push({ server: server || "Server", url: /^\/\//.test(src) ? "https:" + src : src, type: "iframe" });
      let direct = null;
      const u = src.match(/[?&]url=([^&]+)/), b = src.match(/[?&]bsrc=([^&]+)/);
      if (u) direct = decodeURIComponent(u[1]); else if (b) { try { direct = Buffer.from(b[1], "base64").toString("utf8"); } catch (e) { /* skip */ } }
      if (direct && /\.(mp4|m3u8)(\?|$)/i.test(direct)) streams.push({ server: `${server || "Server"} (direct)`, url: direct, type: "video" });
    } catch (e) { /* skip */ }
  };
  $("[data-em]").each((_, el) => { try { push($(el).text().trim(), Buffer.from($(el).attr("data-em") || "", "base64").toString("utf8")); } catch (e) { /* skip */ } });
  const def = $("#pembed").attr("data-default");
  if (def && !streams.length) try { push("Default", Buffer.from(def, "base64").toString("utf8")); } catch (e) { /* skip */ }
  const dl = $('a[href*="/streaming-download/?id="]').attr("href");
  const anime = $('.nvs a[href*="/anime/"]').attr("href") || $('a:contains("Semua Episode")').attr("href") || "";
  return { t: $("h1.entry-title, h1").first().text().trim(), streams, downloads: dl ? await downloadTable(dl) : [], anime: anime ? pth(anime) : "" };
}
async function detail(id) {
  if (!/\/anime\//.test(id)) { const e = await episode(id); if (!e.anime) throw new Error("Link anime tidak ditemukan"); id = e.anime; }
  const $ = await load(id), info = {};
  $("p, tr").each((_, el) => {
    const t = $(el).text().trim();
    if (t.includes(":") && t.length < 150) { const [k, ...v] = t.split(":"); if (k.trim() && v.join(":").trim()) info[k.trim()] = v.join(":").trim(); }
  });
  const g = [];
  $('a[href*="/genres/"]').each((_, a) => { const x = $(a).text().trim(); if (x && !g.includes(x)) g.push(x); });
  const episodes = [];
  $("ul.daftar li a").each((_, a) => {
    const t = $(a).text().trim(), m = t.match(/Episode\s+(\d+(?:\.\d+)?)/i);
    episodes.push({ id: pth($(a).attr("href") || ""), n: m ? m[1] : t, t });
  });
  episodes.sort((a, b) => (parseFloat(a.n) || 0) - (parseFloat(b.n) || 0));
  return { id, t: $("h1.entry-title").text().trim(), p: N.imgSrc($("img.wp-post-image, .thumb img").first()), sy: $(".entry-content p, .desc, .synopsis").first().text().trim(), g, info, r: info.Rating || "", episodes };
}
module.exports = { home, search, detail, episode };
