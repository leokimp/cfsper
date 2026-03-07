import type { LinkMetadata, QualityMarker } from "./types.ts";

// ─── Valid Link Check ─────────────────────────────────────────────────────────

function isValidStreamLink(href: string, rawText: string): boolean {
  if (!href) return false;
  const hrefLower = href.toLowerCase();
  const text      = (rawText ?? "").replace(/<[^>]+>/g, "").trim().toLowerCase();

  const isBadUrl =
    hrefLower.startsWith("/") ||
    hrefLower.startsWith("#") ||
    hrefLower.includes("hdhub4u") ||
    hrefLower.includes("4khdhub") ||
    hrefLower.includes("discord") ||
    hrefLower.includes("themoviedb.org") ||
    hrefLower.includes("imdb.com") ||
    hrefLower.includes("{{") ||
    hrefLower.includes("cdn-cgi");

  const isBadText =
    text.includes("watch") ||
    text.includes("pack") ||
    text.includes("480p") ||
    text.includes("720p") ||
    text === "";

  return !isBadUrl && !isBadText;
}

// ─── Extract Links with Metadata ─────────────────────────────────────────────

export function extractLinksWithMetadata(
  html: string,
  mediaType: string,
  season?: string | number | null,
  episode?: string | number | null
): LinkMetadata[] {
  const result: LinkMetadata[] = [];

  // ── Movie: grab all valid links ───────────────────────────────────────────
  if (mediaType === "movie") {
    const regex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null) {
      if (isValidStreamLink(m[1], m[2]))
        result.push({ url: m[1], requiresQualityCheck: false, preFilteredQuality: true });
    }
  }

  // ── TV: slice HTML to target episode block ────────────────────────────────
  else if (mediaType === "tv" && season && episode) {
    const targetEp  = parseInt(String(episode));
    const nextEp    = targetEp + 1;

    const startRx = new RegExp(
      `<(?:h[1-6]|strong|span|a)[^>]*>\\s*(?:Episode|Ep|E|EPiSODE)\\s*0?${targetEp}\\b`, "i"
    );
    const nextRx  = new RegExp(
      `<(?:h[1-6]|strong|span|a)[^>]*>\\s*(?:Episode|Ep|E|EPiSODE)\\s*0?${nextEp}\\b`, "i"
    );

    const startMatch = html.match(startRx);
    if (!startMatch) return dedup(result);

    const startIdx  = startMatch.index!;
    const nextMatch = html.substring(startIdx + 10).match(nextRx);
    const endIdx    = nextMatch ? startIdx + 10 + nextMatch.index! : startIdx + 6000;
    const slice     = html.substring(startIdx, endIdx);

    console.log(`[TV] Episode ${targetEp} slice: ${slice.length} chars`);

    if (/\b(1080p|2160p|4k|uhd|720p|480p)\b/i.test(slice)) {
      console.log("[TV] Quality labels in block — filtering at HTML stage");

      const qualityRx: RegExp = /\b(720p|480p|360p|1080p|2160p|4k|uhd)\b/gi;
      const markers: QualityMarker[] = [];
      let qm: RegExpExecArray | null;
      qualityRx.lastIndex = 0;
      while ((qm = qualityRx.exec(slice)) !== null) {
        markers.push({
          quality:       qm[1].toLowerCase(),
          index:         qm.index,
          isHighQuality: /1080p|2160p|4k|uhd/i.test(qm[1]),
        });
      }

      console.log(`[TV] ${markers.length} quality markers`);
      for (let i = 0; i < markers.length; i++) {
        const mk = markers[i];
        if (!mk.isHighQuality) { console.log(`[TV] Skip low quality: ${mk.quality}`); continue; }

        const zoneEnd    = markers[i + 1]?.index ?? slice.length;
        const zone       = slice.substring(mk.index, zoneEnd);
        const zoneLinks  = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
        let lm: RegExpExecArray | null;
        let found = 0;
        while ((lm = zoneLinks.exec(zone)) !== null) {
          if (isValidStreamLink(lm[1], lm[2])) {
            found++;
            result.push({ url: lm[1], requiresQualityCheck: false, preFilteredQuality: true });
          }
        }
        if (found === 0) console.log("[TV] No links in zone");
      }
    } else {
      console.log("[TV] No quality labels — quality checked during extraction");
      const linkRx = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkRx.exec(slice)) !== null) {
        if (isValidStreamLink(lm[1], lm[2]))
          result.push({ url: lm[1], requiresQualityCheck: true, preFilteredQuality: false });
      }
    }
  }

  return dedup(result);
}

function dedup(items: LinkMetadata[]): LinkMetadata[] {
  const seen = new Set<string>();
  return items.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function extractLinks(
  html: string,
  mediaType: string,
  season?: string | number | null,
  episode?: string | number | null
): string[] {
  return extractLinksWithMetadata(html, mediaType, season, episode).map((m) => m.url);
}
