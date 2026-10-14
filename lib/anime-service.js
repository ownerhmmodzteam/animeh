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
function imageOf(o) {
  const x = first(o, ['poster', 'posterUrl', 'thumbnail', 'thumbnail_url', 'image', 'imageUrl', 'cover', 'cover_url', 'img', 'thumb', 'image_url', 'poster_url', 'coverImage.url', 'coverImage', 'images.poster', 'anime.poster', 'anime.image']);
  const candidate = Array.isArray(x) ? x[0] : x;
  if (candidate && typeof candidate === 'object') return String(candidate.url || candidate.src || candidate.large || candidate.medium || candidate.original || '');
  return String(candidate || '');
}
function urlOf(o) { return String(first(o, ['url', 'href', 'link', 'animeUrl', 'anime_url', 'permalink', 'path', 'slug', 'animeSlug', 'anime_slug']) || ''); }
function normalize(o, provider = 'sanka') {
  if (!o || typeof o !== 'object') return null;
  const title = String(first(o, ['title', 'name', 'animeTitle', 'anime_title', 'anime_name', 'judul', 'romaji', 'anime.title', 'anime.name']) || '').trim();
  const url = urlOf(o); const poster = imageOf(o);
  if (!title || (!url && !poster)) return null;
  const slug = String(first(o, ['slug', 'animeSlug', 'anime_slug', 'animeId', 'anime_id', 'id', 'identifier']) || url.split(/[?#]/)[0].replace(/\/$/, '').split('/').pop() || title);
  const rawScore = first(o, ['score', 'rating', 'rate', 'rating.score', 'score.value', 'vote_average', 'voteAverage', 'mal_score', 'ratingValue']);
  const score = rawScore && typeof rawScore === 'object' ? first(rawScore, ['score', 'value', 'rating', 'average']) : rawScore;
  const type = first(o, ['type', 'format', 'animeType', 'anime_type']) || '';
  const status = first(o, ['status', 'state', 'animeStatus', 'anime_status']) || '';
  const episodeLabel = first(o, ['latest_episode', 'latestEpisode', 'episode', 'eps', 'latest_episode.title', 'latestEpisode.title']) || '';
  return { ...o, title, name: title, poster, image: poster, href: url, url, slug, _slug: slug, _source: provider, _provider: provider, score: score || '', type, status, latest_episode: episodeLabel };
}
function titleKey(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(season|seasonal|subtitle indonesia|sub indo|episode)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); }
function identityKey(o) { const title = titleKey(o.title); const year = String(first(o, ['year', 'releaseYear', 'aired', 'release_year']) || '').match(/(?:19|20)\d{2}/)?.[0] || ''; return title ? `${title}|${year}` : String(o.url || o.href || o.slug || '').toLowerCase(); }
function mergeUnique(groups) { const out = [], seen = new Set(); for (const group of groups || []) for (const raw of group || []) { const item = normalize(raw, raw?._provider || raw?._source || 'sanka'); if (!item) continue; const key = identityKey(item); if (!key || seen.has(key)) continue; seen.add(key); out.push(item); } return out; }
async function fetchJson(url, timeout = 6500) {
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
  const type = ['completed', 'latest'].includes(query(req, 'type')) ? query(req, 'type') : 'ongoing';
  const key = `catalog:${type}`;
  const hit = cached(key);
  if (hit) {
    const payload = Array.isArray(hit) ? { items: hit, refreshing: false } : hit;
    setCacheHeaders(res, payload.refreshing ? 8 : 180);
    return sendJson(res, 200, { ok: true, type, items: payload.items || [], cached: true, refreshing: !!payload.refreshing });
  }
  setCacheHeaders(res, 0);

  // Keep the API responsive on slow mobile networks. Each upstream request is bounded;
  // successful page results are cached individually and reused on a retry.
  const jobs = [];
  for (const source of SOURCES) {
    for (const page of [1, 2]) {
      jobs.push((async () => {
        try { return { items: await sankaPage(source, type, page), ok: true }; }
        catch (e) { console.warn(`Sanka ${source}/${type}/${page}: ${e.message}`); return { items: [], ok: false }; }
      })());
    }
  }
  for (const provider of ['mirainime', 'animesail']) {
    for (const page of [1, 2]) {
      jobs.push((async () => {
        try {
          const result = await Promise.race([
            scraperPage(provider, page).then(items => ({ items, ok: true })),
            new Promise(resolve => setTimeout(() => resolve({ items: [], ok: false, timeout: true }), 6900))
          ]);
          return result;
        } catch (e) {
          console.warn(`${provider} page ${page}: ${e.message}`);
          return { items: [], ok: false };
        }
      })());
    }
  }

  const groups = await Promise.all(jobs);
  let items = mergeUnique(groups.map(g => g.items || []));
  let refreshing = groups.some(g => !g.ok);

  // The homepage endpoint is a last-resort source when individual source endpoints are down.
  if (!items.length) {
    try {
      const home = unwrap(await fetchJson(`${SANKA}/anime/home`, 2200));
      const fallback = type === 'completed'
        ? (home?.completeAnime || home?.completed || home?.complete || [])
        : type === 'latest'
          ? (home?.latestAnime || home?.latest || home?.ongoingAnime || home?.ongoing || [])
          : (home?.ongoingAnime || home?.ongoing || home?.on_going || []);
      items = mergeUnique([arr(fallback).map(x => normalize(x, 'default'))]);
    } catch (_) {}
  }

  // A partial result expires quickly so the browser can retry for more data.
  if (items.length) setCache(key, { items, refreshing }, refreshing ? 12_000 : CACHE_MS);
  if (!items.length) {
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 503, { ok: false, type, items: [], refreshing: true, error: 'Jaringan sumber sedang lambat. Katalog akan dicoba kembali.' });
  }
  setCacheHeaders(res, refreshing ? 8 : 240);
  return sendJson(res, 200, { ok: true, type, items, refreshing, partial: refreshing });
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
function numericEpisode(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const match = s.match(/(?:episode|ep\.?|episod|e)\s*[-:#.]?\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}
function episodeNumberOf(e) {
  if (!e || typeof e !== 'object') return null;
  for (const key of ['episode', 'episode_number', 'episodeNumber', 'number', 'eps', 'ep', 'no']) {
    const n = numericEpisode(e[key]);
    if (n !== null) return n;
  }
  const title = String(e.title || e.name || e.label || '');
  const titleMatch = title.match(/(?:episode|ep\.?|episod)\s*[-:#.]?\s*(\d+(?:\.\d+)?)/i);
  if (titleMatch) return Number(titleMatch[1]);
  const href = String(e.url || e.href || e.link || e.slug || e.path || '');
  const urlMatch = href.match(/\/(?:episode|ep)[\/-](\d+(?:\.\d+)?)(?:\/|$|[?#])/i) || href.match(/(?:episode|ep)[-_](\d+(?:\.\d+)?)(?:\/|$|[?#])/i);
  return urlMatch ? Number(urlMatch[1]) : null;
}
function episodeSeasonOf(e) {
  if (!e || typeof e !== 'object') return '';
  for (const key of ['season', 'seasonNumber', 'season_number', 'seasonNo', 'season_no']) {
    const value = e[key];
    if (value !== undefined && value !== null && value !== '') {
      const m = String(typeof value === 'object' ? (value.number || value.name || value.title || '') : value).match(/\d+/);
      if (m) return m[0];
    }
  }
  const text = `${e.title || e.name || ''} ${e.url || e.href || e.slug || ''}`;
  const match = text.match(/season[\s_/-]*(\d+)/i) || text.match(/s(\d{1,2})[\s_-]*e\d+/i);
  return match ? match[1] : '';
}
function normalizeEpisodeList(input) {
  const list = Array.isArray(input) ? input : (input && typeof input === 'object' ? Object.values(input) : []);
  const out = [], byNumber = new Set(), byUrl = new Set();
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const e = (raw && typeof raw === 'object') ? raw : { title: String(raw ?? '') };
    const href = String(first(e, ['url', 'href', 'link', 'episodeUrl', 'episode_url', 'path', 'slug']) || (typeof raw === 'string' && /^https?:\/\//i.test(raw) ? raw : '')).trim();
    const title = String(first(e, ['title', 'name', 'label', 'episodeTitle', 'episode_title']) || '').trim();
    let number = episodeNumberOf(e);
    if (number === null && title) {
      const match = title.match(/(?:episode|ep\.?|episod)\s*[-:#.]?\s*(\d+(?:\.\d+)?)/i);
      if (match) number = Number(match[1]);
    }
    const canonicalUrl = href.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
    const season = episodeSeasonOf(e);
    const numberKey = number !== null ? `${season ? `s${season}:` : ''}${number}` : '';
    if (number !== null && byNumber.has(numberKey)) continue;
    if (number === null && canonicalUrl && byUrl.has(canonicalUrl)) continue;
    if (number !== null) byNumber.add(numberKey);
    if (canonicalUrl) byUrl.add(canonicalUrl);
    const fallbackTitle = title || (number !== null ? `Episode ${number}` : `Episode ${i + 1}`);
    out.push({ ...e, title: fallbackTitle, episode: number, eps: number, number, season: season || e.season || '', href: href || String(number ?? i + 1), url: href || String(number ?? i + 1) });
  }
  if (out.length && out.every(e => typeof e.episode === 'number')) out.sort((a, b) => (Number(b.season || 0) - Number(a.season || 0)) || (b.episode - a.episode));
  return out;
}

async function detail(req, res) {
  setCacheHeaders(res, 180);
  const provider = query(req, 'provider'); const slug = query(req, 'slug', query(req, 'url'));
  if (!slug) return sendJson(res, 400, { ok: false, error: 'slug/url diperlukan' });
  try {
    const bounded = (promise, ms = 11_000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Upstream timeout')), ms))]);
    let d;
    if (provider === 'mirainime') d = await bounded(miraiDetail(slug));
    else if (provider === 'animesail') d = await bounded(sail.detail(slug));
    else if (provider === 'animeindo') {
      const target = /^https?:\/\//i.test(slug) ? slug : `https://ww2.animeindo.pro/anime/${slug.replace(/^\/+|\/+$/g, '')}/`;
      d = await bounded(indo.detail(target));
    } else return sendJson(res, 400, { ok: false, error: 'Provider internal tidak dikenal' });
    if (d?.result) d = d.result;
    if (d?.status === false) throw new Error(d.error || d.message || 'Detail tidak tersedia');
    const eps = first(d, ['episodes', 'episodeList', 'episode_list', 'episode.list']) || [];
    const episodeList = normalizeEpisodeList(eps);
    const poster = imageOf(d) || String(first(d, ['thumbnail', 'image', 'cover']) || '');
    const data = {
      ...d,
      title: String(first(d, ['title', 'name', 'animeTitle', 'anime_title']) || 'Anime'),
      poster,
      synopsis: String(first(d, ['synopsis', 'description', 'plot', 'summary']) || ''),
      genres: first(d, ['genres', 'genreList', 'genre']) || [],
      episodeList,
      episodes: episodeList,
      totalEpisodesCount: episodeList.length,
      total_episodes: episodeList.length
    };
    return sendJson(res, 200, { ok: true, data });
  } catch (e) {
    console.warn('detail error:', e.message);
    return sendJson(res, 502, { ok: false, error: e.message === 'Upstream timeout' ? 'Sumber detail sedang lambat. Coba lagi.' : 'Gagal mengambil detail dari sumber tambahan.' });
  }
}

function cleanMediaUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return '';
  const iframeMatch = url.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) url = iframeMatch[1];
  if (url.startsWith('//')) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) return '';
  try { url = decodeURIComponent(url.replace(/&amp;/g, '&')); } catch (_) {}
  // Convert common share pages to their documented embedded form where available.
  let m = url.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)(?:\/|$)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/^https?:\/\/drive\.google\.com\/open\?id=([^&]+)/i) || url.match(/^https?:\/\/drive\.google\.com\/uc\?id=([^&]+)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/^https?:\/\/www\.youtube\.com\/watch\?[^#]*v=([^&]+)/i);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return url.replace(/^http:\/\//i, 'https://');
}
function collectMediaSources(data) {
  const found = [];
  const add = (value, label = '') => {
    const url = cleanMediaUrl(value);
    if (!url || found.some(x => x.url === url)) return;
    const isDirect = /\.(?:m3u8|mp4|webm|ogv)(?:[?#]|$)/i.test(url);
    let name = String(label || '').trim();
    if (!name || name === '[object Object]') name = isDirect ? 'Direct Video' : `Sumber ${found.length + 1}`;
    found.push({ name, url, type: isDirect ? 'direct' : 'embed' });
  };
  const walk = (value, label = '', depth = 0) => {
    if (!value || depth > 8) return;
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value) || /^\/\//.test(value) || /<iframe/i.test(value)) {
        if (/^https?:\/\//i.test(value) || /^\/\//.test(value) || /<iframe/i.test(value)) add(value, label);
      }
      return;
    }
    if (Array.isArray(value)) { value.forEach((item, i) => walk(item, label || `Sumber ${i + 1}`, depth + 1)); return; }
    if (typeof value !== 'object') return;
    const ownLabel = String(value.server || value.name || value.title || value.resolution || label || '').trim();
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && /(url|src|stream|video|embed|player|iframe|file|link)/i.test(key)) add(child, ownLabel || key);
      else if (child && typeof child === 'object') walk(child, ownLabel || key, depth + 1);
    }
  };
  walk(data);
  // Prefer actual video streams, then embedded players, and retain alternatives for retry.
  found.sort((a, b) => (a.type === 'direct' ? 0 : 1) - (b.type === 'direct' ? 0 : 1));
  return found.slice(0, 12).map((x, i) => ({ ...x, name: x.name || `Sumber ${i + 1}` }));
}
async function episode(req, res) {
  setCacheHeaders(res, 60);
  const provider = query(req, 'provider'); const slug = query(req, 'slug'); const episodeNo = query(req, 'episode');
  if (!slug) return sendJson(res, 400, { ok: false, error: 'slug diperlukan' });
  try {
    const bounded = (promise, ms = 11_000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Upstream timeout')), ms))]);
    let data;
    if (provider === 'mirainime') data = await bounded(miraiStream(slug, episodeNo));
    else if (provider === 'animesail') data = await bounded(sail.dl(slug, { ep: episodeNo }));
    else if (provider === 'animeindo') data = await bounded(indo.watch(slug));
    else return sendJson(res, 400, { ok: false, error: 'Provider internal tidak dikenal' });
    if (data?.status === false) throw new Error(data.error || 'Sumber video tidak tersedia');
    const sources = collectMediaSources(data);
    if (!sources.length) return sendJson(res, 404, { ok: false, error: 'Sumber video tidak ditemukan.', sources: [] });
    return sendJson(res, 200, { ok: true, sources, defaultStreamingUrl: sources[0].url });
  } catch (e) {
    console.warn('episode error:', e.message);
    return sendJson(res, e.message === 'Upstream timeout' ? 504 : 502, { ok: false, error: e.message === 'Upstream timeout' ? 'Sumber video sedang lambat. Coba lagi.' : 'Gagal mengambil sumber video dari scraper.', sources: [] });
  }
}

async function genres(_req, res) {
  const hit = cached('genres:anime');
  if (hit) { setCacheHeaders(res, 600); return sendJson(res, 200, { ok: true, items: hit, cached: true }); }
  let items = [];
  try {
    const raw = await fetchJson(`${SANKA}/anime/genre`, 5000);
    items = arr(raw).map(g => {
      if (typeof g === 'string') {
        const slug = g.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return { title: g, name: g, slug, genreId: slug };
      }
      if (!g || typeof g !== 'object') return null;
      const title = String(first(g, ['title', 'name', 'genre', 'label']) || '').trim();
      if (!title) return null;
      const slug = String(first(g, ['genreId', 'genre_id', 'slug', 'id', 'url']) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      return { ...g, title, name: title, slug, genreId: slug };
    }).filter(Boolean);
  } catch (e) { console.warn('genres error:', e.message); }
  if (!items.length) {
    const defaults = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Isekai', 'Slice of Life', 'Mystery', 'Sci-Fi'];
    items = defaults.map(title => ({ title, name: title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), genreId: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
  }
  setCache('genres:anime', items, 30 * 60 * 1000);
  setCacheHeaders(res, 1800);
  return sendJson(res, 200, { ok: true, items, fallback: items.length > 0 && !items.some(g => g.provider || g.count !== undefined) });
}

async function health(_req, res) { setCacheHeaders(res, 30); return sendJson(res, 200, { ok: true, service: 'Nest Stream Hybrid Serverless', sources: SOURCES.length, scrapers: ['mirainime', 'animesail', 'animeindo-search'], runtime: 'Vercel Functions' }); }
module.exports = { catalog, search, detail, episode, genres, health };
