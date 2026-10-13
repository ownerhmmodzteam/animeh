# Nest Anime

Modern dark-theme anime catalog built with Next.js API routes and designed for Vercel Serverless Functions. The project uses the three scraper scripts supplied with the request.

## Run locally

Requires Node.js 18.18+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

Import this project/repository into Vercel. Framework preset: Next.js. Build command: `npm run build`. No environment variables are required. The API function has a 60-second maximum duration configured in `vercel.json`; actual limits depend on the Vercel plan.

## API

- `/api/anime?source=mirainime&action=latest`
- `/api/anime?source=mirainime&action=search&q=naruto`
- `/api/anime?source=mirainime&action=detail&url=<slug-or-url>`
- `/api/anime?source=mirainime&action=stream&url=<episode-url>`
- `source` can be `mirainime`, `animesail`, or `animeindo`.

Scrapers are third-party website parsers, so upstream markup, rate limits, anti-bot systems, CORS rules, server availability, and Vercel execution limits may affect results. Verify you have permission to access and display content from each source. Do not use this project to bypass access controls.

## Player behavior

The UI detects direct video URLs and renders a custom HTML5 player with centered play/pause, 10-second rewind/forward, speed controls, and a quality selector. Quality switching is only meaningful when the scraper provides alternate quality URLs; the UI does not transcode or manufacture alternate resolutions. When the scraper returns an iframe embed, it uses the iframe directly without wrapping it in the custom video player. Some providers restrict iframe embedding or playback in external sites.
