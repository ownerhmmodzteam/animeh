# Nest Stream — Anime-only + Vercel

## Isi
- `animanga.html`: UI asal yang dipangkas dari tampilan Manhwa.
- `config.js`: daftar sumber anime saja.
- `api/proxy.js`: serverless proxy untuk Sanka REST API, allowlist path dan timeout.
- `api/scrape.js`: serverless HTML scraper generik untuk sumber anime yang didaftarkan.
- `scrapers/`: file scraper yang disertakan pengguna sebagai referensi/legacy.

## Deploy
1. Push folder ini ke repository Git.
2. Import repository di Vercel, Framework Preset: Other.
3. Build Command kosong; Output Directory kosong (root).
4. Deploy.

Node.js 20+ diperlukan. Dependency `cheerio` dipasang oleh Vercel dari `package.json`.

## API
- `/api/proxy?path=%2Fanime%2Fhome`
- `/api/proxy?path=%2Fanime%2Fsamehadaku%2Fongoing&page=1`
- `/api/scrape?source=mirainime`
- `/api/scrape?source=mirainime&url=https%3A%2F%2Fmirainime.com%2Fanime%2F...`

`api/proxy` membatasi upstream ke `https://www.sankavollerei.web.id` agar tidak menjadi open proxy. `api/scrape` membatasi domain ke daftar sumber di dalam file.

## Catatan integrasi
Frontend utama tetap memakai bentuk endpoint Sanka yang sudah ada. Scraper HTML adalah endpoint server-side terpisah untuk sumber yang memerlukan parsing HTML; struktur situs pihak ketiga dapat berubah dan selector generik mungkin perlu disesuaikan. Pengujian live memerlukan deploy dan akses ke sumber upstream.
