# Nest Nime v3 — multi-sumber, dark theme, Vercel serverless

Sumber scraper langsung: **Mirainime**, **AnimeIndo**, **AnimeSail** (logika dari scraper milik user).
Sumber REST API (Sanka Vollerei `/anime/:source/...`): samehadaku, animekuindo, kusonime, nimegami, oploverz, winbu, animasu, alqanime, animekompi, kura — adapter di `lib/sources/sanka.js`.
Debug respons asli API: `/api/anime?src=samehadaku&action=raw&path=/home` (ganti `SANKA_BASE` lewat env var kalau domain berubah).
Tidak ada database / data statis: semua data di-scrape live dan di-cache 5 menit.

## Struktur
- `public/index.html` — UI dark (skeleton, hero, detail, player video/iframe, favorit, riwayat, pemilih sumber)
- `api/anime.js` — satu router: `?src=mirainime|animeindo|animesail&action=home|search|detail|episode|download|sources`
- `api/embed.js` — mode proxy iframe (untuk player yang memblokir iframe / butuh Referer sumber; terisolasi CSP sandbox, blokir IP privat)
- `lib/norm.js` — normalisasi semua data: URL (https, //, data:), iframe (URL/HTML/ter-escape/base64), judul, nomor episode, stream (iframe/video/hls)
- `api/img.js` — proxy poster (fallback kalau hotlink diblokir; hanya host sumber)
- `lib/sources/*.js` — scraper per sumber (cheerio): `home, search, detail, episode, (download)`
- `lib/http.js` — fetch + cache + retry
- `server.js` — server lokal (public/ + /api/*) untuk Termux/VPS

## Jalankan
```
npm install
npm start               # http://localhost:3000
```
Vercel: `vercel` / `vercel --prod`. Root Directory = folder yang berisi `api/` dan `public/`.

## Contoh API
- `/api/anime?src=mirainime&action=home&page=1`
- `/api/anime?src=mirainime&action=search&q=naruto`
- `/api/anime?src=mirainime&action=detail&id=<slug>`
- `/api/anime?src=mirainime&action=episode&id=<slug>:<no>`  → streams[] (video/iframe)
- `/api/anime?src=mirainime&action=download&id=<slug>:<no>` → link download per resolusi
- AnimeIndo/AnimeSail: `id` = path halaman (mis. `/anime/xxx/`), dikembalikan oleh `home`/`search`.
