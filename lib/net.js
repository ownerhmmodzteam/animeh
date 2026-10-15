// Util jaringan bersama (proxy embed / stream): cek SSRF ke IP privat.
const dns = require("dns").promises, netm = require("net");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const priv = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(10|127|192\.168|169\.254)\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(ip);
async function safe(u) {
  if (!/^https?:$/.test(u.protocol) || /^localhost$|\.(local|internal|localhost)$/i.test(u.hostname)) return false;
  const ips = netm.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  return ips.length > 0 && !ips.some(i => priv(i.address));
}
module.exports = { safe, UA };
