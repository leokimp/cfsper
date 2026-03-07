import { HEADERS, fetchText } from "./config.ts";
import { safeAtob, safeBtoa, rot13, extractText } from "./utils.ts";

// ─── URL Classification ───────────────────────────────────────────────────────

const DIRECT_PATTERNS = [
  /^https?:\/\/pixeldrain\.com\/api\/file\/.*\?download/i,
  /^https?:\/\/([a-z0-9-]+\.)*video-downloads\.googleusercontent\.com/i,
  /^https?:\/\/drive\.google\.com\/uc\?/i,
  /^https?:\/\/docs\.google\.com.*export/i,
];

const REDIRECT_PATTERNS = [
  /dl\.php\?link=/i,
  /https?:\/\/[a-z0-9-]+\.hubcdn\.fans\/\?id=/i,
  /https?:\/\/[a-z0-9-]+\.rohitkiskk\.workers\.dev/i,
  /\/go\//i,
  /redirect/i,
];

const AD_DOMAINS = [
  "bonuscaf.com","urbanheadline.com","propellerads",
  "adsterra","popads","popcash","blogspot.com",
];

export const isDirectLink   = (url: string): boolean => DIRECT_PATTERNS.some((p) => p.test(url));
export const isRedirectLink = (url: string): boolean => REDIRECT_PATTERNS.some((p) => p.test(url));

// ─── Stream Verifier ──────────────────────────────────────────────────────────

export async function verifyStreamUrl(url: string): Promise<boolean> {
  if (!url?.startsWith("http")) { console.log("[VERIFY] Invalid URL"); return false; }
  try {
    const res = await fetch(url, { method: "HEAD", headers: HEADERS, redirect: "follow" });
    if (!res.ok) { console.log("[VERIFY] Non-OK:", res.status, "→", url); return false; }
    const ct = res.headers.get("content-type") ?? "";
    const valid =
      ct.includes("video/") ||
      ct.includes("application/octet-stream") ||
      ct.includes("application/x-matroska") ||
      ct.includes("application/mp4");
    console.log(valid ? `[VERIFY] ✅ ${ct}` : `[VERIFY] ❌ ${ct}`, "→", url);
    return valid;
  } catch (err) {
    console.log("[VERIFY] Error:", (err as Error).message, "→", url);
    return false;
  }
}

// ─── Encoded URL Decoder (ROT13 + Base64) ────────────────────────────────────

function tryDecodeEncodedUrl(html: string): string | null {
  const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
  let combined = "";
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const val = match[1] || match[2];
    if (val) combined += val;
  }
  if (!combined) return null;
  try {
    const decoded = safeAtob(rot13(safeAtob(safeAtob(combined))));
    const json    = JSON.parse(decoded) as { o?: string; data?: string; blog_url?: string };
    const encodedUrl = safeAtob(json.o ?? "").trim();
    if (encodedUrl) return encodedUrl;
    return null;
  } catch {
    return null;
  }
}

// ─── Redirect Chain Resolver ──────────────────────────────────────────────────

export async function resolveRedirectChain(url: string, maxHops = 10): Promise<string | null> {
  console.log("[RESOLVE] Starting:", url);
  let current = url;

  for (let hop = 0; hop < maxHops; hop++) {
    console.log(`[RESOLVE] Hop ${hop + 1}:`, current);

    // Swap known broken CDN subdomain
    if (current.includes("pixel.hubcdn.fans")) {
      current = current.replace("pixel.hubcdn.fans", "gpdl.hubcdn.fans");
      console.log("[RESOLVE] Swapped CDN URL:", current);
    }

    // Extract dl.php?link= param directly
    if (current.includes("dl.php?link=")) {
      try {
        const target = new URL(current).searchParams.get("link");
        if (target?.startsWith("http")) { current = decodeURIComponent(target); continue; }
      } catch { /* ignore */ }
    }

    if (isDirectLink(current)) { console.log("[RESOLVE] Direct link ✓"); return current; }

    try {
      const response = await fetch(current, { method: "GET", headers: HEADERS, redirect: "manual" });
      const location  = response.headers.get("location");
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

        // Try encoded URL decode
        const decoded = tryDecodeEncodedUrl(html);
        if (decoded) { current = decoded; continue; }

        // JS button URL patterns
        const JS_URL_PATTERNS = [
          /https?:\/\/video-downloads\.googleusercontent\.com\/[^\s"'<>)]+/,
          /https?:\/\/[^\s"'<>]+pixeldrain\.com[^\s"'<>]+/,
          /https?:\/\/drive\.google\.com[^\s"'<>]+/,
          /var\s+(?:download_?url|file_?url|link)\s*=\s*["']([^"']+)["']/i,
          /location\.href\s*=\s*["']([^"']+)["']/i,
          /window\.open\(["']([^"']+)["']/i,
        ];
        for (const pat of JS_URL_PATTERNS) {
          const m = html.match(pat);
          if (m) {
            const found = m[1] || m[0];
            if (found?.startsWith("http")) { current = found; continue; }
          }
        }

        // Direct URL in HTML
        const DIRECT_URL_PATTERNS = [
          /https?:\/\/video-downloads\.googleusercontent\.com\/[^\s"'<>)]+/,
          /https?:\/\/pixeldrain\.com\/api\/file\/[^\s"'<>]+/,
          /https?:\/\/drive\.google\.com\/uc\?[^\s"'<>]+/,
        ];
        for (const pat of DIRECT_URL_PATTERNS) {
          const m = html.match(pat);
          if (m) { console.log("[RESOLVE] Direct URL in HTML ✓"); return m[0]; }
        }

        // Anchor tag scan
        const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)</gi;
        let linkMatch: RegExpExecArray | null;
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

        // Meta refresh
        const metaMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'\s]+)/i);
        if (metaMatch?.[1]) { current = metaMatch[1]; continue; }

        // JS redirect
        const jsMatch = html.match(/(?:window\.location|location\.href)\s*=\s*["']([^"']+)["']/);
        if (jsMatch) {
          const jsUrl = jsMatch[1];
          if (!AD_DOMAINS.some((d) => jsUrl.includes(d))) { current = jsUrl; continue; }
        }

        console.log("[RESOLVE] No more redirects on this page");
        if (isRedirectLink(current)) return null;
        return (await verifyStreamUrl(current)) ? current : null;
      }

      return (await verifyStreamUrl(current)) ? current : null;
    } catch (err) {
      console.log("[RESOLVE] Fetch error:", (err as Error).message);
      return null;
    }
  }

  console.log("[RESOLVE] Max hops reached");
  if (isRedirectLink(current)) return null;
  return (await verifyStreamUrl(current)) ? current : null;
}

// ─── Redirect Page Decoder ────────────────────────────────────────────────────

export async function getRedirectLinks(url: string): Promise<string> {
  console.log("[REDIRECT] Processing:", url);
  try {
    const doc     = await fetchText(url);
    const regex   = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
    let combined  = "";
    let match: RegExpExecArray | null;
    while ((match = regex.exec(doc)) !== null) {
      const val = match[1] || match[2];
      if (val) combined += val;
    }
    if (!combined) { console.log("[REDIRECT] No encoded data"); return url; }

    const decoded  = safeAtob(rot13(safeAtob(safeAtob(combined))));
    const json     = JSON.parse(decoded) as { o?: string; data?: string; blog_url?: string };
    const encodedUrl = safeAtob(json.o ?? "").trim();
    if (encodedUrl) {
      console.log("[REDIRECT] Decoded URL:", encodedUrl);
      return isRedirectLink(encodedUrl)
        ? (await resolveRedirectChain(encodedUrl)) ?? url
        : encodedUrl;
    }

    const data   = safeBtoa(json.data  ?? "").trim();
    const wpHttp = (json.blog_url ?? "").trim();
    if (wpHttp && data) {
      const html     = await fetchText(`${wpHttp}?re=${data}`);
      const finalUrl = extractText(html);
      console.log("[REDIRECT] Final URL:", finalUrl);
      return isRedirectLink(finalUrl)
        ? (await resolveRedirectChain(finalUrl)) ?? url
        : finalUrl;
    }
    return url;
  } catch (err) {
    console.log("[REDIRECT] Error:", (err as Error).message);
    return url;
  }
}
