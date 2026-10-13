import { execFile } from "node:child_process";
import path from "node:path";

const SOURCES = new Set(["animesail", "mirainime", "animeindo"]);
const scripts = {
  animesail: "animesail.js",
  mirainime: "mirainime.js",
  animeindo: "animeindo-scrape-muxs37rp.js"
};

function runScraper(source, args) {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), "lib", "scrapers", scripts[source]);
    execFile(process.execPath, [script, ...args], {
      timeout: 55000, maxBuffer: 4 * 1024 * 1024, windowsHide: true
    }, (error, stdout, stderr) => {
      const output = String(stdout || "").trim();
      if (!output) return reject(new Error(error?.killed ? "Scraper timeout" : (stderr || error?.message || "Scraper tidak memberi respons")));
      try {
        const start = output.indexOf("{");
        const end = output.lastIndexOf("}");
        if (start < 0 || end < start) throw new Error("Output scraper bukan JSON");
        const data = JSON.parse(output.slice(start, end + 1));
        if (error && !data.status && !data.results && !data.result) {
          return reject(new Error(data.message || data.error || "Scraper gagal"));
        }
        resolve(data);
      } catch (e) { reject(new Error(e.message || "Gagal membaca respons scraper")); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  if (req.method !== "GET") return res.status(405).json({ error: "Method tidak didukung" });
  const source = String(req.query.source || "mirainime").toLowerCase();
  const action = String(req.query.action || "latest").toLowerCase();
  const q = String(req.query.q || "").trim().slice(0, 120);
  const target = String(req.query.url || req.query.slug || "").trim().slice(0, 700);
  const page = Math.max(1, Math.min(50, Number.parseInt(req.query.page || "1", 10) || 1));
  if (!SOURCES.has(source)) return res.status(400).json({ error: "Sumber tidak valid" });
  try {
    let args;
    if (source === "mirainime") {
      if (action === "search") {
        if (!q) return res.status(400).json({ error: "Masukkan judul anime" });
        args = ["search", q, String(page)];
      } else if (action === "detail") {
        if (!target) return res.status(400).json({ error: "URL/slug anime diperlukan" });
        args = ["detail", target];
      } else if (action === "stream" || action === "episode") {
        if (!target) return res.status(400).json({ error: "URL/slug episode diperlukan" });
        args = ["stream", target, String(req.query.episode || "1")];
      } else args = ["list", String(page)];
    } else if (source === "animesail") {
      if (action === "search") {
        if (!q) return res.status(400).json({ error: "Masukkan judul anime" });
        args = ["search", q, String(page)];
      } else if (action === "detail") {
        if (!target) return res.status(400).json({ error: "URL/slug anime diperlukan" });
        args = ["detail", target];
      } else if (action === "stream" || action === "episode") {
        if (!target) return res.status(400).json({ error: "URL/slug episode diperlukan" });
        args = ["episode", target];
      } else args = ["latest", String(page)];
    } else {
      if (action === "search") {
        if (!q) return res.status(400).json({ error: "Masukkan judul anime" });
        args = ["search", q];
      } else if (action === "detail") {
        if (!target) return res.status(400).json({ error: "URL anime diperlukan" });
        args = ["detail", target];
      } else {
        if (!target) return res.status(400).json({ error: "URL episode diperlukan" });
        args = ["dl", target];
      }
    }
    const data = await runScraper(source, args);
    return res.status(200).json({ source, action, ...data });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Sumber anime sedang tidak tersedia", source, action });
  }
}