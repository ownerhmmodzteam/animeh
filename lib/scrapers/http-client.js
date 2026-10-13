// Small fetch-based Axios-compatible client for the scraper scripts.
// Uses Node's built-in fetch so runtime does not depend on the axios package.
function mergeHeaders(...values) {
  const result = {};
  for (const value of values) {
    if (!value) continue;
    if (typeof value.forEach === "function" && typeof value !== "string") {
      value.forEach((v, k) => { result[k] = v; });
    } else {
      Object.assign(result, value);
    }
  }
  return result;
}

async function get(url, config = {}, defaults = {}) {
  const options = { ...defaults, ...config };
  const base = options.baseURL || "";
  const full = new URL(String(url), base || undefined);
  if (options.params && typeof options.params === "object") {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) full.searchParams.set(key, String(value));
    }
  }
  const timeout = Number(options.timeout) > 0 ? Number(options.timeout) : 15000;
  const response = await fetch(full.toString(), {
    method: "GET",
    headers: mergeHeaders(defaults.headers, config.headers || options.headers),
    redirect: "follow",
    signal: AbortSignal.timeout(timeout)
  });
  const text = await response.text();
  let data = text;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    try { data = JSON.parse(text); } catch { data = text; }
  } else if (text && /^[\s]*[\[{]/.test(text)) {
    try { data = JSON.parse(text); } catch { /* keep HTML/text */ }
  }
  const result = { data, status: response.status, statusText: response.statusText, headers: response.headers, config: options, request: null };
  const validateStatus = options.validateStatus || (status => status >= 200 && status < 300);
  if (!validateStatus(response.status)) {
    const error = new Error(`Request failed with status code ${response.status}`);
    error.response = result;
    throw error;
  }
  return result;
}

const axiosCompat = {
  get: (url, config = {}) => get(url, config),
  create: (defaults = {}) => ({
    get: (url, config = {}) => {
      const baseURL = defaults.baseURL || "";
      const absolute = /^https?:\/\//i.test(String(url)) ? String(url) : new URL(String(url), baseURL.endsWith("/") ? baseURL : `${baseURL}/`).toString();
      return get(absolute, { ...defaults, ...config, baseURL: "" }, defaults);
    }
  })
};

module.exports = axiosCompat;
