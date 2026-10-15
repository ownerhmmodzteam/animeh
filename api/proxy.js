const BASE = 'https://www.sankavollerei.web.id';
const ALLOWED_PREFIXES = ['/anime/', '/anime', '/search', '/genre', '/jadwal', '/schedule'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ status: false, error: 'Method not allowed' });

  try {
    const path = String(req.query.path || '');
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') ||
        !ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))) {
      return res.status(400).json({ status: false, error: 'Invalid or unsupported API path' });
    }
    const target = new URL(path, BASE);
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path' || value == null) continue;
      target.searchParams.set(key, String(value));
    }
    if (target.origin !== BASE) return res.status(400).json({ status: false, error: 'Invalid upstream' });
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NestStream-Anime/1.0 (+Vercel Serverless)'
      },
      signal: AbortSignal.timeout(12000)
    });
    const body = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(body); }
    catch { return res.status(502).json({ status: false, error: 'Upstream returned non-JSON data', upstreamStatus: upstream.status }); }
    if (!upstream.ok) return res.status(upstream.status).json({ status: false, error: 'Anime API request failed', data: parsed });
    return res.status(200).json(parsed);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timeout ? 504 : 502).json({ status: false, error: timeout ? 'Upstream timeout' : 'Anime API unavailable' });
  }
};
