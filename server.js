// Server lokal: sajikan public/ + route /api/* (handler sama persis dengan Vercel).
// Jalankan: npm install && npm start   (default http://localhost:3000, ganti dengan PORT=8080)
const http = require("http"), fs = require("fs"), path = require("path"), url = require("url");
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webp": "image/webp" };
const routes = { "/api/anime": require("./api/anime.js"), "/api/img": require("./api/img.js") };

http.createServer((req, res) => {
  const u = url.parse(req.url, true), h = routes[u.pathname];
  if (h) {
    req.query = u.query;
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
    return Promise.resolve(h(req, res)).catch(e => { res.statusCode = 500; res.end(String(e)); });
  }
  const f = path.normalize(path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname));
  if (!f.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", MIME[path.extname(f)] || "application/octet-stream");
    res.end(d);
  });
}).listen(PORT, () => console.log(`Nest Nime jalan di http://localhost:${PORT}`));
