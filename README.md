# Nest Anime — Multi-source

Next.js anime catalog designed for Vercel Serverless. All available scraper providers are queried in parallel for latest and search results; provider names are not shown in the UI. Provider identity is kept internally per result so detail and episode requests use the correct scraper.

## Local

Requires Node.js 18.18 or newer.

```bash
npm install
npm run dev
```

## Vercel

Set the Vercel Root Directory to the folder containing this `package.json`, `pages/`, and `lib/`. Use the Next.js preset, `npm run build`, and the default output directory. Install Command may be left at Vercel's automatic default, or set to `npm install`.

## Important

Scraper availability depends on upstream websites, anti-bot behavior, and serverless time limits. Latest listing is supported by the providers that expose a latest/list command; search queries are sent to every provider that supports search. If one provider fails, successful providers still populate the catalog. No provider name is exposed in the interface.

Image loading uses async decoding, eager loading for the first visible cards, and lazy loading for later cards. Broken images are hidden so the card layout remains usable.

The custom player is used only for direct video URLs; iframe embeds are shown as iframes. Quality options are only available when the scraper actually returns multiple quality URLs.
