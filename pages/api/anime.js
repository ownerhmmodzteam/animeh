import { execFile } from "node:child_process";
import path from "node:path";

const PROVIDERS = {
  mirainime: { file: "mirainime.js", latest: ["list"], search: (q, page) => ["search", q, String(page)], detail: (url) => ["detail", url], stream: (url, ep) => ["stream", url, String(ep || 1)] },
  animesail: { file: "animesail.js", latest: (page) => ["latest", String(page)], search: (q) => ["search", q], detail: (url) => ["detail", url], stream: (url) => ["episode", url] },
  animeindo: { file: "animeindo-scrape-muxs37rp.js", search: (q) => ["search", q], detail: (url) => ["detail", url], stream: (url) => ["dl", url] }
};
const SOURCES = Object.keys(PROVIDERS);
const TIMEOUT_MS = 12000;

function runScraper(source, args) {
  return new Promise((resolve, reject) => {
    const config = PROVIDERS[source];
    if (!config) return reject(new Error("Scraper tidak tersedia"));
    const script = path.join(process.cwd(), "lib", "scrapers", config.file);
    execFile(process.execPath, [script, ...args], {
      timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, NODE_ENV: "production" }
    }, (error, stdout, stderr) => {
      const output = String(stdout || "").trim();
      if (!output) return reject(new Error(error?.killed ? "Sumber terlalu lama merespons" : "Sumber tidak memberi respons"));
      try {
        const start = output.indexOf("{");
        const end = output.lastIndexOf("}");
        if (start < 0 || end < start) throw new Error("Respons sumber tidak valid");
        const data = JSON.parse(output.slice(start, end + 1));
        if (error && !data.status && !data.results && !data.result && !data.data && !Array.isArray(data)) {
          return reject(new Error(data.message || data.error || "Sumber gagal dimuat"));
        }
        resolve(data);
      } catch (e) { reject(new Error(e.message || "Gagal membaca respons sumber")); }
    });
  });
}

function getList(data) {
  if (Array.isArray(data)) return data;
  for (const key of ["results", "result", "items", "anime", "data", "list"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}
function sourceList(source, data) {
  return getList(data).map(item => ({ ...item, __source: source }));
}
function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const title = String(item.title || item.name || item.judul || "").toLowerCase().replace(/[^a-z0-9\p{L}]+/gu, " ").trim();
    const url = String(item.url || item.slug || item.href || "").toLowerCase().replace(/\/$/, "");
    const key = title && url ? `${title}|${url}` : (url || title);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function annotateDetail(source, data) {
  const base = data?.result && !Array.isArray(data.result) ? data.result : data;
  if (!base || typeof base !== "object") return base;
  const episodesKey = ["episodes", "episode_list", "episodeList", "eps"].find(k => Array.isArray(base[k]));
  if (!episodesKey) return { ...base, __source: source };
  return { ...base, __source: source, [episodesKey]: base[episodesKey].map(ep => ({ ...ep, __source: source })) };
}
function buildArgs(source, action, { q, page, url, episode }) {
  const p = PROVIDERS[source];
  if (action === "latest") {
    if (!p.latest) return null;
    return typeof p.latest === "function" ? p.latest(page) : p.latest;
  }
  if (action === "search") return p.search ? p.search(q, page) : null;
  if (action === "detail") return p.detail ? p.detail(url) : null;
  if (action === "stream" || action === "episode") return p.stream ? p.stream(url, episode) : null;
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=180");
  if (req.method !== "GET") return res.status(405).json({ error: "Method tidak didukung" });
  const action = String(req.query.action || "latest").toLowerCase();
  const q = String(req.query.q || "").trim().slice(0, 120);
  const url = String(req.query.url || req.query.slug || "").trim().slice(0, 700);
  const page = Math.max(1, Math.min(20, Number.parseInt(req.query.page || "1", 10) || 1));
  const source = String(req.query.source || "").toLowerCase();
  const episode = String(req.query.episode || "1").slice(0, 12);

  try {
    if (action === "latest" || action === "search") {
      if (action === "search" && !q) return res.status(400).json({ error: "Masukkan judul anime" });
      const tasks = SOURCES.map(async name => {
        const args = buildArgs(name, action, { q, page });
        if (!args) return { items: [], failed: false };
        try {
          const data = await runScraper(name, args);
          return { items: sourceList(name, data), failed: false };
        } catch (error) {
          return { items: [], failed: true };
        }
      });
      const results = await Promise.all(tasks);
      const items = dedupe(results.flatMap(r => r.items));
      if (!items.length) return res.status(502).json({ error: "Belum bisa memuat data. Semua sumber sedang tidak tersedia atau terlalu lama merespons." });
      return res.status(200).json({ action, results: items, total: items.length, partial: results.some(r => r.failed) });
    }

    if (!SOURCES.includes(source)) return res.status(400).json({ error: "Data anime tidak memiliki referensi sumber yang valid" });
    if (!url) return res.status(400).json({ error: "URL anime/episode diperlukan" });
    const args = buildArgs(source, action, { url, episode, page, q });
    if (!args) return res.status(400).json({ error: "Aksi tidak didukung untuk item ini" });
    const data = await runScraper(source, args);
    if (action === "detail") return res.status(200).json({ action, result: annotateDetail(source, data) });
    const base = data?.result && !Array.isArray(data.result) ? data.result : data;
    return res.status(200).json({ action, result: base && typeof base === "object" ? { ...base, __source: source } : base });
  } catch {
    return res.status(502).json({ error: "Sumber sedang tidak tersedia. Coba lagi beberapa saat." });
  }
}
