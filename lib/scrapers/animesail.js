/**
 * AnimeSail Scraper
 * Creator: IzzXd
 * Base: https://anisail.com
 * Saluran: https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K
 */

const axios = require('./http-client');
const cheerio = require('cheerio');

const BASE_TARGET = 'https://v1.animesail.xyz';
const WM = {
  Creator: 'IzzXd',
  Saluran: 'https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K'
};

const COOKIES = '_as_ipin_tz=Asia%2FJakarta; _as_ipin_lc=id-ID; _as_ipin_ct=ID';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cookie': COOKIES,
  'Referer': BASE_TARGET + '/'
};

function normalizeUrl(input) {
  if (!input) return '';
  let str = String(input).trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    str = str.replace(/^https?:\/\/(?:anisail\.com|animesail\.xyz|animesail\.net|animesail\.tv|animesail\.id)/i, BASE_TARGET);
    return str;
  }
  if (str.startsWith('/')) {
    return BASE_TARGET + str;
  }
  return BASE_TARGET + '/' + str.replace(/^\/+/, '');
}

async function fetchHtml(url) {
  const target = normalizeUrl(url);
  const res = await axios.get(target, {
    headers: HEADERS,
    timeout: 30000,
    validateStatus: (s) => s < 500
  });
  if (res.status === 404) {
    throw new Error('Halaman tidak ditemukan (404): ' + target);
  }
  if (res.status !== 200) {
    throw new Error('HTTP Error ' + res.status + ' saat mengakses ' + target);
  }
  return cheerio.load(res.data);
}

function parseCard($, el) {
  const a = $(el).find('a').first();
  if (!a.length) return null;
  const href = a.attr('href') || '';
  const title = $(el).find('.tt h2, h2, h3').first().text().trim() || a.attr('title') || '';
  const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
  const typeText = $(el).find('.tt span').text().trim();
  const yearMatch = typeText.match(/\b(19\d\d|20\d\d)\b/);
  const timeMatch = $(el).find('x-ts').text().trim() || '';
  const epMatch = title.match(/Episode\s+(\d+(?:\.\d+)?)/i);
  const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');
  const slug = cleanHref.replace(/^\/+|\/+$/g, '');

  let type = '';
  if (typeText.includes('Movie')) type = 'Movie';
  else if (typeText.includes('ONA')) type = 'ONA';
  else if (typeText.includes('TV')) type = 'TV';

  return {
    title,
    slug,
    url: normalizeUrl(href),
    thumbnail: img,
    type,
    year: yearMatch ? yearMatch[1] : null,
    episode: epMatch ? epMatch[1] : null,
    latestTime: timeMatch || null
  };
}

async function fetchDownloadTable(dlPath) {
  const dlUrl = normalizeUrl(dlPath);
  try {
    const $ = await fetchHtml(dlUrl);
    const result = {};
    $('table tr').each((_, tr) => {
      const q = $(tr).find('td').first().text().trim();
      if (!q) return;
      const links = [];
      $(tr).find('a[data-href]').each((_, a) => {
        const sName = $(a).text().trim() || $(a).attr('title') || '';
        const rawHref = $(a).attr('data-href') || '';
        const cleanHref = rawHref.trim();
        if (cleanHref && cleanHref !== '#/') {
          links.push({ server: sName, url: cleanHref });
        }
      });
      if (links.length) {
        result[q] = links;
      }
    });
    return result;
  } catch (e) {
    return null;
  }
}

async function episode(slugOrUrl) {
  const targetUrl = normalizeUrl(slugOrUrl);
  const $ = await fetchHtml(targetUrl);
  const title = $('h1.entry-title, h1').first().text().trim();

  const embeds = [];
  $('[data-em]').each((_, el) => {
    const sName = $(el).text().trim() || '';
    const raw = $(el).attr('data-em') || '';
    if (!raw) return;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const $emb = cheerio.load(decoded);
      const iframeSrc = $emb('iframe').attr('src') || '';
      let streamUrl = null;
      if (iframeSrc.includes('url=')) {
        const matchUrl = iframeSrc.match(/url=([^&]+)/);
        if (matchUrl) streamUrl = decodeURIComponent(matchUrl[1]);
      } else if (iframeSrc.includes('bsrc=')) {
        const matchBsrc = iframeSrc.match(/bsrc=([^&]+)/);
        if (matchBsrc) {
          try {
            streamUrl = Buffer.from(matchBsrc[1], 'base64').toString('utf8');
          } catch (e) {}
        }
      } else if (iframeSrc.includes('/play/')) {
        streamUrl = iframeSrc;
      }
      embeds.push({
        server: sName,
        iframe: iframeSrc,
        streamUrl: streamUrl || iframeSrc
      });
    } catch (e) {}
  });

  const defaultEmbed = $('#pembed').attr('data-default');
  if (defaultEmbed && !embeds.length) {
    try {
      const dec = Buffer.from(defaultEmbed, 'base64').toString('utf8');
      const $emb = cheerio.load(dec);
      const src = $emb('iframe').attr('src') || '';
      embeds.push({ server: 'default', iframe: src, streamUrl: src });
    } catch (e) {}
  }

  const dlLink = $('a[href*="/streaming-download/?id="]').attr('href') || null;
  let downloads = null;
  if (dlLink) {
    downloads = await fetchDownloadTable(dlLink);
  }

  const prev = $('.nvs a:contains("Prev"), .naveps a:contains("Prev")').attr('href') || null;
  const next = $('.nvs a:contains("Next"), .naveps a:contains("Next")').attr('href') || null;
  const animeLink = $('.nvs a[href*="/anime/"], a:contains("Semua Episode")').attr('href') || null;

  return {
    ...WM,
    title,
    url: targetUrl,
    animeUrl: animeLink ? normalizeUrl(animeLink) : null,
    navigation: {
      prev: prev ? normalizeUrl(prev) : null,
      next: next ? normalizeUrl(next) : null
    },
    embeds,
    downloads: downloads || {}
  };
}

async function detail(slugOrUrl) {
  let target = slugOrUrl;
  if (!target.includes('/anime/') && !target.startsWith('http')) {
    target = '/anime/' + target.replace(/^\/+|\/+$/g, '') + '/';
  }
  const targetUrl = normalizeUrl(target);
  const $ = await fetchHtml(targetUrl);

  const title = $('h1.entry-title').text().trim();
  const synopsis = $('.entry-content p, .desc, .synopsis').text().trim();
  const thumbnail = $('img.wp-post-image, .thumb img').attr('src') || '';

  const metadata = {};
  $('p, tr').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes(':') && text.length < 150) {
      const parts = text.split(':');
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      if (key && val) metadata[key] = val;
    }
  });

  const episodes = [];
  $('ul.daftar li a').each((_, a) => {
    const epUrl = $(a).attr('href') || '';
    const epTitle = $(a).text().trim();
    const numMatch = epTitle.match(/Episode\s+(\d+(?:\.\d+)?)/i);
    const cleanEp = epUrl.replace(/^https?:\/\/[^\/]+/, '');
    episodes.push({
      title: epTitle,
      episode: numMatch ? numMatch[1] : null,
      url: normalizeUrl(epUrl),
      slug: cleanEp.replace(/^\/+|\/+$/g, '')
    });
  });

  return {
    ...WM,
    title,
    url: targetUrl,
    thumbnail,
    metadata,
    synopsis,
    totalEpisodesCount: episodes.length,
    episodes
  };
}

async function dl(slugOrUrl, opts = {}) {
  const str = String(slugOrUrl).trim();
  let isAnime = false;
  if (str.includes('/anime/') || (!str.includes('episode') && !/-\d+\/?$/.test(str))) {
    isAnime = true;
  }

  if (isAnime) {
    let animeData = null;
    try {
      animeData = await detail(slugOrUrl);
    } catch (e) {
      return episode(slugOrUrl);
    }

    if (animeData && animeData.episodes && animeData.episodes.length) {
      if (opts.all) {
        const results = [];
        for (const ep of animeData.episodes) {
          try {
            const epData = await episode(ep.url);
            results.push({
              episode: ep.episode || ep.title,
              title: ep.title,
              url: ep.url,
              embeds: epData.embeds,
              downloads: epData.downloads
            });
          } catch (e) {
            results.push({
              episode: ep.episode || ep.title,
              title: ep.title,
              url: ep.url,
              error: e.message
            });
          }
        }
        return {
          ...WM,
          title: animeData.title,
          totalEpisodes: animeData.episodes.length,
          episodes: results
        };
      }

      let targetEp = null;
      if (opts.ep) {
        targetEp = animeData.episodes.find(e => String(e.episode) === String(opts.ep)) ||
                   animeData.episodes.find(e => e.title.toLowerCase().includes('episode ' + opts.ep));
      }
      if (!targetEp) {
        targetEp = animeData.episodes[0];
      }

      const epData = await episode(targetEp.url);
      return {
        ...WM,
        animeTitle: animeData.title,
        episodeTitle: targetEp.title,
        episode: targetEp.episode,
        url: targetEp.url,
        embeds: epData.embeds,
        downloads: epData.downloads,
        availableEpisodes: animeData.episodes.map(e => ({ episode: e.episode, title: e.title, url: e.url }))
      };
    }
  }

  return episode(slugOrUrl);
}

async function latest(page = 1) {
  const path = page > 1 ? `/page/${page}/` : '/';
  const $ = await fetchHtml(path);
  const items = [];
  const seen = new Set();
  $('.bsx').each((_, el) => {
    const card = parseCard($, el);
    if (card && card.title && !seen.has(card.url)) {
      seen.add(card.url);
      items.push(card);
    }
  });
  return {
    ...WM,
    page: parseInt(page, 10),
    totalItems: items.length,
    items
  };
}

async function search(query, page = 1) {
  const path = `/?s=${encodeURIComponent(query)}` + (page > 1 ? `&page=${page}` : '');
  const $ = await fetchHtml(path);
  const items = [];
  const seen = new Set();
  $('.bsx').each((_, el) => {
    const card = parseCard($, el);
    if (card && card.title && !seen.has(card.url)) {
      seen.add(card.url);
      items.push(card);
    }
  });
  return {
    ...WM,
    query,
    page: parseInt(page, 10),
    totalItems: items.length,
    items
  };
}

async function movie(page = 1) {
  const path = page > 1 ? `/movie-terbaru/page/${page}/` : '/movie-terbaru/';
  const $ = await fetchHtml(path);
  const items = [];
  const seen = new Set();
  $('.bsx').each((_, el) => {
    const card = parseCard($, el);
    if (card && card.title && !seen.has(card.url)) {
      seen.add(card.url);
      items.push(card);
    }
  });
  return {
    ...WM,
    page: parseInt(page, 10),
    totalItems: items.length,
    items
  };
}

async function donghua(page = 1) {
  const path = page > 1 ? `/rilisan-donghua-terbaru/page/${page}/` : '/rilisan-donghua-terbaru/';
  const $ = await fetchHtml(path);
  const items = [];
  const seen = new Set();
  $('.bsx').each((_, el) => {
    const card = parseCard($, el);
    if (card && card.title && !seen.has(card.url)) {
      seen.add(card.url);
      items.push(card);
    }
  });
  return {
    ...WM,
    page: parseInt(page, 10),
    totalItems: items.length,
    items
  };
}

async function schedule() {
  const $ = await fetchHtml('/jadwal-tayang/');
  const result = {};
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', "Jum'at", 'Sabtu'];

  $('.bixbox').each((_, el) => {
    const day = $(el).find('h3').text().trim();
    if (days.includes(day)) {
      const dayList = [];
      const seen = new Set();
      $(el).find('.listupd .bsx').each((__, art) => {
        const a = $(art).find('a').first();
        const title = $(art).find('.tt h2, h2').text().trim() || a.attr('title') || '';
        const href = a.attr('href') || '';
        const img = $(art).find('img').attr('src') || $(art).find('img').attr('data-src') || '';
        const timeInfo = $(art).find('.tt span').text().trim();
        const fullUrl = normalizeUrl(href);
        if (title && href && !seen.has(fullUrl)) {
          seen.add(fullUrl);
          dayList.push({
            title,
            url: fullUrl,
            thumbnail: img,
            time: timeInfo || null
          });
        }
      });
      if (dayList.length) {
        result[day] = dayList;
      }
    }
  });

  return {
    ...WM,
    schedule: result
  };
}

async function genres() {
  const $ = await fetchHtml('/genre/');
  const list = [];
  $('a[href*="/genres/"]').each((_, a) => {
    const raw = $(a).text().trim();
    const href = $(a).attr('href') || '';
    const match = raw.match(/^(.*?)(?:\s+(\d+))?$/);
    const name = match ? match[1].trim() : raw;
    const count = match && match[2] ? parseInt(match[2], 10) : null;
    const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');
    const slug = cleanHref.replace(/^\/genres\/|\/$/g, '');
    if (name && !list.some(g => g.slug === slug)) {
      list.push({ name, slug, count, url: normalizeUrl(href) });
    }
  });
  return {
    ...WM,
    totalGenres: list.length,
    genres: list
  };
}

async function genre(genreSlug, page = 1) {
  const cleanSlug = genreSlug.replace(new RegExp('^/+|/+$', 'g'), '').replace(new RegExp('^genres/'), '');
  const path = `/genres/${cleanSlug}/` + (page > 1 ? `page/${page}/` : '');
  const $ = await fetchHtml(path);
  const items = [];
  const seen = new Set();
  $('.bsx').each((_, el) => {
    const card = parseCard($, el);
    if (card && card.title && !seen.has(card.url)) {
      seen.add(card.url);
      items.push(card);
    }
  });
  return {
    ...WM,
    genre: cleanSlug,
    page: parseInt(page, 10),
    totalItems: items.length,
    items
  };
}

function printHelp() {
  console.log('Usage:\n' +
    ' node anisail.js <url|slug>\n' +
    ' node anisail.js dl <slug|url> [ep_number] [--all]\n' +
    ' node anisail.js search <query> [page]\n' +
    ' node anisail.js latest [page]\n' +
    ' node anisail.js movie [page]\n' +
    ' node anisail.js donghua [page]\n' +
    ' node anisail.js detail <slug|url>\n' +
    ' node anisail.js episode <slug|url>\n' +
    ' node anisail.js schedule\n' +
    ' node anisail.js genres\n' +
    ' node anisail.js genre <slug> [page]');
}

(async () => {
  const args = process.argv.slice(2);
  const cmd = (args[0] || '').trim();

  if (!cmd) {
    printHelp();
    process.exit(1);
  }

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    process.exit(0);
  }

  try {
    let result;
    const sub = cmd.toLowerCase();

    switch (sub) {
      case 'latest':
      case 'recent': {
        const page = parseInt(args[1], 10) || 1;
        result = await latest(page);
        break;
      }
      case 'search':
      case 's': {
        const query = args.slice(1).join(' ');
        if (!query) {
          console.log('Usage:\n node anisail.js search <query>');
          process.exit(1);
        }
        result = await search(query);
        break;
      }
      case 'movie':
      case 'movies': {
        const page = parseInt(args[1], 10) || 1;
        result = await movie(page);
        break;
      }
      case 'donghua': {
        const page = parseInt(args[1], 10) || 1;
        result = await donghua(page);
        break;
      }
      case 'detail':
      case 'info': {
        const slug = args.slice(1).join(' ');
        if (!slug) {
          console.log('Usage:\n node anisail.js detail <slug|url>');
          process.exit(1);
        }
        result = await detail(slug);
        break;
      }
      case 'episode':
      case 'ep': {
        const slug = args.slice(1).join(' ');
        if (!slug) {
          console.log('Usage:\n node anisail.js episode <slug|url>');
          process.exit(1);
        }
        result = await episode(slug);
        break;
      }
      case 'dl':
      case 'download': {
        const slug = args[1];
        if (!slug) {
          console.log('Usage:\n node anisail.js dl <slug|url> [ep]');
          process.exit(1);
        }
        const opts = {};
        if (args[2] && !args[2].startsWith('--')) {
          opts.ep = args[2];
        }
        args.slice(2).forEach(a => {
          if (a === '--all') opts.all = true;
          if (a.startsWith('--ep=')) opts.ep = a.split('=')[1];
        });
        result = await dl(slug, opts);
        break;
      }
      case 'schedule':
      case 'jadwal': {
        result = await schedule();
        break;
      }
      case 'genres': {
        result = await genres();
        break;
      }
      case 'genre': {
        const gSlug = args[1];
        if (!gSlug) {
          console.log('Usage:\n node anisail.js genre <slug> [page]');
          process.exit(1);
        }
        const page = parseInt(args[2], 10) || 1;
        result = await genre(gSlug, page);
        break;
      }
      default: {
        const input = args[0];
        const epArg = args[1];
        if (epArg && !epArg.startsWith('--') && !isNaN(parseInt(epArg, 10))) {
          result = await dl(input, { ep: epArg });
        } else if (input.includes('/anime/')) {
          result = await detail(input);
        } else if (input.includes('episode') || /-\d+\/?$/.test(input)) {
          result = await episode(input);
        } else if (input.startsWith('http://') || input.startsWith('https://')) {
          try {
            result = await episode(input);
          } catch (e) {
            result = await detail(input);
          }
        } else {
          try {
            result = await detail(input);
          } catch (e) {
            result = await search(args.join(' '));
          }
        }
        break;
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ ...WM, error: err.message }, null, 2));
    process.exit(1);
  }
})();