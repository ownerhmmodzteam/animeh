# Nest Stream — Anime-only + Vercel (fallback build)

## Perubahan
- Frontend mencoba REST API Sanka terlebih dahulu.
- Jika REST API error atau payload kosong, frontend mencoba scraper HTML MiraiNime melalui `/api/scrape` untuk listing/detail/episode yang bisa dipetakan.
- Perbaikan nomor episode fallback: gunakan nomor dari judul bila tersedia, jika tidak gunakan urutan episode, bukan menghitung mundur.
- Endpoint serverless tetap membatasi domain scraper ke daftar allowlist dan proxy REST ke domain Sanka.

## Deploy Vercel
1. Upload seluruh folder ke repository Git.
2. Import repository di Vercel, preset `Other`.
3. Build command kosong; output directory kosong/root.
4. Deploy. Vercel akan memasang dependency dari `package.json`.

## Endpoint
- `/api/proxy?path=%2Fanime%2Fhome`
- `/api/scrape?source=mirainime`
- `/api/scrape?source=mirainime&url=https%3A%2F%2Fmirainime.com%2Fanime%2F...`

## Batasan yang perlu diketahui
Fallback scraper saat ini baru dikonfigurasi untuk MiraiNime sebagai sumber pertama. Selector HTML bisa berubah sewaktu-waktu dan URL halaman episode/video dari tiap situs tidak seragam. Penolakan iframe oleh host video tidak bisa diselesaikan dengan proxy HTML; gunakan server embed yang memang mengizinkan pemutaran. Pengujian statis tidak membuktikan bahwa situs upstream saat ini dapat diakses atau bahwa setiap episode dapat diputar live.
