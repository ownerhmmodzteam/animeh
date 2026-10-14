# Nest Stream — Full Stack Vercel Serverless

Frontend utama sekarang **`index.html`** (bukan `animanga.html`) dan memakai UI/UX yang berasal dari halaman Animanga sebelumnya: charcoal + lavender, hero carousel, rail terbaru yang bisa digeser, serta grid anime empat kolom. Backend disediakan sebagai Vercel Serverless Functions.

## Tool untuk menjalankan di localhost

**Windows:** klik dua kali `RUN-LOCAL.bat`.

**Android (Termux) / Linux / macOS:** buka terminal di folder project, lalu jalankan:

```bash
chmod +x run-local.sh
./run-local.sh
```

Script akan memeriksa Node.js, memasang dependency jika belum ada, lalu menjalankan server. Di Android/Termux, bila project berada di `/storage/emulated/0/` atau penyimpanan bersama, script otomatis menyalin source ke `$HOME/projects/nest-stream-vercel-local` agar `npm install` dapat membuat symlink tanpa error `EACCES`. Buka `http://localhost:8787` pada browser perangkat yang sama. Hentikan dengan `Ctrl+C`.

Untuk mencoba routing melalui Vercel CLI (lebih mirip deployment), gunakan `RUN-VERCEL-DEV.bat` di Windows atau `./run-vercel-dev.sh` di Termux/Linux. Vercel CLI mungkin meminta login atau link project; untuk sekadar menjalankan lokal, gunakan script localhost biasa.

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
- `GET /api/anime/genres`
- `GET /api/anime/detail?provider=mirainime&slug=...`
- `GET /api/anime/episode?provider=mirainime&slug=...&episode=...`

## Perbaikan versi ini

- Katalog menampilkan cache browser terlebih dahulu ketika sudah pernah dibuka, lalu memperbarui data dan mencoba request lagi saat sumber lambat.
- Halaman Explore menampilkan cache/fallback genre alih-alih panel kosong.
- Normalisasi poster, rating, badge kartu, dan episode menerima beberapa variasi nama field API; daftar episode duplikat dipangkas dan angka episode tidak lagi diambil sembarang dari judul.
- Halaman watch menyajikan daftar alternatif sumber video, menangani direct MP4/WebM/HLS melalui elemen video, dan menyediakan tombol membuka sumber di tab baru saat iframe menolak embed.
- Launcher Termux otomatis menyalin project ke penyimpanan internal ketika ZIP dibuka dari `/storage/emulated/0/`, agar npm tidak gagal saat membuat symlink.

## Cara kerja katalog

Katalog menggabungkan dua halaman dari setiap REST source Sanka yang dikonfigurasi dan dua halaman dari scraper MiraiNime serta AnimeSail. Pencarian juga memeriksa AnimeIndo. Data digabung dan deduplikasi berdasarkan judul normalisasi; nama provider tidak ditampilkan sebagai label UI. CDN Vercel diberi cache header agar upstream tidak dipanggil ulang pada setiap kunjungan. Di browser, katalog terakhir disimpan di localStorage agar bisa tampil lebih cepat saat koneksi lambat; backend mengembalikan hasil parsial dan frontend mencoba ulang beberapa kali.

## Environment variables (opsional)

- `SANKA_API_BASE`: default `https://www.sankavollerei.web.id`
- `ANIME_SOURCES`: daftar source dipisahkan koma; default samehadaku,animekuindo,kusonime,nimegami,oploverz,winbu,animasu,alqanime,animekompi,kura
- `CACHE_TTL_MS`: cache per instance, default 300000

## Catatan penting

- Serverless tidak menjamin memori/cache antar invocation; `Cache-Control: s-maxage` membantu cache bersama di CDN Vercel, tetapi cache CDN dan batas durasi bergantung konfigurasi akun/runtime.
- Scraper bergantung pada HTML situs pihak ketiga yang bisa berubah atau membatasi request. Katalog mungkin tidak lengkap saat upstream gagal.
- Endpoint video pihak ketiga tidak selalu bisa diputar di iframe/browser. UI menyediakan pemilih sumber alternatif dan tombol buka sumber di tab baru; `Forbidden` dari penyedia tidak bisa dijamin hilang dari sisi website. Direct MP4/WebM mencoba memakai elemen video HTML. Format, CORS, referer, dan kebijakan sumber tetap menentukan kompatibilitas. Uji playback pada deployment yang aktif.
- Gunakan sumber yang diizinkan dan patuhi ketentuan akses masing-masing layanan.


## REST API + scraper aggregation notes

The serverless service combines configured Sanka REST catalog/search responses with MiraiNime and AnimeSail catalog/search/detail/episode adapters. AnimeIndo is used for search and its detail/watch adapter where its site permits access. Records are normalized to consistent `title`, `poster`, `url`, `slug`, `score`, `genres`, and provider metadata fields, then deduplicated by normalized title/year. Detail requests try the unified `/api/anime/detail` route for both scraper and Sanka provider records before the browser falls back to direct REST routes. Genre filtering first tries the upstream genre endpoint and then filters the combined catalog locally when genre metadata is present.

External sources can still time out, block requests, change HTML, or deny iframe playback. The application now handles those responses more defensively, but it cannot force a third-party source to return data or allow embedded playback.
