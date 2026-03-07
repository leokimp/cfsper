// src/utils.ts
var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode((ch.charCodeAt(0) - base + 13) % 26 + base);
  });
}
function safeAtob(input) {
  const str = String(input).replace(/[=]+$/, "");
  if (str.length % 4 === 1) return input;
  let output = "";
  let bc = 0, bs = 0, i = 0;
  while (i < str.length) {
    const ch = str[i++];
    const idx = B64_CHARS.indexOf(ch);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
    }
  }
  return output;
}
function safeBtoa(input) {
  const str = String(input);
  let output = "";
  for (let block = 0, charCode, i = 0, map = B64_CHARS; str.charAt(i | 0) || (map = "=", i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    if (charCode > 255) return input;
    block = block << 8 | charCode;
  }
  return output;
}
function seqRatio(a, b) {
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0) return 1;
  const dp = Array.from({
    length: la + 1
  }, () => new Array(lb + 1).fill(0));
  let best = 0;
  for (let i = 1; i <= la; i++) for (let j = 1; j <= lb; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : 0;
    if (dp[i][j] > best) best = dp[i][j];
  }
  return 2 * best / (la + lb);
}
function jaccardWords(a, b) {
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = (/* @__PURE__ */ new Set([
    ...sa,
    ...sb
  ])).size;
  return union === 0 ? 0 : inter / union;
}
function calcTitleSim(query, candidate) {
  const norm = (s) => s.replace(/&amp;/gi, "&").toLowerCase().replace(/\s*&\s*/g, " and ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.95;
  return Math.max(seqRatio(q, c), jaccardWords(q, c));
}
function parseSize(str) {
  const match = str.match(/([\d.]+)\s*(GB|MB|KB|TB)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4
  };
  return value * (multipliers[unit] ?? 0);
}
function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|B)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  };
  return value * (multipliers[unit] ?? 0);
}
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "Unknown";
  const k = 1024;
  const sizes = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB"
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
function extractText(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}
function extractAllLinks(html) {
  const links = [];
  const regex = new RegExp(`<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\\/a>`, "gis");
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: extractText(match[2])
    });
  }
  return links;
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// src/config.ts
var MAIN_URL = "https://hdhub4u.frl";
var PINGORA_API_URL = "https://search.pingora.fyi/collections/post/documents/search";
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var PROXY_WORKER_URL = "https://stream.leokimpese.workers.dev/";
var CACHE_API_BASE = "https://cache.leokimpese.workers.dev";
var WEBSTREAMR_BASE_URL = "https://webstreamr.hayd.uk/%7B%22gu%22%3A%22on%22%2C%22hi%22%3A%22on%22%2C%22mediaFlowProxyUrl%22%3A%22%22%2C%22mediaFlowProxyPassword%22%3A%22%22%2C%22disableExtractor_doodstream%22%3A%22on%22%2C%22disableExtractor_dropload%22%3A%22on%22%2C%22disableExtractor_fastream%22%3A%22on%22%2C%22disableExtractor_kinoger%22%3A%22on%22%2C%22disableExtractor_lulustream%22%3A%22on%22%2C%22disableExtractor_mixdrop%22%3A%22on%22%2C%22disableExtractor_savefiles%22%3A%22on%22%2C%22disableExtractor_streamembed%22%3A%22on%22%2C%22disableExtractor_streamtape%22%3A%22on%22%2C%22disableExtractor_streamup%22%3A%22on%22%2C%22disableExtractor_supervideo%22%3A%22on%22%2C%22disableExtractor_uqload%22%3A%22on%22%2C%22disableExtractor_vidora%22%3A%22on%22%2C%22disableExtractor_vidsrc%22%3A%22on%22%2C%22disableExtractor_vixsrc%22%3A%22on%22%2C%22disableExtractor_voe%22%3A%22on%22%2C%22disableExtractor_youtube%22%3A%22on%22%7D";
var ENABLE_GOOGLE_DRIVE_PROXY = true;
var DEFAULT_TTL = 3600;
var MIN_QUALITY = 1080;
var ALLOWED_LANGUAGES = [
  "hindi",
  "gujarati",
  "english"
];
var BLOCKED_QUALITY_PATTERNS = [
  "360p",
  "480p",
  "576p",
  "720p",
  "cam",
  "camrip",
  "hdcam",
  "ts",
  "telesync",
  "tc",
  "telecine",
  "dvdscr",
  "screener",
  "r5",
  "r6"
];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "",
  Origin: ""
};
function initHeaders() {
  HEADERS.Referer = `${MAIN_URL}/`;
  HEADERS.Origin = MAIN_URL;
}
initHeaders();
function setMainUrl(newUrl) {
  MAIN_URL = newUrl;
  HEADERS.Referer = `${MAIN_URL}/`;
  HEADERS.Origin = MAIN_URL;
}
var domainLastUpdated = 0;
var domainUpdateRunning = false;
var DOMAIN_UPDATE_INTERVAL = 36e5;
function triggerDomainUpdate() {
  const now = Date.now();
  if (now - domainLastUpdated < DOMAIN_UPDATE_INTERVAL || domainUpdateRunning) return;
  domainUpdateRunning = true;
  performDomainUpdate().then(() => {
    domainUpdateRunning = false;
  }).catch((err) => {
    console.log("[Domain] Background error:", err.message);
    domainUpdateRunning = false;
  });
}
async function performDomainUpdate() {
  try {
    console.log("[Domain] Checking for new domain...");
    const res = await fetch(DOMAINS_URL);
    const data = await res.json();
    if (data?.HDHUB4u && MAIN_URL !== data.HDHUB4u) {
      console.log("[Domain] \u2713 Updated:", data.HDHUB4u);
      setMainUrl(data.HDHUB4u);
    } else {
      console.log("[Domain] \u2713 Unchanged");
      HEADERS.Referer = `${MAIN_URL}/`;
      HEADERS.Origin = MAIN_URL;
    }
    domainLastUpdated = Date.now();
  } catch (err) {
    console.log("[Domain] Error:", err.message);
    HEADERS.Referer = `${MAIN_URL}/`;
    HEADERS.Origin = MAIN_URL;
  }
}
async function fetchWithRetry(url, customHeaders = {}, maxRetries = 2) {
  const headers = {
    ...HEADERS,
    ...customHeaders
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers
      });
      if (!response.ok && attempt < maxRetries) {
        console.log(`[HTTP] Retry ${attempt + 1}/${maxRetries}:`, url);
        await sleep(1e3 * (attempt + 1));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`[HTTP] Attempt ${attempt + 1} failed, retrying:`, err.message);
      await sleep(1e3 * (attempt + 1));
    }
  }
  throw new Error("Max retries reached");
}
async function fetchText(url, customHeaders = {}) {
  try {
    const res = await fetchWithRetry(url, customHeaders);
    return await res.text();
  } catch (err) {
    console.log("[HTTP] Text fetch error:", err.message);
    return "";
  }
}
async function fetchRedirectUrl(url, customHeaders = {}) {
  try {
    const headers = {
      ...HEADERS,
      ...customHeaders
    };
    const response = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "manual"
    });
    const location = response.headers.get("hx-redirect") || response.headers.get("location") || response.headers.get("Location");
    if (!location) return null;
    if (location.startsWith("http")) return location;
    return new URL(url).origin + location;
  } catch (err) {
    console.log("[HTTP] Redirect fetch error:", err.message);
    return null;
  }
}
function shouldProxyUrl(url) {
  if (!ENABLE_GOOGLE_DRIVE_PROXY || !url) return false;
  return [
    "video-downloads.googleusercontent.com",
    "drive.google.com/uc",
    "docs.google.com/uc"
  ].some((p) => url.includes(p));
}
function transformToProxyUrl(url) {
  if (!shouldProxyUrl(url)) return url;
  try {
    const proxied = `${PROXY_WORKER_URL}?l=${url}`;
    console.log("[PROXY] Transformed URL to proxy");
    return proxied;
  } catch (err) {
    console.log("[PROXY] Error:", err.message);
    return url;
  }
}

// src/cache.ts
function cacheKey(tmdbId, mediaType, season, episode) {
  return `${tmdbId}_${mediaType}_${season ?? "null"}_${episode ?? "null"}`;
}
async function getCachedStreams(tmdbId, mediaType, season, episode) {
  const key = cacheKey(tmdbId, mediaType, season, episode);
  try {
    console.log("[CACHE] Fetching:", key);
    const res = await fetch(`${CACHE_API_BASE}/${key}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (res.status === 404) {
      console.log("[CACHE] Miss:", key);
      return null;
    }
    if (!res.ok) {
      console.log("[CACHE] Error:", res.status);
      return null;
    }
    const data = await res.json();
    if (!data?.streams || !Array.isArray(data.streams)) {
      console.log("[CACHE] Invalid format");
      return null;
    }
    console.log(`[CACHE] Hit: ${key} (${data.streams.length} streams)`);
    return data.streams;
  } catch (err) {
    console.log("[CACHE] Fetch error:", err.message);
    return null;
  }
}
async function setCachedStreams(tmdbId, mediaType, season, episode, streams, ttl = DEFAULT_TTL) {
  const key = cacheKey(tmdbId, mediaType, season, episode);
  try {
    console.log(`[CACHE] Saving: ${key} (${streams.length} streams, TTL: ${ttl}s)`);
    const res = await fetch(CACHE_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key,
        streams,
        ttl,
        metadata: {
          tmdbId,
          mediaType,
          season,
          episode,
          timestamp: Date.now()
        }
      })
    });
    if (!res.ok) {
      console.log("[CACHE] Save failed:", res.status);
      return false;
    }
    console.log("[CACHE] Saved \u2713");
    return true;
  } catch (err) {
    console.log("[CACHE] Save error:", err.message);
    return false;
  }
}
async function clearAllCache() {
  try {
    const res = await fetch(`${CACHE_API_BASE}/clearall`, {
      method: "POST"
    });
    if (res.ok) {
      console.log("[CACHE] All cleared \u2713");
      return true;
    }
    console.log("[CACHE] Clear failed:", res.status);
    return false;
  } catch (err) {
    console.log("[CACHE] Clear error:", err.message);
    return false;
  }
}
async function getCacheStats() {
  try {
    const res = await fetch(`${CACHE_API_BASE}/stats`, {
      method: "GET"
    });
    if (!res.ok) return {
      totalEntries: 0,
      totalSize: 0,
      error: "Failed to fetch stats"
    };
    return await res.json();
  } catch (err) {
    return {
      totalEntries: 0,
      totalSize: 0,
      error: err.message
    };
  }
}

// src/search.ts
async function performSingleSearch(query) {
  const cleanQuery = query.replace(/Season \d+/i, "").trim();
  const params = new URLSearchParams({
    q: cleanQuery,
    query_by: "post_title",
    sort_by: "sort_by_date:desc"
  });
  try {
    const res = await fetchWithRetry(`${PINGORA_API_URL}?${params}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      console.log(`[Search] Pingora hits for "${query}":`, data.hits?.length ?? 0);
      if (data.hits?.length) {
        return data.hits.map((hit) => ({
          title: hit.document.post_title,
          url: MAIN_URL + hit.document.permalink,
          source: "Pingora",
          searchedTitle: query
        }));
      }
    } else {
      console.log(`[Search] Pingora returned non-JSON (${res.status}), falling back to native`);
    }
  } catch (err) {
    console.log(`[Search] Pingora error for "${query}":`, err.message);
  }
  try {
    console.log(`[Search] Native fallback for "${cleanQuery}"`);
    const nativeRes = await fetchWithRetry(`${MAIN_URL}/?s=${encodeURIComponent(cleanQuery)}`);
    const html = await nativeRes.text();
    const articleRegex = /<article[^>]*>.*?<\/article>/gis;
    const articles = html.match(articleRegex) ?? [];
    console.log(`[Search] Native articles for "${cleanQuery}":`, articles.length);
    return articles.flatMap((article) => {
      const m = article.match(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/i);
      if (!m) return [];
      const url = m[1];
      const title = m[2].replace(/<[^>]*>/g, "").trim();
      if (!url || !title) return [];
      return [
        {
          title,
          url,
          source: "Native",
          searchedTitle: query
        }
      ];
    });
  } catch (err) {
    console.log(`[Search] Native fallback error for "${query}":`, err.message);
    return [];
  }
}
async function performParallelSearch(queries, year) {
  console.log("[Search] Queue:", queries);
  const allResults = await Promise.all(queries.map((q) => performSingleSearch(q)));
  const scored = [];
  for (let i = 0; i < allResults.length; i++) {
    for (const r of allResults[i]) {
      const titleScore = calcTitleSim(queries[i], r.title);
      if (titleScore < 0.62) continue;
      let rankScore = titleScore;
      if (year) {
        const rYear = (r.title.match(/\b(19|20)\d{2}\b/) ?? [])[0];
        if (rYear) {
          const delta = Math.abs(parseInt(year) - parseInt(rYear));
          if (delta === 0) rankScore = Math.min(1, rankScore + 0.1);
          else if (delta > 3) rankScore *= 0.7;
        }
      }
      if (rankScore < 0.62) continue;
      scored.push({
        ...r,
        titleScore,
        rankScore,
        usedQuery: queries[i]
      });
    }
  }
  if (!scored.length) return {
    results: [],
    usedTitle: ""
  };
  scored.sort((a, b) => b.rankScore - a.rankScore);
  const seen = /* @__PURE__ */ new Set();
  const unique = scored.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  return {
    results: unique,
    usedTitle: unique[0].usedQuery
  };
}

// src/pageParser.ts
function isValidStreamLink(href, rawText) {
  if (!href) return false;
  const hrefLower = href.toLowerCase();
  const text = (rawText ?? "").replace(/<[^>]+>/g, "").trim().toLowerCase();
  const isBadUrl = hrefLower.startsWith("/") || hrefLower.startsWith("#") || hrefLower.includes("hdhub4u") || hrefLower.includes("4khdhub") || hrefLower.includes("discord") || hrefLower.includes("themoviedb.org") || hrefLower.includes("imdb.com") || hrefLower.includes("{{") || hrefLower.includes("cdn-cgi");
  const isBadText = text.includes("watch") || text.includes("pack") || text.includes("480p") || text.includes("720p") || text === "";
  return !isBadUrl && !isBadText;
}
function extractLinksWithMetadata(html, mediaType, season, episode) {
  const result = [];
  if (mediaType === "movie") {
    const regex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (isValidStreamLink(m[1], m[2])) result.push({
        url: m[1],
        requiresQualityCheck: false,
        preFilteredQuality: true
      });
    }
  } else if (mediaType === "tv" && season && episode) {
    const targetEp = parseInt(String(episode));
    const nextEp = targetEp + 1;
    const startRx = new RegExp(`<(?:h[1-6]|strong|span|a)[^>]*>\\s*(?:Episode|Ep|E|EPiSODE)\\s*0?${targetEp}\\b`, "i");
    const nextRx = new RegExp(`<(?:h[1-6]|strong|span|a)[^>]*>\\s*(?:Episode|Ep|E|EPiSODE)\\s*0?${nextEp}\\b`, "i");
    const startMatch = html.match(startRx);
    if (!startMatch) return dedup(result);
    const startIdx = startMatch.index;
    const nextMatch = html.substring(startIdx + 10).match(nextRx);
    const endIdx = nextMatch ? startIdx + 10 + nextMatch.index : startIdx + 6e3;
    const slice = html.substring(startIdx, endIdx);
    console.log(`[TV] Episode ${targetEp} slice: ${slice.length} chars`);
    if (/\b(1080p|2160p|4k|uhd|720p|480p)\b/i.test(slice)) {
      console.log("[TV] Quality labels in block \u2014 filtering at HTML stage");
      const qualityRx = /\b(720p|480p|360p|1080p|2160p|4k|uhd)\b/gi;
      const markers = [];
      let qm;
      qualityRx.lastIndex = 0;
      while ((qm = qualityRx.exec(slice)) !== null) {
        markers.push({
          quality: qm[1].toLowerCase(),
          index: qm.index,
          isHighQuality: /1080p|2160p|4k|uhd/i.test(qm[1])
        });
      }
      console.log(`[TV] ${markers.length} quality markers`);
      for (let i = 0; i < markers.length; i++) {
        const mk = markers[i];
        if (!mk.isHighQuality) {
          console.log(`[TV] Skip low quality: ${mk.quality}`);
          continue;
        }
        const zoneEnd = markers[i + 1]?.index ?? slice.length;
        const zone = slice.substring(mk.index, zoneEnd);
        const zoneLinks = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
        let lm;
        let found = 0;
        while ((lm = zoneLinks.exec(zone)) !== null) {
          if (isValidStreamLink(lm[1], lm[2])) {
            found++;
            result.push({
              url: lm[1],
              requiresQualityCheck: false,
              preFilteredQuality: true
            });
          }
        }
        if (found === 0) console.log("[TV] No links in zone");
      }
    } else {
      console.log("[TV] No quality labels \u2014 quality checked during extraction");
      const linkRx = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let lm;
      while ((lm = linkRx.exec(slice)) !== null) {
        if (isValidStreamLink(lm[1], lm[2])) result.push({
          url: lm[1],
          requiresQualityCheck: true,
          preFilteredQuality: false
        });
      }
    }
  }
  return dedup(result);
}
function dedup(items) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
function extractLinks(html, mediaType, season, episode) {
  return extractLinksWithMetadata(html, mediaType, season, episode).map((m) => m.url);
}

// src/filter.ts
function extractQuality(streamName) {
  const lower = streamName.toLowerCase();
  const match = lower.match(/(\d{3,4})p/);
  if (match) return parseInt(match[1]);
  if (/2160p|4k|uhd/.test(lower)) return 2160;
  if (/1080p|fhd/.test(lower)) return 1080;
  return 0;
}
function hasBlockedQuality(streamName) {
  for (const pattern of BLOCKED_QUALITY_PATTERNS) {
    if (new RegExp(`\\b${pattern}\\b`, "i").test(streamName)) return true;
  }
  const quality = extractQuality(streamName);
  return quality > 0 && quality < MIN_QUALITY;
}
var BLOCKED_LANGS = [
  "telugu",
  "tamil",
  "kannada",
  "malayalam"
];
var ALLOWED_BINGE = [
  "_hi",
  "_gu",
  "_en"
];
function shouldFilterStream(stream) {
  const name = (stream.name ?? "").toLowerCase();
  const title = (stream.title ?? "").toLowerCase();
  const combined = `${name} ${title}`;
  const bingeGroup = (stream.behaviorHints?.bingeGroup ?? "").toLowerCase();
  if (hasBlockedQuality(combined)) return true;
  const titleHasBlocked = BLOCKED_LANGS.some((l) => title.includes(l));
  const titleHasAllowed = ALLOWED_LANGUAGES.some((l) => title.includes(l));
  if (titleHasBlocked || titleHasAllowed) {
    if (titleHasBlocked && !titleHasAllowed) return true;
  } else {
    const codes = bingeGroup.match(/_([a-z]{2})(?=_|$)/g) ?? [];
    if (codes.length > 0) {
      const last = codes[codes.length - 1];
      const isDuplicateSuffix = codes.filter((c) => c === last).length > 1;
      if (isDuplicateSuffix && !ALLOWED_BINGE.includes(last)) return true;
    }
    if (!ALLOWED_BINGE.some((code) => bingeGroup.includes(code))) return true;
  }
  const quality = extractQuality(combined);
  return quality < MIN_QUALITY;
}
function cleanStreamMetadata(streams) {
  return streams.map((stream) => {
    const name = stream.name ?? "";
    const title = stream.title ?? "";
    const qualityMatch = title.match(/(\d{3,4}p|4k|uhd)/i);
    const cleanName = qualityMatch ? qualityMatch[1].toLowerCase() : name.match(/\d{3,4}p/i)?.[0]?.toLowerCase() ?? "HD";
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch?.[0] ?? "";
    const langMatch = title.match(/hindi|gujarati|english/i);
    const lang = langMatch ? langMatch[0].charAt(0).toUpperCase() + langMatch[0].slice(1).toLowerCase() : "Multi";
    const nameMatch = title.match(/^(.*?)(?=\s*\d{3,4}p|\s*4k|\s*uhd|\s*\b(19|20)\d{2}\b|\n)/i);
    const movieName = nameMatch ? nameMatch[1].replace(/[._]/g, " ").replace(/[()]/g, "").trim() : title.split("\n")[0].trim();
    const cleanTitleLine = `${movieName}  ${year}  ${lang}`.replace(/\s+/g, " ").trim();
    const sizeMatch = title.match(/(\d+(?:\.\d+)?\s*[GM]B)/i);
    return {
      ...stream,
      name: cleanName,
      title: cleanTitleLine,
      size: sizeMatch?.[1] ? sizeMatch[1] : stream.size
    };
  });
}
var Q_ORDER = {
  "2160p": 10,
  "4k": 10,
  "1080p": 8
};
function sortAndNumberStreams(streams) {
  const sorted = [
    ...streams
  ].sort((a, b) => {
    const aKey = a.name.toLowerCase().replace(/\./g, "").replace(/^\d+\.\s*/, "").trim();
    const bKey = b.name.toLowerCase().replace(/\./g, "").replace(/^\d+\.\s*/, "").trim();
    const diff = (Q_ORDER[bKey] ?? 0) - (Q_ORDER[aKey] ?? 0);
    if (diff !== 0) return diff;
    const aSize = parseSizeToBytes(a.size);
    const bSize = parseSizeToBytes(b.size);
    return bSize - aSize;
  });
  return sorted.map((s, i) => ({
    ...s,
    name: `${i + 1}. ${s.name}`
  }));
}

// src/webstreamr.ts
async function webstreamrExtractor(imdbId, mediaType, season, episode) {
  console.log("[WEBSTREAMR] Starting:", {
    imdbId,
    mediaType,
    season,
    episode
  });
  if (!imdbId) return [];
  try {
    const endpoint = mediaType === "movie" ? `/stream/movie/${imdbId}.json` : mediaType === "tv" && season && episode ? `/stream/series/${imdbId}:${season}:${episode}.json` : null;
    if (!endpoint) {
      console.log("[WEBSTREAMR] Invalid params");
      return [];
    }
    const url = `${WEBSTREAMR_BASE_URL}${endpoint}`;
    console.log("[WEBSTREAMR] Fetching:", url);
    const response = await fetchWithRetry(url);
    const data = await response.json();
    if (!data.streams?.length) {
      console.log("[WEBSTREAMR] No streams");
      return [];
    }
    const filtered = data.streams.filter((s) => !shouldFilterStream(s));
    console.log(`[WEBSTREAMR] After filter: ${filtered.length} streams`);
    if (!filtered.length) return [];
    const cleaned = cleanStreamMetadata(filtered);
    return cleaned.map((stream) => ({
      source: "WebStreamr",
      quality: `${stream.name ?? "Unknown"}.`,
      url: stream.url ?? "",
      size: stream.behaviorHints?.videoSize ?? 0,
      filename: stream.title,
      sizeText: String(stream.size ?? "")
    }));
  } catch (err) {
    console.log("[WEBSTREAMR] Error:", err.message);
    return [];
  }
}

// src/resolver.ts
var DIRECT_PATTERNS = [
  /^https?:\/\/pixeldrain\.com\/api\/file\/.*\?download/i,
  /^https?:\/\/([a-z0-9-]+\.)*video-downloads\.googleusercontent\.com/i,
  /^https?:\/\/drive\.google\.com\/uc\?/i,
  /^https?:\/\/docs\.google\.com.*export/i
];
var REDIRECT_PATTERNS = [
  /dl\.php\?link=/i,
  /https?:\/\/[a-z0-9-]+\.hubcdn\.fans\/\?id=/i,
  /https?:\/\/[a-z0-9-]+\.rohitkiskk\.workers\.dev/i,
  /\/go\//i,
  /redirect/i
];
var AD_DOMAINS = [
  "bonuscaf.com",
  "urbanheadline.com",
  "propellerads",
  "adsterra",
  "popads",
  "popcash",
  "blogspot.com"
];
var isDirectLink = (url) => DIRECT_PATTERNS.some((p) => p.test(url));
var isRedirectLink = (url) => REDIRECT_PATTERNS.some((p) => p.test(url));
async function verifyStreamUrl(url) {
  if (!url?.startsWith("http")) {
    console.log("[VERIFY] Invalid URL");
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: HEADERS,
      redirect: "follow"
    });
    if (!res.ok) {
      console.log("[VERIFY] Non-OK:", res.status, "\u2192", url);
      return false;
    }
    const ct = res.headers.get("content-type") ?? "";
    const valid = ct.includes("video/") || ct.includes("application/octet-stream") || ct.includes("application/x-matroska") || ct.includes("application/mp4");
    console.log(valid ? `[VERIFY] \u2705 ${ct}` : `[VERIFY] \u274C ${ct}`, "\u2192", url);
    return valid;
  } catch (err) {
    console.log("[VERIFY] Error:", err.message, "\u2192", url);
    return false;
  }
}
function tryDecodeEncodedUrl(html) {
  const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
  let combined = "";
  let match;
  while ((match = regex.exec(html)) !== null) {
    const val = match[1] || match[2];
    if (val) combined += val;
  }
  if (!combined) return null;
  try {
    const decoded = safeAtob(rot13(safeAtob(safeAtob(combined))));
    const json2 = JSON.parse(decoded);
    const encodedUrl = safeAtob(json2.o ?? "").trim();
    if (encodedUrl) return encodedUrl;
    return null;
  } catch {
    return null;
  }
}
async function resolveRedirectChain(url, maxHops = 10) {
  console.log("[RESOLVE] Starting:", url);
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    console.log(`[RESOLVE] Hop ${hop + 1}:`, current);
    if (current.includes("pixel.hubcdn.fans")) {
      current = current.replace("pixel.hubcdn.fans", "gpdl.hubcdn.fans");
      console.log("[RESOLVE] Swapped CDN URL:", current);
    }
    if (current.includes("dl.php?link=")) {
      try {
        const target = new URL(current).searchParams.get("link");
        if (target?.startsWith("http")) {
          current = decodeURIComponent(target);
          continue;
        }
      } catch {
      }
    }
    if (isDirectLink(current)) {
      console.log("[RESOLVE] Direct link \u2713");
      return current;
    }
    try {
      const response = await fetch(current, {
        method: "GET",
        headers: HEADERS,
        redirect: "manual"
      });
      const location = response.headers.get("location");
      if (location) {
        current = location.startsWith("http") ? location : new URL(location, current).toString();
        continue;
      }
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("video/") || ct.includes("application/octet-stream") || ct.includes("application/x-matroska")) {
        return current;
      }
      if (ct.includes("text/html")) {
        const html = await response.text();
        const decoded = tryDecodeEncodedUrl(html);
        if (decoded) {
          current = decoded;
          continue;
        }
        const JS_URL_PATTERNS = [
          /https?:\/\/video-downloads\.googleusercontent\.com\/[^\s"'<>)]+/,
          /https?:\/\/[^\s"'<>]+pixeldrain\.com[^\s"'<>]+/,
          /https?:\/\/drive\.google\.com[^\s"'<>]+/,
          /var\s+(?:download_?url|file_?url|link)\s*=\s*["']([^"']+)["']/i,
          /location\.href\s*=\s*["']([^"']+)["']/i,
          /window\.open\(["']([^"']+)["']/i
        ];
        for (const pat of JS_URL_PATTERNS) {
          const m = html.match(pat);
          if (m) {
            const found = m[1] || m[0];
            if (found?.startsWith("http")) {
              current = found;
              continue;
            }
          }
        }
        const DIRECT_URL_PATTERNS = [
          /https?:\/\/video-downloads\.googleusercontent\.com\/[^\s"'<>)]+/,
          /https?:\/\/pixeldrain\.com\/api\/file\/[^\s"'<>]+/,
          /https?:\/\/drive\.google\.com\/uc\?[^\s"'<>]+/
        ];
        for (const pat of DIRECT_URL_PATTERNS) {
          const m = html.match(pat);
          if (m) {
            console.log("[RESOLVE] Direct URL in HTML \u2713");
            return m[0];
          }
        }
        const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)</gi;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(html)) !== null) {
          const href = linkMatch[1];
          const text = linkMatch[2];
          if (!href?.startsWith("http")) continue;
          if (/telegram|zipdisk|ads/i.test(text)) continue;
          if (href.includes("dl.php?link=") && href === current) continue;
          if (/download|get file|click here|direct link|server/i.test(text)) {
            if (isDirectLink(href)) return href;
            current = href;
            break;
          }
        }
        const metaMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'\s]+)/i);
        if (metaMatch?.[1]) {
          current = metaMatch[1];
          continue;
        }
        const jsMatch = html.match(/(?:window\.location|location\.href)\s*=\s*["']([^"']+)["']/);
        if (jsMatch) {
          const jsUrl = jsMatch[1];
          if (!AD_DOMAINS.some((d) => jsUrl.includes(d))) {
            current = jsUrl;
            continue;
          }
        }
        console.log("[RESOLVE] No more redirects on this page");
        if (isRedirectLink(current)) return null;
        return await verifyStreamUrl(current) ? current : null;
      }
      return await verifyStreamUrl(current) ? current : null;
    } catch (err) {
      console.log("[RESOLVE] Fetch error:", err.message);
      return null;
    }
  }
  console.log("[RESOLVE] Max hops reached");
  if (isRedirectLink(current)) return null;
  return await verifyStreamUrl(current) ? current : null;
}
async function getRedirectLinks(url) {
  console.log("[REDIRECT] Processing:", url);
  try {
    const doc = await fetchText(url);
    const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
    let combined = "";
    let match;
    while ((match = regex.exec(doc)) !== null) {
      const val = match[1] || match[2];
      if (val) combined += val;
    }
    if (!combined) {
      console.log("[REDIRECT] No encoded data");
      return url;
    }
    const decoded = safeAtob(rot13(safeAtob(safeAtob(combined))));
    const json2 = JSON.parse(decoded);
    const encodedUrl = safeAtob(json2.o ?? "").trim();
    if (encodedUrl) {
      console.log("[REDIRECT] Decoded URL:", encodedUrl);
      return isRedirectLink(encodedUrl) ? await resolveRedirectChain(encodedUrl) ?? url : encodedUrl;
    }
    const data = safeBtoa(json2.data ?? "").trim();
    const wpHttp = (json2.blog_url ?? "").trim();
    if (wpHttp && data) {
      const html = await fetchText(`${wpHttp}?re=${data}`);
      const finalUrl = extractText(html);
      console.log("[REDIRECT] Final URL:", finalUrl);
      return isRedirectLink(finalUrl) ? await resolveRedirectChain(finalUrl) ?? url : finalUrl;
    }
    return url;
  } catch (err) {
    console.log("[REDIRECT] Error:", err.message);
    return url;
  }
}

// src/extractors.ts
async function pixelDrainExtractor(url) {
  console.log("[PIXELDRAIN] Extracting:", url);
  const match = url.match(/(?:file|u)\/([A-Za-z0-9]+)/);
  const fileId = match?.[1] ?? url.split("/").pop();
  if (!fileId) {
    console.log("[PIXELDRAIN] No file ID");
    return [];
  }
  try {
    const pdRes = await fetch(`https://pixeldrain.com/api/file/${fileId}/info`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });
    if (!pdRes.ok) {
      console.log("[PIXELDRAIN] API error:", pdRes.status);
      return [];
    }
    const info = await pdRes.json();
    if (!info) return [];
    const quality = info.name?.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    return [
      {
        source: "Pixeldrain",
        quality,
        url: `https://pixeldrain.com/api/file/${fileId}?download`,
        size: info.size ?? 0,
        filename: info.name
      }
    ];
  } catch (err) {
    console.log("[PIXELDRAIN] Error:", err.message);
    return [];
  }
}
async function hubCloudExtractor(url, referer) {
  console.log("[HUBCLOUD] Extracting:", url);
  let current = url.includes("hubcloud.ink") ? url.replace("hubcloud.ink", "hubcloud.dad") : url;
  try {
    let html = await fetchText(current, {
      Referer: referer
    });
    if (!current.includes("hubcloud.php")) {
      const scriptUrl = html.match(/var url = '([^']*)'/)?.[1];
      if (scriptUrl) {
        current = scriptUrl;
        console.log("[HUBCLOUD] Following script URL:", current);
        html = await fetchText(current, {
          Referer: url
        });
      }
    }
    const sizeText = html.match(/<i[^>]*id=["']size["'][^>]*>([^<]*)<\/i>/i)?.[1]?.trim() ?? "";
    const sizeBytes = parseSize(sizeText);
    const header = html.match(/<div[^>]*class=["'][^"']*card-header[^"']*["'][^>]*>([^<]*)<\/div>/i)?.[1]?.trim() ?? "";
    const quality = header.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    console.log("[HUBCLOUD] Size:", sizeText, "Quality:", quality);
    const links = extractAllLinks(html);
    const results = [];
    for (const { text, href: rawHref } of links) {
      if (/ZipDisk|Telegram/i.test(text)) continue;
      let href = rawHref;
      const source = `HubCloud [${text}]`;
      if (isRedirectLink(href)) {
        href = await resolveRedirectChain(href) ?? "";
      }
      if (/Download File|FSL|S3|10Gbps/i.test(text)) {
        if (href && await verifyStreamUrl(href)) results.push({
          source,
          quality,
          url: href,
          size: sizeBytes
        });
        else console.log("[HUBCLOUD] \u274C Rejected:", href);
      } else if (/BuzzServer/i.test(text)) {
        const final = await fetchRedirectUrl(`${href}/download`, {
          Referer: href
        });
        if (final && await verifyStreamUrl(final)) {
          console.log("[HUBCLOUD] \u2705 BuzzServer:", final);
          results.push({
            source,
            quality,
            url: final,
            size: sizeBytes
          });
        } else console.log("[HUBCLOUD] \u274C BuzzServer rejected:", final);
      } else if (href.includes("pixeldra")) {
        const pd = await pixelDrainExtractor(href);
        if (pd[0] && await verifyStreamUrl(pd[0].url)) results.push(pd[0]);
        else console.log("[HUBCLOUD] \u274C Pixeldrain rejected");
      } else if (/download|server|link/i.test(text)) {
        if (href && await verifyStreamUrl(href)) results.push({
          source,
          quality,
          url: href,
          size: sizeBytes
        });
        else console.log("[HUBCLOUD] \u274C Rejected:", href);
      }
    }
    console.log(`[HUBCLOUD] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBCLOUD] Error:", err.message);
    return [];
  }
}
async function hubDriveExtractor(url, referer) {
  console.log("[HUBDRIVE] Extracting:", url);
  try {
    const html = await fetchText(url, {
      Referer: referer
    });
    const hubcloudMatch = html.match(new RegExp(`<a[^>]*href=["']([^"']*hubcloud[^"']*)[^>]*>.*?\\[HubCloud Server\\]`, "is"));
    if (!hubcloudMatch?.[1]) {
      console.log("[HUBDRIVE] No HubCloud link");
      return [];
    }
    return await hubCloudExtractor(hubcloudMatch[1], url);
  } catch (err) {
    console.log("[HUBDRIVE] Error:", err.message);
    return [];
  }
}
async function hubCdnExtractor(url, referer) {
  console.log("[HUBCDN] Extracting:", url);
  try {
    const html = await fetchText(url, {
      Referer: referer
    });
    const sizeText = html.match(/<i[^>]*id=["']size["'][^>]*>([^<]*)<\/i>/i)?.[1]?.trim() ?? "";
    const sizeBytes = parseSize(sizeText);
    const quality = html.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    const results = [];
    for (const { text, href: rawHref } of extractAllLinks(html)) {
      if (/Telegram|ZipDisk/i.test(text)) continue;
      if (!/Download|Server/i.test(text)) continue;
      let href = rawHref;
      if (isRedirectLink(href)) href = await resolveRedirectChain(href) ?? "";
      if (href && await verifyStreamUrl(href)) results.push({
        source: "HubCdn",
        quality,
        url: href,
        size: sizeBytes
      });
      else console.log("[HUBCDN] \u274C Rejected:", href);
    }
    console.log(`[HUBCDN] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBCDN] Error:", err.message);
    return [];
  }
}
async function hubStreamExtractor(url, referer) {
  console.log("[HUBSTREAM] Extracting:", url);
  try {
    const html = await fetchText(url, {
      Referer: referer
    });
    const quality = html.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    const results = [];
    const downloadRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>.*?(?:Download|Server|Direct)/gis;
    let match;
    while ((match = downloadRegex.exec(html)) !== null) {
      let href = match[1];
      if (!href?.startsWith("http")) continue;
      if (isRedirectLink(href)) href = await resolveRedirectChain(href) ?? "";
      if (href && await verifyStreamUrl(href)) results.push({
        source: "Hubstream",
        quality,
        url: href,
        size: 0
      });
      else console.log("[HUBSTREAM] \u274C Rejected:", href);
    }
    console.log(`[HUBSTREAM] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBSTREAM] Error:", err.message);
    return [];
  }
}
async function hbLinksExtractor(url, referer, loadExtractorFn) {
  const res = await fetchWithRetry(url, {
    Referer: referer
  });
  const html = await res.text();
  const links = [];
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href?.startsWith("http")) continue;
    if (href.includes("hblinks.dad") && !href.includes("/archives/")) continue;
    links.push(href);
  }
  console.log(`[HBLINKS] ${links.length} links \u2192 parallel extraction`);
  const all = await Promise.all(links.map((l) => loadExtractorFn(l, url)));
  return all.flat();
}

// src/index.ts
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS
  });
}
function parseNullableParam(raw) {
  if (!raw || raw === "null" || raw === "undefined") return void 0;
  return raw;
}
async function loadExtractor(url, referer = MAIN_URL) {
  if (!url) return [];
  console.log("[EXTRACTOR] Processing:", url);
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (url.includes("?id=") || hostname.includes("techyboy") || hostname.includes("gdtot")) {
      const resolved = await getRedirectLinks(url);
      if (resolved && resolved !== url) return loadExtractor(resolved, url);
      return [];
    }
    if (hostname.includes("hubcloud")) return hubCloudExtractor(url, referer);
    if (hostname.includes("hubcdn")) return hubCdnExtractor(url, referer);
    if (hostname.includes("hubdrive")) return hubDriveExtractor(url, referer);
    if (hostname.includes("pixeldrain")) return pixelDrainExtractor(url);
    if (hostname.includes("hubstream")) return hubStreamExtractor(url, referer);
    if (hostname.includes("hblinks")) return hbLinksExtractor(url, referer, loadExtractor);
    console.log("[EXTRACTOR] No matching extractor for:", hostname);
    return [];
  } catch (err) {
    console.log("[EXTRACTOR] Error:", err.message);
    return [];
  }
}
async function extractLinksInParallel(links, referer) {
  console.log(`[Parallel] Processing ${links.length} links`);
  const t0 = Date.now();
  const results = await Promise.all(links.map((l) => loadExtractor(l, referer).catch(() => [])));
  const flat = results.flat();
  console.log(`[Parallel] Done in ${Date.now() - t0}ms \u2014 ${flat.length} streams`);
  return flat;
}
function deduplicateByUrl(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
function episodeSuffix(season, episode) {
  if (!season || !episode) return "";
  const s = season.padStart(2, "0");
  const e = episode.padStart(2, "0");
  return `S${s}E${e}`;
}
async function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[HDHub4u] Starting:", tmdbId, mediaType, season, episode);
  const cached = await getCachedStreams(tmdbId, mediaType, season, episode);
  if (cached) {
    console.log(`[HDHub4u] \u26A1 Cache hit: ${cached.length} streams`);
    triggerDomainUpdate();
    return cached;
  }
  triggerDomainUpdate();
  const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=342c3872f1357c6e1da3a5ac1ccc3605&append_to_response=external_ids`;
  const tmdbInfo = await fetch(tmdbUrl).then((r) => r.json());
  const imdbId = tmdbInfo.imdb_id ?? tmdbInfo.external_ids?.imdb_id;
  const displayTitle = (mediaType === "tv" ? tmdbInfo.name : tmdbInfo.title) ?? "";
  const year = mediaType === "movie" ? tmdbInfo.release_date?.split("-")[0] ?? "" : tmdbInfo.first_air_date?.split("-")[0] ?? "";
  const [webstreamrResults, { nativeStreams, updatedTitle }] = await Promise.all([
    // ── 3a. WebStreamr path ──────────────────────────────────────────────────
    (async () => {
      if (!imdbId) return [];
      console.log("[WebStreamr] Fetching for IMDb:", imdbId);
      return webstreamrExtractor(imdbId, mediaType, season, episode);
    })().catch(() => []),
    // ── 3b. Native HDHub4u scrape path ───────────────────────────────────────
    (async () => {
      try {
        const searchQueue = [];
        let updatedTitle2 = displayTitle;
        if (imdbId) {
          const [imdbRes, akasRes] = await Promise.all([
            fetch(`https://api.imdbapi.dev/titles/${imdbId}`).then((r) => r.json()).catch(() => null),
            fetch(`https://api.imdbapi.dev/titles/${imdbId}/akas`).then((r) => r.json()).catch(() => ({
              akas: []
            }))
          ]);
          if (imdbRes) {
            if (imdbRes.originalTitle) searchQueue.push(imdbRes.originalTitle);
            if (imdbRes.primaryTitle && !searchQueue.includes(imdbRes.primaryTitle)) searchQueue.push(imdbRes.primaryTitle);
            updatedTitle2 = imdbRes.originalTitle ?? imdbRes.primaryTitle ?? displayTitle;
          }
          const indianAkas = (akasRes.akas ?? []).filter((a) => a.country?.code === "IN").map((a) => a.text).filter((t) => /^[\w\s\-':.!&–—(),]+$/.test(t));
          for (const aka of indianAkas) if (!searchQueue.includes(aka)) searchQueue.push(aka);
        }
        if (!searchQueue.length) searchQueue.push(updatedTitle2);
        const { results: searchResults } = await performParallelSearch(searchQueue, year);
        if (!searchResults.length) {
          console.log("[HDHub4u] No search results");
          return {
            nativeStreams: [],
            updatedTitle: updatedTitle2
          };
        }
        const bestMatch = searchResults.find((r) => mediaType === "tv" && season ? r.title.toLowerCase().includes(`season ${season}`) : true);
        if (!bestMatch) {
          console.log("[HDHub4u] No match");
          return {
            nativeStreams: [],
            updatedTitle: updatedTitle2
          };
        }
        console.log("[HDHub4u] Page:", bestMatch.title);
        const pageHtml = await fetchText(bestMatch.url);
        const links = extractLinks(pageHtml, mediaType, season, episode);
        console.log(`[HDHub4u] ${links.length} candidate links`);
        const extracted = await extractLinksInParallel(links, bestMatch.url);
        const streams = [];
        for (const res of extracted) {
          if (!res?.url || res.quality === "Unknown") continue;
          if (res.quality.includes("480p") || res.quality.includes("720p")) continue;
          const epSuffix = episodeSuffix(season, episode);
          const title = [
            updatedTitle2,
            year ? `(${year})` : "",
            epSuffix
          ].filter(Boolean).join(" ");
          streams.push({
            name: res.quality,
            title,
            url: transformToProxyUrl(res.url),
            size: formatBytes(res.size),
            headers: HEADERS
          });
        }
        return {
          nativeStreams: streams,
          updatedTitle: updatedTitle2
        };
      } catch (err) {
        console.log("[HDHub4u Native Error]:", err.message);
        return {
          nativeStreams: [],
          updatedTitle: displayTitle
        };
      }
    })()
  ]);
  const merged = [
    ...nativeStreams
  ];
  for (const res of webstreamrResults ?? []) {
    if (!res?.url) continue;
    const epSuffix = episodeSuffix(season, episode);
    const title = [
      updatedTitle,
      year ? `(${year})` : "",
      epSuffix
    ].filter(Boolean).join(" ");
    merged.push({
      name: res.quality,
      title,
      url: transformToProxyUrl(res.url),
      size: res.sizeText || formatBytes(res.size),
      headers: HEADERS
    });
  }
  if (!merged.length) {
    console.log("[HDHub4u] No streams found");
    return [];
  }
  const deduped = deduplicateByUrl(merged);
  if (deduped.length < merged.length) {
    console.log(`[HDHub4u] Deduped: ${merged.length} \u2192 ${deduped.length} streams`);
  }
  const final = sortAndNumberStreams(deduped);
  console.log(`[HDHub4u] \u2705 ${final.length} streams`);
  setCachedStreams(tmdbId, mediaType, season, episode, final, 3600).then(() => getCacheStats()).then((stats) => console.log(`[CACHE] Saved \u2014 ${stats.totalEntries ?? 0} entries`)).catch((err) => console.log("[CACHE] Background save error:", err.message));
  return final;
}
async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, {
    headers: CORS
  });
  if (path === "/health") {
    return json({
      status: "ok",
      server: "hdhub4u-deno",
      ts: Date.now()
    });
  }
  if (path === "/cache/clear" && method === "POST") {
    const ok = await clearAllCache();
    return json({
      success: ok
    });
  }
  if (path === "/cache/stats") {
    const stats = await getCacheStats();
    return json(stats);
  }
  if (path === "/streams") {
    const tmdbId = url.searchParams.get("tmdbId");
    const mediaType = url.searchParams.get("type") ?? url.searchParams.get("mediaType");
    const season = parseNullableParam(url.searchParams.get("season"));
    const episode = parseNullableParam(url.searchParams.get("episode"));
    if (!tmdbId || !mediaType) {
      return json({
        error: "Missing required params: tmdbId, type"
      }, 400);
    }
    if (![
      "movie",
      "tv"
    ].includes(mediaType)) {
      return json({
        error: "type must be 'movie' or 'tv'"
      }, 400);
    }
    if (mediaType === "tv" && (!season || !episode)) {
      return json({
        error: "season and episode required for tv"
      }, 400);
    }
    try {
      const streams = await getStreams(tmdbId, mediaType, season, episode);
      return json({
        streams,
        count: streams.length
      });
    } catch (err) {
      console.error("[Server] Critical error:", err);
      return json({
        error: "Internal server error",
        streams: []
      }, 500);
    }
  }
  return json({
    error: "Not found",
    endpoints: [
      "GET  /streams?tmdbId=&type=movie|tv[&season=&episode=]",
      "GET  /cache/stats",
      "POST /cache/clear",
      "GET  /health"
    ]
  }, 404);
}
var port = parseInt(Deno.env.get("PORT") ?? "8000");
console.log(`[HDHub4u] \u{1F995} Deno server running on http://localhost:${port}`);
Deno.serve({
  port
}, handler);
