const axios = require('axios');
const cheerio = require('cheerio');

const WITANIME_BASE_URL = 'https://witanime.you';
const PROXY_URL = process.env.PROXY_URL || '';
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY || '';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Referer': WITANIME_BASE_URL + '/',
  'Sec-Ch-Ua': '"Not)A;Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Dnt': '1'
};

function xorDecrypt(hexStr, secret) {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ secret.charCodeAt(i % secret.length));
  }
  return out;
}

function decodeServerUrl(encodedStr, config) {
  const reversed = encodedStr.split('').reverse().join('');
  const cleaned = reversed.replace(/[^A-Za-z0-9+/=]/g, '');
  const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
  const indexKey = Buffer.from(config.k, 'base64').toString('utf-8');
  const offset = config.d[parseInt(indexKey, 10)];
  return decoded.slice(0, decoded.length - offset);
}

function parseResourceRegistry($) {
  const scripts = $('script').toArray();
  let zH = null, zW = null;

  for (const script of scripts) {
    const html = $(script).html() || '';
    const zhMatch = html.match(/var\s+_zH\s*=\s*"([^"]+)"/);
    const zwMatch = html.match(/var\s+_zW\s*=\s*"([^"]+)"/);
    if (zhMatch) zH = zhMatch[1];
    if (zwMatch) zW = zwMatch[1];
    if (zH && zW) break;
  }

  if (!zH || !zW) return null;

  const registry = JSON.parse(Buffer.from(zH, 'base64').toString('utf-8'));
  const configs = JSON.parse(Buffer.from(zW, 'base64').toString('utf-8'));

  return { registry, configs };
}

function parseDownloadRegistry($) {
  const scripts = $('script').toArray();
  let m = null, t = null, s = null, a = null;
  const pArrays = {};

  for (const script of scripts) {
    const html = $(script).html() || '';
    if (!m) {
      const mMatch = html.match(/var\s+_m\s*=\s*({[^}]+})/);
      if (mMatch) m = JSON.parse(mMatch[1]);
    }
    if (!t) {
      const tMatch = html.match(/var\s+_t\s*=\s*({[^}]+})/);
      if (tMatch) t = JSON.parse(tMatch[1]);
    }
    if (!s) {
      const sMatch = html.match(/var\s+_s\s*=\s*(\[[^\]]+\])/);
      if (sMatch) s = JSON.parse(sMatch[1]);
    }
    if (!a) {
      const aMatch = html.match(/var\s+_a\s*=\s*(\[[^\]]+\])/);
      if (aMatch) a = JSON.parse(aMatch[1]);
    }
    const pMatch = html.match(/var\s+(_p(\d+))\s*=\s*(\[[^\]]+\])/g);
    if (pMatch) {
      for (const pm of pMatch) {
        const parts = pm.match(/_p(\d+)\s*=\s*(\[[^\]]+\])/);
        if (parts) {
          pArrays[parseInt(parts[1])] = JSON.parse(parts[2]);
        }
      }
    }
    if (m && t && s && a && Object.keys(pArrays).length > 0) break;
  }

  if (!m || !t || !s) return null;

  const secret = Buffer.from(m.r, 'base64').toString('utf-8');
  const count = parseInt(t.l);
  const cache = [];

  for (let i = 0; i < count; i++) {
    const chunks = pArrays[i];
    if (!chunks) continue;
    const seqRaw = s[i];
    const seq = JSON.parse(xorDecrypt(seqRaw, secret));
    const decrypted = chunks.map(chunk => xorDecrypt(chunk, secret));
    const arranged = [];
    for (let j = 0; j < seq.length; j++) {
      arranged[seq[j]] = decrypted[j];
    }
    cache[i] = arranged.join('');
  }

  return cache;
}

async function fetchPage(url) {
  if (SCRAPERAPI_KEY) {
    const proxyUrl = `https://api.scraperapi.com/?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl);
    return response.data;
  }
  const config = { headers: BROWSER_HEADERS };
  if (PROXY_URL) {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    config.httpsAgent = new HttpsProxyAgent(PROXY_URL);
  }
  const response = await axios.get(url, config);
  return response.data;
}

async function scrapeEpisode(slug, episode) {
  try {
    const episodeUrl = `${WITANIME_BASE_URL}/episode/${slug}-%D8%A7%D9%84%D8%AD%D9%84%D9%82%D8%A9-${episode}/`;

    const html = await fetchPage(episodeUrl);
    const $ = cheerio.load(html);

    const title = $('h3').first().text().trim();
    const animeName = title || '';

    const serverItems = [];
    $('#episode-servers li').each((i, el) => {
      const link = $(el).find('a.server-link');
      const serverId = link.attr('data-server-id');
      const name = link.find('.ser').text().trim();
      const isActive = $(el).hasClass('active');
      if (serverId !== undefined) {
        serverItems.push({
          id: serverId,
          name,
          isActive
        });
      }
    });

    const resourceData = parseResourceRegistry($);
    const watchServers = serverItems.map(server => {
      let url = null;
      if (resourceData && resourceData.registry[server.id]) {
        try {
          url = decodeServerUrl(resourceData.registry[server.id], resourceData.configs[server.id]);
        } catch (e) {
          url = null;
        }
      }
      return {
        id: server.id,
        name: server.name,
        isActive: server.isActive,
        iframeUrl: url
      };
    });

    const downloadCache = parseDownloadRegistry($);
    const qualityLabels = [];
    $('.quality-list').each((i, ql) => {
      const label = $(ql).find('li').first().text().trim();
      const links = [];
      $(ql).find('a.download-link').each((j, dl) => {
        const index = $(dl).attr('data-index');
        const provider = $(dl).find('.notice').text().trim();
        links.push({
          index: parseInt(index),
          provider
        });
      });
      qualityLabels.push({ quality: label, links });
    });

    const downloadLinks = [];
    for (const ql of qualityLabels) {
      for (const link of ql.links) {
        let url = null;
        if (downloadCache && downloadCache[link.index]) {
          url = downloadCache[link.index];
        }
        downloadLinks.push({
          url,
          provider: link.provider,
          quality: ql.quality,
          index: link.index
        });
      }
    }

    const prevEpisode = $('.previous-episode a').attr('href') || null;
    const nextEpisode = $('.next-episode a').attr('href') || null;
    const animePageUrl = $('.anime-page-link a').attr('href') || null;

    const episodeList = [];
    $('#ULEpisodesList li').each((i, el) => {
      const link = $(el).find('a');
      const onclick = link.attr('onclick') || '';
      const match = onclick.match(/openEpisode\('([^']+)'\)/);
      if (match) {
        try {
          const epUrl = Buffer.from(match[1], 'base64').toString('utf-8');
          const epMatch = epUrl.match(/-%D8%A7%D9%84%D8%AD%D9%84%D9%82%D8%A9-(\d+)\//);
          const epNum = epMatch ? parseInt(epMatch[1]) : null;
          episodeList.push({
            number: epNum,
            url: epUrl,
            isActive: $(el).hasClass('episode-active')
          });
        } catch (e) {}
      }
    });

    return {
      title,
      animeName,
      animePageUrl,
      watchServers,
      downloadLinks,
      episodeList,
      prevEpisode,
      nextEpisode
    };

  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error('Episode not found on witanime.you');
    }
    throw new Error('Failed to scrape witanime.you: ' + error.message);
  }
}

async function searchAnimeOnWitanime(query) {
  try {
    const html = await fetchPage(`${WITANIME_BASE_URL}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];

    $('.anime-card-container').each((i, el) => {
      const titleEl = $(el).find('.anime-card-title h3 a');
      const linkEl = $(el).find('.anime-card-poster a.overlay');
      const imgEl = $(el).find('.anime-card-poster img');
      const typeEl = $(el).find('.anime-card-type a');

      results.push({
        title: titleEl.text().trim(),
        url: linkEl.attr('href') || titleEl.attr('href'),
        image: imgEl.attr('src'),
        type: typeEl.text().trim()
      });
    });

    return results;
  } catch (error) {
    return [];
  }
}

module.exports = {
  scrapeEpisode,
  searchAnimeOnWitanime
};
