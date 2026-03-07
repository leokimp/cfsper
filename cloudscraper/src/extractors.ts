import { fetchText, fetchJSON, fetchWithRetry, fetchRedirectUrl } from "./config.ts";
import { parseSize, extractAllLinks } from "./utils.ts";
import { isRedirectLink, resolveRedirectChain, verifyStreamUrl } from "./resolver.ts";
import type { ExtractedStream } from "./types.ts";

// ─── PixelDrain ───────────────────────────────────────────────────────────────

interface PixelDrainInfo { name?: string; size?: number }

export async function pixelDrainExtractor(url: string): Promise<ExtractedStream[]> {
  console.log("[PIXELDRAIN] Extracting:", url);
  const match  = url.match(/(?:file|u)\/([A-Za-z0-9]+)/);
  const fileId = match?.[1] ?? url.split("/").pop();
  if (!fileId) { console.log("[PIXELDRAIN] No file ID"); return []; }

  try {
    const pdRes = await fetch(`https://pixeldrain.com/api/file/${fileId}/info`, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!pdRes.ok) { console.log("[PIXELDRAIN] API error:", pdRes.status); return []; }
    const info = await pdRes.json() as PixelDrainInfo;
    if (!info) return [];
    const quality = info.name?.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    return [{
      source: "Pixeldrain",
      quality,
      url:      `https://pixeldrain.com/api/file/${fileId}?download`,
      size:     info.size ?? 0,
      filename: info.name,
    }];
  } catch (err) {
    console.log("[PIXELDRAIN] Error:", (err as Error).message);
    return [];
  }
}

// ─── HubCloud ─────────────────────────────────────────────────────────────────

export async function hubCloudExtractor(url: string, referer: string): Promise<ExtractedStream[]> {
  console.log("[HUBCLOUD] Extracting:", url);
  let current = url.includes("hubcloud.ink")
    ? url.replace("hubcloud.ink", "hubcloud.dad")
    : url;

  try {
    let html = await fetchText(current, { Referer: referer });

    if (!current.includes("hubcloud.php")) {
      const scriptUrl = html.match(/var url = '([^']*)'/)?.[1];
      if (scriptUrl) {
        current = scriptUrl;
        console.log("[HUBCLOUD] Following script URL:", current);
        html = await fetchText(current, { Referer: url });
      }
    }

    const sizeText  = html.match(/<i[^>]*id=["']size["'][^>]*>([^<]*)<\/i>/i)?.[1]?.trim() ?? "";
    const sizeBytes = parseSize(sizeText);
    const header    = html.match(/<div[^>]*class=["'][^"']*card-header[^"']*["'][^>]*>([^<]*)<\/div>/i)?.[1]?.trim() ?? "";
    const quality   = header.match(/(\d{3,4})p/)?.[0] ?? "Unknown";
    console.log("[HUBCLOUD] Size:", sizeText, "Quality:", quality);

    const links   = extractAllLinks(html);
    const results: ExtractedStream[] = [];

    for (const { text, href: rawHref } of links) {
      if (/ZipDisk|Telegram/i.test(text)) continue;
      let href = rawHref;
      const source = `HubCloud [${text}]`;

      if (isRedirectLink(href)) {
        href = (await resolveRedirectChain(href)) ?? "";
      }

      if (/Download File|FSL|S3|10Gbps/i.test(text)) {
        if (href && await verifyStreamUrl(href))
          results.push({ source, quality, url: href, size: sizeBytes });
        else console.log("[HUBCLOUD] ❌ Rejected:", href);

      } else if (/BuzzServer/i.test(text)) {
        const final = await fetchRedirectUrl(`${href}/download`, { Referer: href });
        if (final && await verifyStreamUrl(final)) {
          console.log("[HUBCLOUD] ✅ BuzzServer:", final);
          results.push({ source, quality, url: final, size: sizeBytes });
        } else console.log("[HUBCLOUD] ❌ BuzzServer rejected:", final);

      } else if (href.includes("pixeldra")) {
        const pd = await pixelDrainExtractor(href);
        if (pd[0] && await verifyStreamUrl(pd[0].url)) results.push(pd[0]);
        else console.log("[HUBCLOUD] ❌ Pixeldrain rejected");

      } else if (/download|server|link/i.test(text)) {
        if (href && await verifyStreamUrl(href))
          results.push({ source, quality, url: href, size: sizeBytes });
        else console.log("[HUBCLOUD] ❌ Rejected:", href);
      }
    }

    console.log(`[HUBCLOUD] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBCLOUD] Error:", (err as Error).message);
    return [];
  }
}

// ─── HubDrive ─────────────────────────────────────────────────────────────────

export async function hubDriveExtractor(url: string, referer: string): Promise<ExtractedStream[]> {
  console.log("[HUBDRIVE] Extracting:", url);
  try {
    const html         = await fetchText(url, { Referer: referer });
    const hubcloudMatch = html.match(
      new RegExp(`<a[^>]*href=["']([^"']*hubcloud[^"']*)[^>]*>.*?\\[HubCloud Server\\]`, "is")
    );
    if (!hubcloudMatch?.[1]) { console.log("[HUBDRIVE] No HubCloud link"); return []; }
    return await hubCloudExtractor(hubcloudMatch[1], url);
  } catch (err) {
    console.log("[HUBDRIVE] Error:", (err as Error).message);
    return [];
  }
}

// ─── HubCDN ───────────────────────────────────────────────────────────────────

export async function hubCdnExtractor(url: string, referer: string): Promise<ExtractedStream[]> {
  console.log("[HUBCDN] Extracting:", url);
  try {
    const html      = await fetchText(url, { Referer: referer });
    const sizeText  = html.match(/<i[^>]*id=["']size["'][^>]*>([^<]*)<\/i>/i)?.[1]?.trim() ?? "";
    const sizeBytes = parseSize(sizeText);
    const quality   = html.match(/(\d{3,4})p/)?.[0] ?? "Unknown";

    const results: ExtractedStream[] = [];
    for (const { text, href: rawHref } of extractAllLinks(html)) {
      if (/Telegram|ZipDisk/i.test(text)) continue;
      if (!/Download|Server/i.test(text)) continue;
      let href = rawHref;
      if (isRedirectLink(href)) href = (await resolveRedirectChain(href)) ?? "";
      if (href && await verifyStreamUrl(href))
        results.push({ source: "HubCdn", quality, url: href, size: sizeBytes });
      else console.log("[HUBCDN] ❌ Rejected:", href);
    }
    console.log(`[HUBCDN] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBCDN] Error:", (err as Error).message);
    return [];
  }
}

// ─── HubStream ────────────────────────────────────────────────────────────────

export async function hubStreamExtractor(url: string, referer: string): Promise<ExtractedStream[]> {
  console.log("[HUBSTREAM] Extracting:", url);
  try {
    const html    = await fetchText(url, { Referer: referer });
    const quality = html.match(/(\d{3,4})p/)?.[0] ?? "Unknown";

    const results: ExtractedStream[]  = [];
    const downloadRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>.*?(?:Download|Server|Direct)/gis;
    let match: RegExpExecArray | null;

    while ((match = downloadRegex.exec(html)) !== null) {
      let href = match[1];
      if (!href?.startsWith("http")) continue;
      if (isRedirectLink(href)) href = (await resolveRedirectChain(href)) ?? "";
      if (href && await verifyStreamUrl(href))
        results.push({ source: "Hubstream", quality, url: href, size: 0 });
      else console.log("[HUBSTREAM] ❌ Rejected:", href);
    }

    console.log(`[HUBSTREAM] Extracted ${results.length} streams`);
    return results;
  } catch (err) {
    console.log("[HUBSTREAM] Error:", (err as Error).message);
    return [];
  }
}

// ─── HBLinks ─────────────────────────────────────────────────────────────────

export async function hbLinksExtractor(url: string, referer: string, loadExtractorFn: (u: string, r: string) => Promise<ExtractedStream[]>): Promise<ExtractedStream[]> {
  const res    = await fetchWithRetry(url, { Referer: referer });
  const html   = await res.text();
  const links: string[] = [];
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href?.startsWith("http")) continue;
    if (href.includes("hblinks.dad") && !href.includes("/archives/")) continue;
    links.push(href);
  }

  console.log(`[HBLINKS] ${links.length} links → parallel extraction`);
  const all = await Promise.all(links.map((l) => loadExtractorFn(l, url)));
  return all.flat();
}
