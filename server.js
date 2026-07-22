require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getAnimeTitleForUrl, searchAnime, getAnimeEpisodeById } = require('./jikanService');
const { scrapeEpisode, searchAnimeOnWitanime } = require('./witanimeScraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/anime/:malId/episode/:episode', async (req, res) => {
  try {
    const { malId, episode } = req.params;
    const slugOverride = req.query.slug;

    if (!malId || isNaN(malId) || !episode || isNaN(episode)) {
      return res.status(400).json({ error: 'Invalid MAL ID or episode number' });
    }

    let animeInfo = null;
    let slug = slugOverride;

    if (!slugOverride) {
      try {
        animeInfo = await getAnimeTitleForUrl(parseInt(malId));
        slug = animeInfo.slug;
      } catch (e) {
        return res.status(502).json({
          error: 'Failed to fetch anime from Jikan API. Try adding ?slug=anime-title-slug to bypass.'
        });
      }
    }

    let epInfo = null;
    try {
      epInfo = await getAnimeEpisodeById(parseInt(malId), parseInt(episode));
    } catch (e) {}

    const witanimeData = await scrapeEpisode(slug, episode);

    res.json({
      anime: animeInfo ? {
        mal_id: animeInfo.id,
        title: animeInfo.title,
        title_english: animeInfo.title_english,
        title_japanese: animeInfo.title_japanese,
        image: animeInfo.image,
        synopsis: animeInfo.synopsis,
        type: animeInfo.type,
        episodes: animeInfo.episodes,
        status: animeInfo.status,
        score: animeInfo.score,
        year: animeInfo.year,
        genres: animeInfo.genres
      } : { mal_id: parseInt(malId), slug: slugOverride },
      episode: {
        number: parseInt(episode),
        title: witanimeData.title,
        jikan_title: epInfo?.title || null,
        aired: epInfo?.aired || null,
        score: epInfo?.score || null,
        filler: epInfo?.filler || null,
        recap: epInfo?.recap || null
      },
      watchServers: witanimeData.watchServers,
      downloadLinks: witanimeData.downloadLinks,
      episodeList: witanimeData.episodeList,
      navigation: {
        animePageUrl: witanimeData.animePageUrl,
        prevEpisode: witanimeData.prevEpisode,
        nextEpisode: witanimeData.nextEpisode
      }
    });

  } catch (error) {
    console.error('Error:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Missing search query parameter "q"' });
    }

    let results = [];
    try {
      const jikanResults = await searchAnime(q);
      results = jikanResults.map(anime => ({
        mal_id: anime.mal_id,
        title: anime.title,
        title_english: anime.title_english,
        title_japanese: anime.title_japanese,
        image: anime.images?.jpg?.large_image_url || null,
        type: anime.type,
        episodes: anime.episodes,
        status: anime.status,
        score: anime.score,
        year: anime.year,
        synopsis: anime.synopsis ? anime.synopsis.substring(0, 300) + '...' : null,
        slug: (anime.title_english || anime.title).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
      }));
    } catch (jikanErr) {
      console.log('Jikan search failed, falling back to witanime search');
    }

    if (results.length === 0) {
      const witanimeResults = await searchAnimeOnWitanime(q);
      results = witanimeResults.map((r, i) => ({
        mal_id: null,
        title: r.title,
        title_english: r.title,
        title_japanese: null,
        image: r.image,
        type: r.type,
        slug: r.url ? r.url.split('/anime/')[1]?.replace(/\/$/, '') : r.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
      }));
    }

    res.json({ results });

  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

app.get('/api/episode/:slug/:episode', async (req, res) => {
  try {
    const { slug, episode } = req.params;
    if (!slug || !episode || isNaN(episode)) {
      return res.status(400).json({ error: 'Invalid slug or episode number' });
    }
    const witanimeData = await scrapeEpisode(slug, episode);
    res.json({
      episode: {
        number: parseInt(episode),
        title: witanimeData.title
      },
      watchServers: witanimeData.watchServers,
      downloadLinks: witanimeData.downloadLinks,
      episodeList: witanimeData.episodeList,
      navigation: {
        animePageUrl: witanimeData.animePageUrl,
        prevEpisode: witanimeData.prevEpisode,
        nextEpisode: witanimeData.nextEpisode
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Anime API: http://localhost:${PORT}/api/anime/:malId/episode/:episode`);
    console.log(`Search API: http://localhost:${PORT}/api/search?q=anime_name`);
  });
}

module.exports = app;
