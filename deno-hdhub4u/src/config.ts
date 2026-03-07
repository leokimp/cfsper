import { sleep } from "./utils.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

export let MAIN_URL = "https://hdhub4u.frl";

export const PINGORA_API_URL =
  "https://search.pingora.fyi/collections/post/documents/search";

export const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

export const PROXY_WORKER_URL = "https://stream.leokimpese.workers.dev/";
export const CACHE_API_BASE   = "https://cache.leokimpese.workers.dev";
export const WEBSTREAMR_BASE_URL =
  'https://webstreamr.hayd.uk/%7B%22gu%22%3A%22on%22%2C%22hi%22%3A%22on%22%2C%22mediaFlowProxyUrl%22%3A%22%22%2C%22mediaFlowProxyPassword%22%3A%22%22%2C%22disableExtractor_doodstream%22%3A%22on%22%2C%22disableExtractor_dropload%22%3A%22on%22%2C%22disableExtractor_fastream%22%3A%22on%22%2C%22disableExtractor_kinoger%22%3A%22on%22%2C%22disableExtractor_lulustream%22%3A%22on%22%2C%22disableExtractor_mixdrop%22%3A%22on%22%2C%22disableExtractor_savefiles%22%3A%22on%22%2C%22disableExtractor_streamembed%22%3A%22on%22%2C%22disableExtractor_streamtape%22%3A%22on%22%2C%22disableExtractor_streamup%22%3A%22on%22%2C%22disableExtractor_supervideo%22%3A%22on%22%2C%22disableExtractor_uqload%22%3A%22on%22%2C%22disableExtractor_vidora%22%3A%22on%22%2C%22disableExtractor_vidsrc%22%3A%22on%22%2C%22disableExtractor_vixsrc%22%3A%22on%22%2C%22disableExtractor_voe%22%3A%22on%22%2C%22disableExtractor_youtube%22%3A%22on%22%7D';

export const ENABLE_GOOGLE_DRIVE_PROXY = true;
export const DEFAULT_TTL = 3600;

// Quality thresholds
export const MIN_QUALITY = 1080;
export const ALLOWED_LANGUAGES = ["hindi", "gujarati", "english"];
export const BLOCKED_QUALITY_PATTERNS = [
  "360p","480p","576p","720p",
  "cam","camrip","hdcam",
  "ts","telesync","tc","telecine",
  "dvdscr","screener","r5","r6",
];

// ─── Headers (mutable object — same reference, mutated on domain change) ──────

export const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "",
  Origin:  "",
};

export function initHeaders(): void {
  HEADERS.Referer = `${MAIN_URL}/`;
  HEADERS.Origin  = MAIN_URL;
}
initHeaders();

export function setMainUrl(newUrl: string): void {
  MAIN_URL         = newUrl;
  HEADERS.Referer  = `${MAIN_URL}/`;
  HEADERS.Origin   = MAIN_URL;
}

// ─── Domain Auto-Update ───────────────────────────────────────────────────────

let domainLastUpdated    = 0;
let domainUpdateRunning  = false;
const DOMAIN_UPDATE_INTERVAL = 3_600_000; // 1 hour

interface DomainsJSON { HDHUB4u?: string; [key: string]: unknown }

export function triggerDomainUpdate(): void {
  const now = Date.now();
  if (now - domainLastUpdated < DOMAIN_UPDATE_INTERVAL || domainUpdateRunning) return;
  domainUpdateRunning = true;
  performDomainUpdate()
    .then(() => { domainUpdateRunning = false; })
    .catch((err: Error) => {
      console.log("[Domain] Background error:", err.message);
      domainUpdateRunning = false;
    });
}

async function performDomainUpdate(): Promise<void> {
  try {
    console.log("[Domain] Checking for new domain...");
    const res  = await fetch(DOMAINS_URL);
    const data = (await res.json()) as DomainsJSON;
    if (data?.HDHUB4u && MAIN_URL !== data.HDHUB4u) {
      console.log("[Domain] ✓ Updated:", data.HDHUB4u);
      setMainUrl(data.HDHUB4u);
    } else {
      console.log("[Domain] ✓ Unchanged");
      HEADERS.Referer = `${MAIN_URL}/`;
      HEADERS.Origin  = MAIN_URL;
    }
    domainLastUpdated = Date.now();
  } catch (err) {
    console.log("[Domain] Error:", (err as Error).message);
    HEADERS.Referer = `${MAIN_URL}/`;
    HEADERS.Origin  = MAIN_URL;
  }
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

export async function fetchWithRetry(
  url: string,
  customHeaders: Record<string, string> = {},
  maxRetries = 2
): Promise<Response> {
  const headers = { ...HEADERS, ...customHeaders };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok && attempt < maxRetries) {
        console.log(`[HTTP] Retry ${attempt + 1}/${maxRetries}:`, url);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`[HTTP] Attempt ${attempt + 1} failed, retrying:`, (err as Error).message);
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error("Max retries reached");
}

export async function fetchText(
  url: string,
  customHeaders: Record<string, string> = {}
): Promise<string> {
  try {
    const res = await fetchWithRetry(url, customHeaders);
    return await res.text();
  } catch (err) {
    console.log("[HTTP] Text fetch error:", (err as Error).message);
    return "";
  }
}

export async function fetchJSON<T = unknown>(
  url: string,
  customHeaders: Record<string, string> = {}
): Promise<T | null> {
  try {
    const res = await fetchWithRetry(url, customHeaders);
    return (await res.json()) as T;
  } catch (err) {
    console.log("[HTTP] JSON fetch error:", (err as Error).message);
    return null;
  }
}

export async function fetchRedirectUrl(
  url: string,
  customHeaders: Record<string, string> = {}
): Promise<string | null> {
  try {
    const headers  = { ...HEADERS, ...customHeaders };
    const response = await fetch(url, { method: "HEAD", headers, redirect: "manual" });
    const location =
      response.headers.get("hx-redirect") ||
      response.headers.get("location") ||
      response.headers.get("Location");
    if (!location) return null;
    if (location.startsWith("http")) return location;
    return new URL(url).origin + location;
  } catch (err) {
    console.log("[HTTP] Redirect fetch error:", (err as Error).message);
    return null;
  }
}

// ─── Proxy Helpers ────────────────────────────────────────────────────────────

export function shouldProxyUrl(url: string): boolean {
  if (!ENABLE_GOOGLE_DRIVE_PROXY || !url) return false;
  return [
    "video-downloads.googleusercontent.com",
    "drive.google.com/uc",
    "docs.google.com/uc",
  ].some((p) => url.includes(p));
}

export function transformToProxyUrl(url: string): string {
  if (!shouldProxyUrl(url)) return url;
  try {
    const proxied = `${PROXY_WORKER_URL}?l=${url}`;
    console.log("[PROXY] Transformed URL to proxy");
    return proxied;
  } catch (err) {
    console.log("[PROXY] Error:", (err as Error).message);
    return url;
  }
}
