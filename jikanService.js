const axios = require('axios');
const cheerio = require('cheerio');

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TIMEOUT = 8000;
const MAX_RETRIES = 2;

async function fetchWithRetry(url, params = {}, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, {
        params,
        timeout: TIMEOUT,
        headers: { 'Accept-Encoding': 'gzip' }
      });
      return response.data;
    } catch (error) {
      const isLast = i === retries;
      if (isLast) throw error;
      const delay = (i + 1) * 2000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function searchAnimeOnAnilist(query) {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `query ($search: String) {
        Page(page: 1, perPage: 8) {
          media(search: $search, type: ANIME) {
            id
            idMal
            title { romaji english native }
            coverImage { large }
            format
            episodes
            status
            averageScore
            startDate { year }
            description
            genres
          }
        }
      }`,
      variables: { search: query }
    }, { timeout: 8000 });

    const media = response.data?.data?.Page?.media || [];
    return media.map(a => ({
      mal_id: a.idMal,
      title: a.title?.romaji || a.title?.english || '',
      title_english: a.title?.english || a.title?.romaji || '',
      title_japanese: a.title?.native || '',
      image: a.coverImage?.large || null,
      type: a.format,
      episodes: a.episodes,
      status: a.status,
      score: a.averageScore ? a.averageScore / 10 : null,
      year: a.startDate?.year,
      synopsis: a.description ? a.description.replace(/<[^>]*>/g, '').substring(0, 300) + '...' : null,
      genres: a.genres || [],
      slug: (a.title?.english || a.title?.romaji || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    }));
  } catch (error) {
    return [];
  }
}

async function searchAnime(query) {
  try {
    const data = await fetchWithRetry(`${JIKAN_BASE_URL}/anime`, { q: query, limit: 5 });
    return data.data || [];
  } catch (error) {
    const fallback = await searchAnimeOnAnilist(query);
    if (fallback.length > 0) return fallback;
    throw new Error('Failed to search anime via Jikan API');
  }
}

async function getAnimeById(malId) {
  try {
    const data = await fetchWithRetry(`${JIKAN_BASE_URL}/anime/${malId}/full`);
    return data.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error('Anime not found in MyAnimeList');
    }
    throw new Error('Failed to fetch anime from Jikan API');
  }
}

async function getAnimeEpisodeById(malId, episodeNumber) {
  try {
    const data = await fetchWithRetry(
      `${JIKAN_BASE_URL}/anime/${malId}/episodes/${episodeNumber}`
    );
    return data.data;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    throw new Error('Failed to fetch episode from Jikan API');
  }
}

async function getAnimeTitleForUrl(malId) {
  try {
    const anime = await getAnimeById(malId);
    const title = anime.title_english || anime.title || anime.titles?.[0]?.title;
    return {
      id: anime.mal_id,
      title: anime.title,
      title_english: anime.title_english,
      title_japanese: anime.title_japanese,
      slug: title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-'),
      image: anime.images?.jpg?.large_image_url || null,
      synopsis: anime.synopsis,
      type: anime.type,
      episodes: anime.episodes,
      status: anime.status,
      score: anime.score,
      year: anime.year,
      genres: anime.genres?.map(g => g.name) || []
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  searchAnime,
  getAnimeById,
  getAnimeEpisodeById,
  getAnimeTitleForUrl
};
