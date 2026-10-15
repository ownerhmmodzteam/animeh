// AnimeIndo — logika mengikuti scraper milik user (animeindo-scrape), versi cheerio
const cheerio = require("cheerio");
const { http } = require("../http");
const N = require("../norm");
const BASE = "https://ww2.animeindo.pro";
const HOSTS = /(mediafire|drive\.google|pixeldrain|mega\.nz|racaty|krakenfiles|gofile|terabox|zippyshare|acefile|userscloud|sfile|buzzheavier|send\.cm|1fichier|dropbox|files\.fm|filedon|doodstream|streamtape|mp4upload)/i;
const SKIP = /(whatsapp|facebook|twitter|instagram|telegram|t\.me|histats|wp-json|\/feed)/i;
const abs = u => { try { return u ? new URL(String(u).trim(), BASE).href : ""; } catch (e) { return ""; } };
const pth = u => { try { return new URL(u, BASE).pathname; } catch (e) { return ""; } };
const clean = s => (s || "").replace(/\s+/g, " ").trim();
const load = async p => cheerio.load(await http(BASE + p, { headers: { Referer: BASE + "/" } }));
const epNum = u => { const m = (u || "").match(/episode-(\d+(?:\.\d+)?)/i); return m ? +m[1] : 0; };
function unb64(v) {
  try {
    if (/^[A-Za-z0-9+/=]{20,}$/.test(v)) {
      const d = Buffer.from(v, "base64").toString("utf8"), s = d.match(/src=["']([^"']+)/i);
      if (s) return abs(s[1]);
      if (/^https?:\/\//i.test(d)) return d;
    }
  } catch (e) { /* bukan base64 */ }
  return v;
}
function cards($) {
  const out = [], seen = new Set();
  $("a.ai-card").each((_, a) => {
    const href = abs($(a).attr("href"));
    if (!href || seen.has(href)) return;
    seen.add(href);
    const img = $(a).find("img").first(), pick = c => clean($(a).find(`span.${c}`).first().text());
    const t = pick("t") || img.attr("alt") || "";
    if (t) out.push({ id: pth(href), t, p: abs(N.imgSrc(img)), sub: [pick("ep"), pick("m")].filter(Boolean).join(" · "), r: pick("rate") });
  });
  return out;
}
const home = async (page = 1) => ({ items: cards(await load(page > 1 ? `/page/${page}/` : "/")) });
const search = async (q, page = 1) => ({ items: cards(await load(`/?s=${encodeURIComponent(q)}${page > 1 ? `&paged=${page}` : ""}`)) });
async function watch(id) {
  const $ = await load(id), root = $(".ai-player").length ? $(".ai-player") : $("body"), streams = [];
  const add = (server, v, type) => { const u = N.embedUrl(v, BASE); if (u && !streams.some(s => s.url === u)) streams.push({ server, url: u, type }); };
  root.find("iframe").each((i, el) => add(`Server ${i + 1}`, abs($(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src")), "iframe"));
  $("[data-src],[data-embed],[data-url],[data-video],[data-iframe],[data-server]").each((_, el) => {
    if (/^(img|iframe|script|link)$/i.test(el.name)) return;
    const v = ["data-src", "data-embed", "data-url", "data-video", "data-iframe", "data-server"].map(k => $(el).attr(k)).find(Boolean);
    if (!/\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(v || "")) add(clean($(el).text()) || "Server", v, "iframe");
  });
  const downloads = [];
  $("a[href]").each((_, a) => {
    const href = abs($(a).attr("href")), label = clean($(a).text()) || $(a).attr("title") || "";
    if (!href || SKIP.test(href) || downloads.some(d => d.url === href)) return;
    if (!(/download|unduh|\bdl\b|mirror/i.test(label + " " + ($(a).attr("class") || "")) || HOSTS.test(href))) return;
    if (href.startsWith(BASE) && !HOSTS.test(href) && /\/(anime|genre|nonton|page)\//.test(href)) return;
    downloads.push({ label: label || new URL(href).host, url: href });
  });
  const anime = $("a[href]").toArray().map(a => abs($(a).attr("href"))).find(h => /\/anime\/[^/]+\/?$/.test(h)) || "";
  return { t: clean($("h1").first().text()), streams, downloads, anime };
}
async function detail(id) {
  if (/\/nonton\//.test(id)) { const w = await watch(id); if (!w.anime) throw new Error("Link anime tidak ditemukan"); id = pth(w.anime); }
  const $ = await load(id), main = $(".ai-det").length ? $(".ai-det") : $("body"), info = {};
  $(".ai-facts li, .ai-facts div, .ai-facts p, .ai-facts tr").each((_, el) => {
    const t = clean($(el).text()), i = t.indexOf(":");
    if (i > 0 && i < 30 && !(t.slice(0, i).trim() in info)) info[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
  const g = [];
  main.find('a[href*="/genre/"]').each((_, a) => { const x = clean($(a).text()); if (x && !g.includes(x)) g.push(x); });
  let list = $(".ai-eplist a[href]").toArray();
  if (!list.length) list = $('a[href*="/nonton/"]').toArray();
  const seen = new Set(), episodes = [];
  list.forEach(a => {
    const u = abs($(a).attr("href"));
    if (!u || seen.has(u)) return;
    seen.add(u);
    const t = clean($(a).text()) || $(a).attr("title") || "";
    episodes.push({ id: pth(u), n: (t.match(/(\d+(?:\.\d+)?)/) || [])[1] || t, t, _k: epNum(u) });
  });
  episodes.sort((a, b) => a._k - b._k).forEach(e => delete e._k);
  return {
    id, t: clean($("h1").first().text()) || clean($("title").text()),
    p: abs(N.imgSrc($(".ai-det-poster img").first()) || $('meta[property="og:image"]').attr("content")),
    sy: clean($(".ai-syn").text()) || $('meta[name="description"]').attr("content") || "", g, info, r: info.Rating || info.Skor || "", episodes,
  };
}
const episode = async id => { const w = await watch(id); return { t: w.t, streams: w.streams, downloads: w.downloads }; };
module.exports = { home, search, detail, episode };
