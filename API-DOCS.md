# WitAnime API Documentation

## Overview
API that fetches **anime episode** watch servers and download links from [witanime.you](https://witanime.you) using **MyAnimeList (Jikan API)** IDs.

Base URL: `http://localhost:3001`

---

## Endpoints

### 1. Search Anime
```
GET /api/search?q={query}
```

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | اسم الأنمي للبحث |

**Response:**
```json
{
  "results": [
    {
      "mal_id": 21,
      "title": "One Piece",
      "title_english": "One Piece",
      "title_japanese": "ONE PIECE",
      "image": "https://cdn.myanimelist.net/...",
      "type": "TV",
      "episodes": null,
      "status": "Currently Airing",
      "score": 8.73,
      "year": 1999,
      "synopsis": "Barely surviving in a barrel...",
      "slug": "one-piece"
    }
  ]
}
```

**Usage (JS):**
```js
const res = await fetch('http://localhost:3001/api/search?q=naruto');
const data = await res.json();
console.log(data.results);
// -> المصفوفة فيها الأنميات المطابقة مع mal_id و slug
```

---

### 2. Get Episode by MAL ID
```
GET /api/anime/{malId}/episode/{episode}
```

| Param | Type | Description |
|-------|------|-------------|
| `malId` | number | MyAnimeList ID (مثال: 21 = One Piece) |
| `episode` | number | رقم الحلقة |

**Optional Query:**
| Query | Description |
|-------|-------------|
| `slug` | تجاوز Jikan API إذا كان مشغولاً. استخدم `slug` مباشر |

**Response:**
```json
{
  "anime": {
    "mal_id": 21,
    "title": "One Piece",
    "title_english": "One Piece",
    "image": "https://cdn.myanimelist.net/...",
    "synopsis": "...",
    "type": "TV",
    "score": 8.73
  },
  "episode": {
    "number": 1170,
    "title": "One Piece الحلقة 1170"
  },
  "watchServers": [
    {
      "id": "0",
      "name": "yonaplay - multi",
      "isActive": false,
      "iframeUrl": "https://yonaplay.net/embed.php?id=22874"
    },
    {
      "id": "4",
      "name": "streamwish - FHD",
      "isActive": false,
      "iframeUrl": "https://hgcloud.to/e/7a1h3syse6y6"
    }
  ],
  "downloadLinks": [
    {
      "url": "https://www.mediafire.com/...",
      "provider": "mediafire",
      "quality": "الجودة المتوسطة SD",
      "index": 0
    },
    {
      "url": "https://gofile.io/d/...",
      "provider": "gofile",
      "quality": "الجودة العالية HD",
      "index": 4
    }
  ],
  "episodeList": [
    { "number": 1, "url": "https://witanime.you/episode/...", "isActive": false },
    { "number": 2, "url": "https://witanime.you/episode/...", "isActive": false },
    { "number": 3, "url": "https://witanime.you/episode/...", "isActive": true }
  ],
  "navigation": {
    "animePageUrl": "https://witanime.you/anime/one-piece/",
    "prevEpisode": "https://witanime.you/episode/...",
    "nextEpisode": null
  }
}
```

**مثال مع تجاوز Jikan (إذا كان مشغول):**
```
GET /api/anime/21/episode/1170?slug=one-piece
```

**Usage (JS):**
```js
async function loadEpisode(malId, ep) {
  const res = await fetch(`http://localhost:3001/api/anime/${malId}/episode/${ep}`);
  const data = await res.json();

  // عرض سيرفرات المشاهدة
  data.watchServers.forEach(server => {
    console.log(server.name, '->', server.iframeUrl);
  });

  // روابط التحميل
  data.downloadLinks.forEach(link => {
    console.log(`[${link.quality}] ${link.provider}: ${link.url}`);
  });

  // قائمة الحلقات (للتنقل)
  data.episodeList.forEach(ep => {
    console.log(`الحلقة ${ep.number}${ep.isActive ? ' (الحالية)' : ''}`);
  });
}
loadEpisode(21, 1170);
```

---

### 3. Get Episode by Slug (بدون Jikan)
```
GET /api/episode/{slug}/{episode}
```

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | عنوان الأنمي باللغة الإنجليزية (شرطات) |
| `episode` | number | رقم الحلقة |

**مثال:**
```
GET /api/episode/one-piece/1170
GET /api/episode/naruto/220
GET /api/episode/buchigire-reijou-wa-houfuku-wo-chikaimashita/3
```

**Usage (JS):**
```js
const res = await fetch('http://localhost:3001/api/episode/buchigire-reijou-wa-houfuku-wo-chikaimashita/3');
const data = await res.json();
document.getElementById('iframe-player').src = data.watchServers[0].iframeUrl;
```

---

## Frontend Usage Examples

### 1. Player صفحة (HTML + JS)
```html
<div id="player-container">
  <iframe id="anime-player" width="100%" height="500" allowfullscreen></iframe>
</div>

<div id="server-list"></div>
<div id="download-list"></div>

<script>
async function loadEpisode(malId, episode) {
  const res = await fetch(`http://localhost:3001/api/anime/${malId}/episode/${episode}`);
  const data = await res.json();

  // تشغيل أول سيرفر تلقائياً
  if (data.watchServers.length > 0) {
    document.getElementById('anime-player').src = data.watchServers[0].iframeUrl;
  }

  // عرض كل السيرفرات
  const serverDiv = document.getElementById('server-list');
  serverDiv.innerHTML = data.watchServers.map(s => `
    <button onclick="document.getElementById('anime-player').src='${s.iframeUrl}'">
      ${s.name}
    </button>
  `).join('');

  // روابط التحميل
  const downloadDiv = document.getElementById('download-list');
  downloadDiv.innerHTML = data.downloadLinks.map(d => `
    <a href="${d.url}" target="_blank">
      [${d.quality}] ${d.provider}
    </a>
  `).join('');
}

loadEpisode(21, 1170);
</script>
```

### 2. قائمة الأنمي + البحث
```js
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', async () => {
  const res = await fetch(`http://localhost:3001/api/search?q=${searchInput.value}`);
  const data = await res.json();

  const list = document.getElementById('anime-list');
  list.innerHTML = data.results.map(anime => `
    <div class="anime-card" onclick="selectAnime(${anime.mal_id}, '${anime.slug}')">
      <img src="${anime.image}" alt="${anime.title}" />
      <h3>${anime.title}</h3>
      <p>${anime.type} • ${anime.score || 'N/A'}</p>
    </div>
  `).join('');
});
```

### 3. React Component (مثال)
```jsx
import { useState, useEffect } from 'react';

function AnimePlayer({ malId, episode }) {
  const [data, setData] = useState(null);
  const [currentServer, setCurrentServer] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/anime/${malId}/episode/${episode}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        if (data.watchServers.length > 0) {
          setCurrentServer(data.watchServers[0].iframeUrl);
        }
      });
  }, [malId, episode]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>{data.anime.title} - الحلقة {data.episode.number}</h2>

      <iframe src={currentServer} width="100%" height="500" allowFullScreen />

      <div>
        {data.watchServers.map(s => (
          <button key={s.id} onClick={() => setCurrentServer(s.iframeUrl)}>
            {s.name}
          </button>
        ))}
      </div>

      <h3>روابط التحميل</h3>
      <div>
        {data.downloadLinks.map((d, i) => (
          <a key={i} href={d.url} target="_blank">
            [{d.quality}] {d.provider}
          </a>
        ))}
      </div>
    </div>
  );
}
```

### 4. الحصول على الـ Slug من عنوان الأنمي
```js
function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// مثال:
titleToSlug('One Piece'); // -> 'one-piece'
titleToSlug('Naruto: Shippuden'); // -> 'naruto-shippuden'
```

**ملاحظة:** الـ slug هو نفس الاسم الإنجليزي للأنمي بدون مسافات (شرطات بدلها). إذا ما ضبط معك، استخدم `/api/search` لتعرف الـ slug الصحيح.

---

## Tips

- **بدون مفتاح API**: Jikan API مجاني وما يحتاج أي مفتاح
- **تجاوز Jikan**: إذا Jikan مشغول (504)، استخدم `?slug=...` أو endpoint `/api/episode/:slug/:episode`
- **تحديث ip**: بدّل `localhost:3001` بعنوان السيرفر عند النشر
- **قائمة الحلقات**: `episodeList` في الرد تحتوي على روابط Base64 للحلقات الأخرى
