'use strict';
const { search: miraiSearch, list: miraiList, detail: miraiDetail, stream: miraiStream } = require('../scrapers/mirainime');
const sail = require('../scrapers/animesail');
const indo = require('../scrapers/animeindo-scrape-muxs37rp');

const SANKA = (process.env.SANKA_API_BASE || 'https://www.sankavollerei.web.id').replace(/\/$/, '');
const SOURCES = (process.env.ANIME_SOURCES || 'samehadaku,animekuindo,kusonime,nimegami,oploverz,winbu,animasu,alqanime,animekompi,kura').split(',').map(s => s.trim()).filter(Boolean);
const CACHE_MS = Math.max(30_000, Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000));
// Per-instance cache helps warm serverless instances; Vercel CDN headers provide shared response caching.
const cache = new Map();
function cached(key) { const v = cache.get(key); return v && v.expires > Date.now() ? v.value : null; }
function setCache(key, value, ttl = CACHE_MS) { cache.set(key, { value, expires: Date.now() + ttl }); }
function unwrap(v) { for (let i = 0; i < 6 && v && !Array.isArray(v) && typeof v === 'object'; i++) { if (v.data !== undefined) { v = v.data; continue; } if (v.result !== undefined) { v = v.result; continue; } if (v.response !== undefined) { v = v.response; continue; } break; } return v; }
function arr(v) { v = unwrap(v); if (Array.isArray(v)) return v; if (v && typeof v === 'object') { for (const k of ['animeList', 'anime_list', 'items', 'results', 'list', 'ongoing', 'completed', 'latest', 'data']) { if (v[k] != null) { const a = Array.isArray(v[k]) ? v[k] : Object.values(v[k] || {}); if (a.length) return a; } } return Object.values(v).filter(x => x && typeof x === 'object'); } return []; }
function first(o, keys) { for (const k of keys) { let v = o; for (const p of k.split('.')) v = v?.[p]; if (v !== undefined && v !== null && v !== '') return v; } return ''; }
function imageOf(o) { const x = first(o, ['poster', 'thumbnail', 'image', 'cover', 'img', 'thumb', 'image_url', 'poster_url', 'coverImage', 'anime.poster']); return typeof x === 'object' ? (x.url || x.src || '') : String(x || ''); }
function urlOf(o) { return String(first(o, ['url', 'href', 'link', 'animeUrl', 'anime_url', 'slug', 'permalink']) || ''); }
function normalize(o, provider = 'sanka') {
  if (!o || typeof o !== 'object') return null;
  const title = String(first(o, ['title', 'name', 'animeTitle', 'anime_name', 'judul']) || '').trim();
  const url = urlOf(o); const poster = imageOf(o);
  if (!title || (!url && !poster)) return null;
  const slug = String(first(o, ['slug', 'animeId', 'anime_id', 'id']) || url.split(/[?#]/)[0].replace(/\/$/, '').split('/').pop() || title);
  const score = first(o, ['score', 'rating', 'rate', 'rating.score']);
  return { ...o, title, name: title, poster, image: poster, href: url, url, slug, _slug: slug, _source: provider, _provider: provider, score: score || '' };
}
function titleKey(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(season|seasonal|subtitle indonesia|sub indo|episode)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); }
function identityKey(o) { const title = titleKey(o.title); const year = String(first(o, ['year', 'releaseYear', 'aired', 'release_year']) || '').match(/(?:19|20)\d{2}/)?.[0] || ''; return title ? `${title}|${year}` : String(o.url || o.href || o.slug || '').toLowerCase(); }
function mergeUnique(groups) { const out = [], seen = new Set(); for (const group of groups || []) for (const raw of group || []) { const item = normalize(raw, raw?._provider || raw?._source || 'sanka'); if (!item) continue; const key = identityKey(item); if (!key || seen.has(key)) continue; seen.add(key); out.push(item); } return out; }
async function fetchJson(url, timeout = 8500) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try { const r = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'NestStream/1.0 (+catalog aggregator)' } }); if (!r.ok) throw new Error(`Upstream HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(timer); }
}
async function sankaPage(source, type, page) {
  const key = `sanka:${source}:${type}:${page}`; const hit = cached(key); if (hit) return hit;
  let raw;
  try { raw = await fetchJson(`${SANKA}/anime/${encodeURIComponent(source)}/${type}?page=${page}`); }
  catch (e) { if (type !== 'latest') throw e; raw = await fetchJson(`${SANKA}/anime/${encodeURIComponent(source)}/ongoing?page=${page}`); }
  const items = arr(raw).map(x => normalize(x, source)).filter(Boolean); setCache(key, items); return items;
}
async function scraperPage(provider, page) {
  const key = `scraper:${provider}:${page}`; const hit = cached(key); if (hit) return hit;
  let raw = [];
  try {
    if (provider === 'mirainime') { const r = await miraiList(page); raw = (r.results || r.items || r.data || []).map(x => ({ ...x, href: x.url, poster: x.poster, _provider: 'scraper:mirainime' })); }
    else if (provider === 'animesail') { const r = await sail.latest(page); raw = (Array.isArray(r) ? r : (r.items || r.results || r.data || r.anime || [])).map(x => ({ ...x, href: x.url || x.href, poster: x.thumbnail || x.poster, _provider: 'scraper:animesail' })); }
  } catch (e) { console.warn(`${provider} page ${page}: ${e.message}`); }
  const items = raw.map(x => normalize(x, `scraper:${provider}`)).filter(Boolean); setCache(key, items, 10 * 60 * 1000); return items;
}
function setCacheHeaders(res, seconds = 300) { res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=600`); res.setHeader('Vary', 'Accept-Encoding'); }
function sendJson(res, status, body) { if (typeof res.status === 'function') return res.status(status).json(body); res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.end(JSON.stringify(body)); }
function query(req, key, fallback = '') { return (req.query && req.query[key] != null) ? String(req.query[key]) : fallback; }

async function catalog(req, res) {
  setCacheHeaders(res, 240);
  const type = ['completed', 'latest'].includes(query(req, 'type')) ? query(req, 'type') : 'ongoing';
  const key = `catalog:${type}`; const hit = cached(key); if (hit) return sendJson(res, 200, { ok: true, type, items: hit, cached: true });
  // Fetch both pages from every configured REST source and two pages from each list scraper concurrently.
  const jobs = [];
  for (const source of SOURCES) for (const page of [1, 2]) jobs.push(sankaPage(source, type, page).catch(e => { console.warn(`Sanka ${source}/${type}/${page}: ${e.message}`); return []; }));
  for (const provider of ['mirainime', 'animesail']) for (const page of [1, 2]) jobs.push(scraperPage(provider, page));
  const groups = await Promise.all(jobs);
  let items = mergeUnique(groups);
  if (!items.length) {
    // Small fast fallback for transient upstream outages.
    try { const home = unwrap(await fetchJson(`${SANKA}/anime/home`, 6000)); const fallback = type === 'completed' ? (home?.completeAnime || home?.completed || home?.complete || []) : type === 'latest' ? (home?.latestAnime || home?.latest || home?.ongoingAnime || home?.ongoing || []) : (home?.ongoingAnime || home?.ongoing || home?.on_going || []); items = mergeUnique([arr(fallback).map(x => normalize(x, 'default'))]); } catch (_) {}
  }
  if (items.length) setCache(key, items);
  return sendJson(res, items.length ? 200 : 503, { ok: !!items.length, type, items, error: items.length ? undefined : 'Katalog belum tersedia. Coba lagi sebentar.' });
}
async function search(req, res) {
  setCacheHeaders(res, 180);
  const q = query(req, 'q').trim(); const page = Math.max(1, Math.min(20, Number(query(req, 'page', '1')) || 1));
  if (q.length < 2) return sendJson(res, 400, { ok: false, error: 'Kata pencarian minimal 2 karakter.' });
  const key = `search:${q.toLowerCase()}:${page}`; const hit = cached(key); if (hit) return sendJson(res, 200, { ok: true, items: hit, cached: true });
  const groups = await Promise.all([
    fetchJson(`${SANKA}/anime/search/${encodeURIComponent(q)}?page=${page}`).then(x => arr(x).map(a => normalize(a, 'sanka:search')).filter(Boolean)).catch(() => []),
    miraiSearch(q, page).then(x => (x.results || x.data || []).map(a => normalize({ ...a, href: a.url, poster: a.poster }, 'scraper:mirainime')).filter(Boolean)).catch(() => []),
    sail.search(q, page).then(x => (Array.isArray(x) ? x : (x.items || x.results || x.data || [])).map(a => normalize({ ...a, href: a.url || a.href, poster: a.thumbnail || a.poster }, 'scraper:animesail')).filter(Boolean)).catch(() => []),
    indo.search(q).then(x => (Array.isArray(x) ? x : (x.result || [])).map(a => normalize({ ...a, href: a.url, poster: a.poster }, 'scraper:animeindo')).filter(Boolean)).catch(() => [])
  ]);
  const items = mergeUnique(groups); setCache(key, items, 3 * 60 * 1000); return sendJson(res, 200, { ok: true, items });
}
async function detail(req, res) {
  setCacheHeaders(res, 180);
  const provider = query(req, 'provider'); const slug = query(req, 'slug', query(req, 'url'));
  if (!slug) return sendJson(res, 400, { ok: false, error: 'slug/url diperlukan' });
  try {
    let d;
    if (provider === 'mirainime') d = await miraiDetail(slug);
    else if (provider === 'animesail') d = await sail.detail(slug);
    else if (provider === 'animeindo') d = await indo.detail(/^https?:\/\//i.test(slug) ? slug : `https://ww2.animeindo.pro/anime/${slug.replace(/^\/+|\/+$/g, '')}/`);
    else return sendJson(res, 400, { ok: false, error: 'Provider internal tidak dikenal' });
    if (d?.result) d = d.result; if (d?.status === false) throw new Error(d.error || d.message || 'Detail tidak tersedia');
    const eps = d.episodes || d.episodeList || d.episode_list || [];
    const data = { ...d, title: d.title || d.name || 'Anime', poster: d.poster || d.thumbnail || d.image || '', synopsis: d.synopsis || d.description || '', episodeList: eps.map((e, i) => ({ ...e, title: e.title || e.name || `Episode ${e.episode || e.number || i + 1}`, eps: e.episode || e.number || i + 1, href: e.url || e.href || e.slug || String(e.episode || i + 1), url: e.url || e.href || e.slug || String(e.episode || i + 1) })) };
    return sendJson(res, 200, { ok: true, data });
  } catch (e) { console.warn('detail error:', e.message); return sendJson(res, 502, { ok: false, error: 'Gagal mengambil detail dari sumber tambahan.' }); }
}
async function episode(req, res) {
  setCacheHeaders(res, 90);
  const provider = query(req, 'provider'); const slug = query(req, 'slug'); const episodeNo = query(req, 'episode');
  try {
    let data;
    if (provider === 'mirainime') data = await miraiStream(slug, episodeNo);
    else if (provider === 'animesail') data = await sail.dl(slug, { ep: episodeNo });
    else if (provider === 'animeindo') data = await indo.watch(slug);
    else return sendJson(res, 400, { ok: false, error: 'Provider internal tidak dikenal' });
    const urls = [];
    function scan(x) { if (!x) return; if (typeof x === 'string') { if (/^https?:\/\//i.test(x) && /(\.m3u8|\.mp4|embed|stream|player|video)/i.test(x)) urls.push(x); return; } if (Array.isArray(x)) return x.forEach(scan); if (typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (typeof v === 'string' && /^https?:\/\//i.test(v) && /(url|src|stream|video|embed|link|file)/i.test(k)) urls.push(v); else scan(v); } }
    scan(data); const url = urls.find(u => /embed|player|stream/i.test(u)) || urls[0] || '';
    if (!url) return sendJson(res, 404, { ok: false, error: 'Sumber video tidak ditemukan.' });
    return sendJson(res, 200, { ok: true, defaultStreamingUrl: url });
  } catch (e) { console.warn('episode error:', e.message); return sendJson(res, 502, { ok: false, error: 'Gagal mengambil sumber video dari scraper.' }); }
}
async function health(_req, res) { setCacheHeaders(res, 30); return sendJson(res, 200, { ok: true, service: 'Nest Stream Hybrid Serverless', sources: SOURCES.length, scrapers: ['mirainime', 'animesail', 'animeindo-search'], runtime: 'Vercel Functions' }); }
module.exports = { catalog, search, detail, episode, health };
