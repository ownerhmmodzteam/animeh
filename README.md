# Nest Stream — Full Stack Vercel Serverless

Frontend utama sekarang **`index.html`** (bukan `animanga.html`) dan memakai UI/UX yang berasal dari halaman Animanga sebelumnya: charcoal + lavender, hero carousel, rail terbaru yang bisa digeser, serta grid anime empat kolom. Backend disediakan sebagai Vercel Serverless Functions.

## Deploy ke Vercel

1. Ekstrak ZIP atau push folder ini ke repository Git.
2. Import repository di Vercel.
3. Framework preset: **Other**. Root Directory: folder project ini. Build Command dan Output Directory boleh dikosongkan karena tidak ada build step.
4. Deploy. Vercel akan menyajikan `index.html` sebagai halaman utama dan route di `api/` sebagai serverless functions.

## Jalankan lokal

Membutuhkan Node.js 18+ (disarankan Node 22).

```bash
npm install
npm start
```

Buka `http://localhost:8787`. Untuk meniru routing Vercel, jalankan `npx vercel dev` setelah login/tautkan project.

## Endpoint

- `GET /api/health`
- `GET /api/anime/catalog?type=ongoing`
- `GET /api/anime/catalog?type=latest`
- `GET /api/anime/catalog?type=completed`
- `GET /api/anime/search?q=naruto&page=1`
- `GET /api/anime/detail?provider=mirainime&slug=...`
- `GET /api/anime/episode?provider=mirainime&slug=...&episode=...`

## Cara kerja katalog

Katalog menggabungkan dua halaman dari setiap REST source Sanka yang dikonfigurasi dan dua halaman dari scraper MiraiNime serta AnimeSail. Pencarian juga memeriksa AnimeIndo. Data digabung dan deduplikasi berdasarkan judul normalisasi; nama provider tidak ditampilkan sebagai label UI. CDN Vercel diberi cache header agar upstream tidak dipanggil ulang pada setiap kunjungan.

## Environment variables (opsional)

- `SANKA_API_BASE`: default `https://www.sankavollerei.web.id`
- `ANIME_SOURCES`: daftar source dipisahkan koma; default samehadaku,animekuindo,kusonime,nimegami,oploverz,winbu,animasu,alqanime,animekompi,kura
- `CACHE_TTL_MS`: cache per instance, default 300000

## Catatan penting

- Serverless tidak menjamin memori/cache antar invocation; `Cache-Control: s-maxage` membantu cache bersama di CDN Vercel, tetapi cache CDN dan batas durasi bergantung konfigurasi akun/runtime.
- Scraper bergantung pada HTML situs pihak ketiga yang bisa berubah atau membatasi request. Katalog mungkin tidak lengkap saat upstream gagal.
- Endpoint video dari pihak ketiga tidak selalu bisa diputar di iframe/browser; format, CORS, referer, dan kebijakan sumber menentukan kompatibilitas. Uji playback pada deployment yang aktif.
- Gunakan sumber yang diizinkan dan patuhi ketentuan akses masing-masing layanan.
