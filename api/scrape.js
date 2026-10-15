const cheerio = require('cheerio');

const SOURCES = {
  animeindo: 'https://ww2.animeindo.pro',
  animesail: 'https://v1.animesail.xyz',
  mirainime: 'https://mirainime.com'
};

function safeUrl(input) {
  const u = new URL(input);
  const allowed = Object.values(SOURCES).some(base => {
    const b = new URL(base);
    return u.protocol === 'https:' && u.hostname === b.hostname;
  });
  if (!allowed) throw new Error('Domain sumber tidak diizinkan');
  return u;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=180');
  if (req.method !== 'GET') return res.status(405).json({ status: false, error: 'GET only' });
  try {
    const source = String(req.query.source || 'mirainime').toLowerCase();
    const base = SOURCES[source];
    if (!base) return res.status(400).json({ status: false, error: 'Unknown source' });
    const input = String(req.query.url || base + (source === 'mirainime' ? '/anime' : '/'));
    const url = safeUrl(input);
    if (new URL(base).hostname !== url.hostname) return res.status(400).json({ status: false, error: 'Source-host mismatch' });
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NestStreamAnime/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.7'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return res.status(upstream.status).json({ status: false, error: `Source returned HTTP ${upstream.status}` });
    const html = await upstream.text();
    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();
    $('article, .bsx, .ctx-card, .anime-card, .listupd a, .grid a[href*="/anime/"]').each((_, el) => {
      const node = $(el);
      const a = node.is('a') ? node : node.find('a[href]').first();
      const href = a.attr('href');
      const title = (a.attr('title') || a.find('h2,h3,.tt,.title').first().text() || node.find('h2,h3,.title,.tt').first().text()).trim().replace(/\s+/g, ' ');
      const img = node.find('img').first();
      const poster = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || null;
      if (!href || !title) return;
      let full;
      try { full = new URL(href, url).toString(); } catch { return; }
      if (new URL(full).hostname !== url.hostname || seen.has(full)) return;
      seen.add(full);
      items.push({ title, url: full, slug: full, poster: poster ? new URL(poster, url).toString() : null });
    });
    const title = $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || $('.synopsis,.description,.entry-content').first().text().trim();
    const episodes = [];
    $('a[href*="episode"], a[href*="nonton"], .daftar a, #episode-table-wrap a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (!href || !text) return;
      try {
        const full = new URL(href, url).toString();
        if (new URL(full).hostname === url.hostname && !episodes.some(e => e.url === full)) episodes.push({ title: text, url: full });
      } catch {}
    });
    const embeds = [];
    $('iframe[src], video source[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      try {
        const full = new URL(src, url).toString();
        if (['https:', 'http:'].includes(new URL(full).protocol)) embeds.push({ url: full, type: el.tagName === 'source' ? 'video' : 'iframe' });
      } catch {}
    });
    return res.status(200).json({
      status: true, source, url: url.toString(),
      mode: episodes.length || embeds.length || title ? 'detail-or-watch' : 'listing',
      title: title || null, description: description || null,
      items: items.slice(0, 100), episodes, embeds
    });
  } catch (error) {
    return res.status(502).json({ status: false, error: error.name === 'TimeoutError' ? 'Source timeout' : error.message || 'Scraper failed' });
  }
};
