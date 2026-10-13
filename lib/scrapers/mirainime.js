/**
 * Mirainime Scraper & All-Episode Downloader
 * Creator: IzzXd
 * Base: https://mirainime.com
 * Saluran: https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K
 */

const axios = require('./http-client');
const cheerio = require('cheerio');

const BASE_URL = 'https://mirainime.com';
const CREATOR = 'IzzXd';
const SALURAN = 'https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': BASE_URL,
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

function cleanSlug(target) {
  let s = target.trim();
  if (s.startsWith(BASE_URL)) {
    s = s.slice(BASE_URL.length);
  }
  if (s.startsWith('http')) {
    try {
      s = new URL(s).pathname;
    } catch (e) {}
  }
  if (s.includes('/anime/')) {
    s = s.split('/anime/')[1].split('/')[0].split('?')[0];
  }
  return s.replace(/^\/|\/$/g, '');
}

async function list(page = 1) {
  try {
    const res = await client.get('/anime', {
      params: { page }
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.grid .ctx-card').each((_, el) => {
      const a = $(el).find('h2 a').first();
      const title = a.text().trim();
      const href = a.attr('href') || '';
      const altTitle = $(el).find('h3').text().trim() || null;

      let poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || null;
      if (poster && !poster.startsWith('http')) poster = BASE_URL + poster;

      const genres = [];
      $(el).find('a[href*="/genre/"]').each((_, g) => {
        const txt = $(g).text().trim();
        if (txt) genres.push(txt);
      });

      const metaSpans = $(el).find('.border-t span').map((_, s) => $(s).text().trim()).get().filter(t => t && t !== '·');

      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
        const slug = cleanSlug(fullUrl);
        results.push({
          title,
          alt_title: altTitle,
          slug,
          poster,
          meta: metaSpans,
          genres,
          url: fullUrl
        });
      }
    });

    if (results.length === 0) {
      $('#all-anime-grid a.ctx-card').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).find('h3').text().trim();
        let poster = $(el).find('img').attr('src') || null;
        if (poster && !poster.startsWith('http')) poster = BASE_URL + poster;
        const rating = $(el).find('.absolute span').text().trim() || null;

        if (title && href) {
          const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
          const slug = cleanSlug(fullUrl);
          results.push({
            title,
            slug,
            poster,
            rating,
            url: fullUrl
          });
        }
      });
    }

    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: true,
      page: parseInt(page, 10),
      total: results.length,
      results
    };
  } catch (err) {
    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: false,
      error: err.message
    };
  }
}

async function search(keyword, page = 1) {
  try {
    const res = await client.get('/anime-list', {
      params: { q: keyword, page }
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.space-y-3 > div, div[data-bookmarked]').each((_, el) => {
      const a = $(el).find('h3 a').first();
      const title = a.text().trim();
      const href = a.attr('href') || '';
      const altTitle = $(el).find('.text-gray-400').first().text().trim() || null;
      let poster = $(el).find('img').attr('src') || null;
      if (poster && !poster.startsWith('http')) poster = BASE_URL + poster;
      const rating = $(el).find('.text-xs.font-semibold').text().trim() || null;
      const downloadHref = $(el).find('a[href*="/download"]').attr('href') || null;

      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
        const slug = cleanSlug(fullUrl);
        results.push({
          title,
          alt_title: altTitle,
          slug,
          poster,
          rating,
          url: fullUrl,
          download_url: downloadHref ? (downloadHref.startsWith('http') ? downloadHref : BASE_URL + downloadHref) : null
        });
      }
    });

    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: true,
      query: keyword,
      page: parseInt(page, 10),
      total: results.length,
      results
    };
  } catch (err) {
    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: false,
      error: err.message
    };
  }
}

async function detail(target) {
  try {
    const slug = cleanSlug(target);
    const detailUrl = `${BASE_URL}/anime/${slug}`;
    const res = await client.get(detailUrl);
    const $ = cheerio.load(res.data);

    let schema = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const j = JSON.parse($(el).html());
        if (j['@graph'] && Array.isArray(j['@graph'])) {
          const item = j['@graph'].find(g => g['@type'] === 'TVSeries' || g['@type'] === 'Movie');
          if (item) schema = item;
        }
      } catch (e) {}
    });

    const title = $('h1').first().text().trim() || (schema && schema.name) || slug;
    let poster = $('img[alt="' + title + '"]').attr('src') || $('.poster-skeleton + img').attr('src') || (schema && schema.image && schema.image[0]) || null;
    if (poster && !poster.startsWith('http')) poster = BASE_URL + poster;

    const synopsis = $('.text-gray-300.leading-relaxed').first().text().trim() || (schema && schema.description) || null;

    const genres = [];
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    let rating = $('.bg-purple-600\\/80').text().trim().replace(/⭐\s*/, '') || null;
    if (!rating) {
      const rMatch = $('body').text().match(/⭐\s*([0-9.]+)/);
      if (rMatch) rating = rMatch[1];
    }

    const episodes = [];
    $('#episode-table-wrap a, a[href*="/episode/"]').each((_, el) => {
      const epHref = $(el).attr('href');
      if (epHref && epHref.includes('/episode/')) {
        const fullEpHref = epHref.startsWith('http') ? epHref : BASE_URL + epHref;
        const epNumMatch = fullEpHref.match(/\/episode\/([0-9]+)/);
        const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : null;
        const epTitle = $(el).text().trim().replace(/\s+/g, ' ');
        if (epNum && !episodes.some(e => e.episode === epNum)) {
          episodes.push({
            episode: epNum,
            title: epTitle || `Episode ${epNum}`,
            url: fullEpHref
          });
        }
      }
    });

    episodes.sort((a, b) => a.episode - b.episode);

    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: true,
      title,
      slug,
      poster,
      rating,
      synopsis,
      genres: genres.length > 0 ? genres : (schema && schema.genre) || [],
      url: detailUrl,
      download_page: `${BASE_URL}/anime/${slug}/download`,
      total_episodes: episodes.length,
      episodes
    };
  } catch (err) {
    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: false,
      error: err.message
    };
  }
}

async function dl(target, preferredRes = '720p') {
  try {
    const slug = cleanSlug(target);
    const initialRes = await client.get(`/anime/${slug}/download`, {
      params: { page: 1, ajax: 1 },
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
    });

    if (!initialRes.data || !Array.isArray(initialRes.data.episodes)) {
      return {
        Creator: CREATOR,
        Saluran: SALURAN,
        status: false,
        error: `Could not retrieve download episodes for ${slug}`
      };
    }

    let allEpisodes = [...initialRes.data.episodes];
    const lastPage = initialRes.data.last_page || 1;

    if (lastPage > 1) {
      const pagePromises = [];
      for (let p = 2; p <= lastPage; p++) {
        pagePromises.push(
          client.get(`/anime/${slug}/download`, {
            params: { page: p, ajax: 1 },
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
          }).then(r => r.data.episodes || []).catch(() => [])
        );
      }
      const restPages = await Promise.all(pagePromises);
      restPages.forEach(eps => {
        allEpisodes = allEpisodes.concat(eps);
      });
    }

    allEpisodes.sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));

    const chunks = [];
    const chunkSize = 6;
    for (let i = 0; i < allEpisodes.length; i += chunkSize) {
      chunks.push(allEpisodes.slice(i, i + chunkSize));
    }

    const resolvedEpisodes = [];

    for (const chunk of chunks) {
      const resolvedChunk = await Promise.all(
        chunk.map(async (ep) => {
          const availableResolutions = (ep.resolutions || []).map(r => r.res);
          let chosen = preferredRes;
          if (!availableResolutions.includes(chosen)) {
            chosen = availableResolutions.includes('720p')
              ? '720p'
              : (availableResolutions.includes('1080p') ? '1080p' : (availableResolutions[0] || '480p'));
          }

          const resObj = (ep.resolutions || []).find(r => r.res === chosen) || {};

          try {
            const dlRes = await client.get('/download/url', {
              params: {
                episode_id: ep.id,
                resolution: chosen
              },
              headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `${BASE_URL}/anime/${slug}/download`
              },
              timeout: 10000
            });

            return {
              episode: ep.num,
              episode_id: ep.id,
              resolution: chosen,
              size: resObj.size || null,
              download_url: dlRes.data.url,
              alternates: (dlRes.data.alternates || []).map(a => a.url)
            };
          } catch (e) {
            return {
              episode: ep.num,
              episode_id: ep.id,
              resolution: chosen,
              size: resObj.size || null,
              download_url: null,
              error: e.message
            };
          }
        })
      );
      resolvedEpisodes.push(...resolvedChunk);
    }

    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: true,
      anime: slug,
      total_episodes: resolvedEpisodes.length,
      preferred_resolution: preferredRes,
      episodes: resolvedEpisodes
    };
  } catch (err) {
    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: false,
      error: err.message
    };
  }
}

async function stream(target, epNumber) {
  try {
    const slug = cleanSlug(target);
    const epUrl = `${BASE_URL}/anime/${slug}/episode/${epNumber}`;
    const res = await client.get(epUrl);

    let playerOptions = null;
    const match = res.data.match(/window\.b2PlayerOptions\s*=\s*(\{.+?\});/s);
    if (match) {
      try {
        playerOptions = JSON.parse(match[1]);
      } catch (e) {}
    }

    if (!playerOptions) {
      return {
        Creator: CREATOR,
        Saluran: SALURAN,
        status: false,
        error: `Could not parse video stream data for ${slug} episode ${epNumber}`
      };
    }

    const streams = (playerOptions.gdriveSources || []).map(s => ({
      resolution: s.resolution,
      url: s.url,
      size: s.size
    }));

    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: true,
      title: playerOptions.title,
      slug,
      episode: playerOptions.currentEp || parseInt(epNumber, 10),
      episodeId: playerOptions.episodeId,
      streams
    };
  } catch (err) {
    return {
      Creator: CREATOR,
      Saluran: SALURAN,
      status: false,
      error: err.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('Usage:\n node mirainime.js list [page]\n node mirainime.js search <keyword> [page]\n node mirainime.js detail <slug|url>\n node mirainime.js dl <slug|url> [resolution]\n node mirainime.js stream <slug|url> <episode>');
    process.exit(0);
  }

  const cmd = args[0].toLowerCase();
  let result;

  if (cmd === 'list') {
    result = await list(parseInt(args[1], 10) || 1);
  } else if (cmd === 'search') {
    if (!args[1]) {
      console.log('Usage:\n node mirainime.js search <keyword> [page]');
      process.exit(0);
    }
    result = await search(args[1], parseInt(args[2], 10) || 1);
  } else if (cmd === 'detail') {
    if (!args[1]) {
      console.log('Usage:\n node mirainime.js detail <slug|url>');
      process.exit(0);
    }
    result = await detail(args[1]);
  } else if (cmd === 'dl' || cmd === 'download') {
    if (!args[1]) {
      console.log('Usage:\n node mirainime.js dl <slug|url> [resolution]');
      process.exit(0);
    }
    result = await dl(args[1], args[2] || '720p');
  } else if (cmd === 'stream' || cmd === 'play') {
    if (!args[1] || !args[2]) {
      console.log('Usage:\n node mirainime.js stream <slug|url> <episode>');
      process.exit(0);
    }
    result = await stream(args[1], args[2]);
  } else {
    if (cmd.startsWith('http') || cmd.includes('/anime/')) {
      result = await dl(cmd);
    } else {
      result = await search(args.join(' '));
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { list, search, detail, dl, stream };