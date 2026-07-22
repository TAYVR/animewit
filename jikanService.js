const axios = require('axios');

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

async function searchAnime(query) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime`, {
      params: { q: query, limit: 5 }
    });
    return response.data.data;
  } catch (error) {
    throw new Error('Failed to search anime via Jikan API');
  }
}

async function getAnimeById(malId) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime/${malId}/full`);
    return response.data.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new Error('Anime not found in MyAnimeList');
    }
    throw new Error('Failed to fetch anime from Jikan API');
  }
}

async function getAnimeEpisodeById(malId, episodeNumber) {
  try {
    const response = await axios.get(`${JIKAN_BASE_URL}/anime/${malId}/episodes/${episodeNumber}`);
    return response.data.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
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
