/**
 * AnimeIndo Scraper
 * Creator: IzzXd
 * Base: https://ww2.animeindo.pro
 * Saluran: https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K
 * Note: req scrape bawa url, https://codeku.izzcs.my.id/request
 */

const BASE = 'https://ww2.animeindo.pro'
const META = {
  Creator: 'IzzXd',
  Saluran: 'https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K'
}
const HOSTS = /(mediafire|drive\.google|pixeldrain|mega\.nz|racaty|krakenfiles|gofile|terabox|zippyshare|acefile|userscloud|sfile|buzzheavier|send\.cm|1fichier|dropbox|files\.fm|filedon|doodstream|streamtape|mp4upload)/i
const SKIP = /(whatsapp|facebook|twitter|instagram|telegram|t\.me|histats|wp-json|\/feed)/i

async function get(url, tries = 3) {
  let err
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'Referer': BASE + '/'
        }
      })
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url)
      return await r.text()
    } catch (e) {
      err = e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw err
}

function dec(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function txt(html) {
  return dec(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

function abs(u) {
  if (!u) return ''
  try {
    return new URL(dec(u).trim(), BASE).href
  } catch {
    return ''
  }
}

function attr(tag, name) {
  const m = new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(tag || '')
  return m ? dec(m[1] ?? m[2]) : ''
}

function block(html, cls) {
  const re = new RegExp('<(\\w+)\\b[^>]*class=["\'][^"\']*(?<![\\w-])' + cls + '(?![\\w-])[^"\']*["\'][^>]*>', 'i')
  const m = re.exec(html)
  if (!m) return ''
  const tag = m[1].toLowerCase()
  const start = m.index + m[0].length
  const tr = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi')
  tr.lastIndex = start
  let depth = 1
  let t
  while ((t = tr.exec(html))) {
    depth += t[1] ? -1 : t[0].endsWith('/>') ? 0 : 1
    if (depth === 0) return html.slice(start, t.index)
  }
  return html.slice(start)
}

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(m => {
    const head = m[0].match(/^<a\b[^>]*>/i)[0]
    return {
      href: abs(attr(head, 'href')),
      cls: attr(head, 'class'),
      title: attr(head, 'title'),
      inner: m[0].replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '')
    }
  })
}

function epNum(e) {
  const m = (e.url || '').match(/episode-(\d+)/i) || (e.episode || '').match(/(\d+)/)
  return m ? +m[1] : 0
}

function unb64(v) {
  try {
    if (/^[A-Za-z0-9+/=]{20,}$/.test(v)) {
      const d = Buffer.from(v, 'base64').toString('utf8')
      const s = d.match(/src=["']([^"']+)/i)
      if (s) return abs(s[1])
      if (/^https?:\/\//i.test(d)) return d
    }
  } catch {}
  return v
}

async function search(q) {
  const html = await get(`${BASE}/?s=${encodeURIComponent(q)}`)
  const out = []
  const seen = new Set()
  for (const a of anchors(html)) {
    if (!/(^|\s)ai-card(\s|$)/.test(a.cls)) continue
    if (!a.href || seen.has(a.href)) continue
    seen.add(a.href)
    const img = a.inner.match(/<img\b[^>]*>/i)?.[0] || ''
    const pick = c => {
      const m = new RegExp('<span[^>]*class=["\']' + c + '["\'][^>]*>([\\s\\S]*?)<\\/span>', 'i').exec(a.inner)
      return m ? txt(m[1]) : ''
    }
    out.push({
      title: pick('t') || attr(img, 'alt'),
      url: a.href,
      poster: abs(attr(img, 'src') || attr(img, 'data-src')),
      episode: pick('ep'),
      info: pick('m'),
      rating: pick('rate')
    })
  }
  return out
}

async function detail(url) {
  const html = await get(url)
  const main = block(html, 'ai-det') || html
  const title = txt(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || txt(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
  const posterBlock = block(html, 'ai-det-poster')
  const poster = abs(
    attr(posterBlock.match(/<img\b[^>]*>/i)?.[0], 'src') ||
    attr(html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0], 'content')
  )
  const synopsis = txt(block(html, 'ai-syn')) || attr(html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0], 'content')
  const facts = {}
  for (const m of block(html, 'ai-facts').matchAll(/<(li|div|p|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = txt(m[2])
    const i = t.indexOf(':')
    if (i > 0 && i < 30) {
      const k = t.slice(0, i).trim()
      if (!(k in facts)) facts[k] = t.slice(i + 1).trim()
    }
  }
  const genres = [...new Set(anchors(main).filter(a => /\/genre\//.test(a.href)).map(a => txt(a.inner)).filter(Boolean))]
  let list = anchors(block(html, 'ai-eplist')).filter(a => a.href)
  if (!list.length) list = anchors(html).filter(a => /\/nonton\//.test(a.href))
  const seen = new Set()
  const episodes = []
  for (const a of list) {
    if (seen.has(a.href)) continue
    seen.add(a.href)
    episodes.push({ episode: txt(a.inner) || a.title, url: a.href })
  }
  episodes.sort((a, b) => epNum(a) - epNum(b))
  return { title, url, poster, synopsis, genres, facts, total_episode: episodes.length, episodes }
}

async function watch(url) {
  const html = await get(url)
  const title = txt(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const player = block(html, 'ai-player') || html
  const streams = []
  for (const m of player.matchAll(/<iframe\b[^>]*>/gi)) {
    const u = abs(attr(m[0], 'src') || attr(m[0], 'data-src') || attr(m[0], 'data-lazy-src'))
    if (u && !streams.some(s => s.url === u)) streams.push({ name: 'default', url: u })
  }
  for (const m of html.matchAll(/<(\w+)\b[^>]*\bdata-(?:src|embed|url|video|iframe|server)=["'][^"']+["'][^>]*>[\s\S]*?<\/\1>/gi)) {
    const head = m[0].match(/^<[^>]+>/)[0]
    const v = attr(head, 'data-src') || attr(head, 'data-embed') || attr(head, 'data-url') || attr(head, 'data-video') || attr(head, 'data-iframe') || attr(head, 'data-server')
    const u = unb64(v)
    if (/^https?:\/\//i.test(u) && !streams.some(s => s.url === u)) {
      streams.push({ name: txt(m[0]) || 'server', url: u })
    }
  }
  const downloads = []
  for (const a of anchors(html)) {
    if (!a.href || SKIP.test(a.href)) continue
    const label = txt(a.inner) || a.title
    const dl = /download|unduh|\bdl\b|mirror/i.test(label + ' ' + a.cls) || HOSTS.test(a.href)
    if (!dl) continue
    if (a.href.startsWith(BASE) && !HOSTS.test(a.href) && /\/(anime|genre|nonton|page)\//.test(a.href)) continue
    if (downloads.some(d => d.url === a.href)) continue
    downloads.push({ label, host: new URL(a.href).host, url: a.href })
  }
  const animeLink = anchors(html).find(a => /\/anime\/[^/]+\/?$/.test(a.href))?.href || ''
  return { title, url, anime_url: animeLink, streams, downloads }
}

async function run() {
  const [cmd, ...rest] = process.argv.slice(2)
  const arg = rest.join(' ').trim()

  if (!['search', 'detail', 'dl'].includes(cmd) || !arg) {
    console.log('Cara pakai:\nnode animeindo.js search <judul>\nnode animeindo.js detail <url anime>\nnode animeindo.js dl <url episode>')
    process.exitCode = 1
    return null
  }

  if (cmd === 'search') {
    const result = await search(arg)
    return { ...META, status: true, command: 'search', query: arg, total: result.length, result }
  }

  if (!arg.startsWith(BASE)) {
    return { ...META, status: false, message: 'Harus pakai URL dari ' + BASE }
  }

  if (cmd === 'detail') {
    let u = arg
    if (/\/nonton\//.test(u)) {
      const w = await watch(u)
      if (!w.anime_url) throw new Error('Link anime tidak ketemu dari halaman episode ini')
      u = w.anime_url
    }
    return { ...META, status: true, command: 'detail', result: await detail(u) }
  }

  let u = arg
  if (/\/anime\//.test(u)) {
    const d = await detail(u)
    const last = d.episodes[d.episodes.length - 1]
    if (!last) throw new Error('Episode tidak ketemu di halaman anime ini')
    u = last.url
  }
  return { ...META, status: true, command: 'dl', result: await watch(u) }
}

run()
  .then(r => {
    if (!r) return
    console.log(JSON.stringify(r, null, 2))
    if (!r.status) process.exitCode = 1
  })
  .catch(e => {
    console.log(JSON.stringify({ ...META, status: false, message: e.message }, null, 2))
    process.exitCode = 1
  })