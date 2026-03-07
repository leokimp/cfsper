/**
 * HDHub4u — Deno Deploy
 * ──────────────────────────────────────────────────────────────────────────────
 * Entry point — exposes four endpoints:
 *   GET  /streams?tmdbId=&type=movie|tv[&season=&episode=]
 *   POST /cache/clear
 *   GET  /cache/stats
 *   GET  /health
 */

import { triggerDomainUpdate, MAIN_URL, HEADERS, fetchText, transformToProxyUrl } from "./config.ts";
import { getCachedStreams, setCachedStreams, clearAllCache, getCacheStats } from "./cache.ts";
import { performParallelSearch } from "./search.ts";
import { extractLinks } from "./pageParser.ts";
import { webstreamrExtractor } from "./webstreamr.ts";
import { sortAndNumberStreams } from "./filter.ts";
import { formatBytes } from "./utils.ts";
import {
  pixelDrainExtractor,
  hubCloudExtractor,
  hubDriveExtractor,
  hubCdnExtractor,
  hubStreamExtractor,
  hbLinksExtractor,
} from "./extractors.ts";
import { getRedirectLinks } from "./resolver.ts";
import type { FinalStream, ExtractedStream } from "./types.ts";

// ─── CORS Headers ─────────────────────────────────────────────────────────────

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ─── Null-safe query param helper ─────────────────────────────────────────────

function parseNullableParam(raw: string | null): string | undefined {
  if (!raw || raw === "null" || raw === "undefined") return undefined;
  return raw;
}

// ─── Extractor Dispatcher ─────────────────────────────────────────────────────

async function loadExtractor(url: string, referer: string = MAIN_URL): Promise<ExtractedStream[]> {
  if (!url) return [];
  console.log("[EXTRACTOR] Processing:", url);

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (url.includes("?id=") || hostname.includes("techyboy") || hostname.includes("gdtot")) {
      const resolved = await getRedirectLinks(url);
      if (resolved && resolved !== url) return loadExtractor(resolved, url);
      return [];
    }
    if (hostname.includes("hubcloud"))   return hubCloudExtractor(url, referer);
    if (hostname.includes("hubcdn"))     return hubCdnExtractor(url, referer);
    if (hostname.includes("hubdrive"))   return hubDriveExtractor(url, referer);
    if (hostname.includes("pixeldrain")) return pixelDrainExtractor(url);
    if (hostname.includes("hubstream"))  return hubStreamExtractor(url, referer);
    if (hostname.includes("hblinks"))    return hbLinksExtractor(url, referer, loadExtractor);

    console.log("[EXTRACTOR] No matching extractor for:", hostname);
    return [];
  } catch (err) {
    console.log("[EXTRACTOR] Error:", (err as Error).message);
    return [];
  }
}

async function extractLinksInParallel(links: string[], referer: string): Promise<ExtractedStream[]> {
  console.log(`[Parallel] Processing ${links.length} links`);
  const t0      = Date.now();
  const results = await Promise.all(
    links.map((l) => loadExtractor(l, referer).catch(() => []))
  );
  const flat    = results.flat();
  console.log(`[Parallel] Done in ${Date.now() - t0}ms — ${flat.length} streams`);
  return flat;
}

// ─── Deduplication helper ─────────────────────────────────────────────────────

function deduplicateByUrl(streams: FinalStream[]): FinalStream[] {
  const seen = new Set<string>();
  return streams.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

// ─── TV episode title fragment ────────────────────────────────────────────────

function episodeSuffix(season: string | undefined, episode: string | undefined): string {
  if (!season || !episode) return "";
  const s = season.padStart(2, "0");
  const e = episode.padStart(2, "0");
  return `S${s}E${e}`;
}

// ─── Core Stream Fetcher ──────────────────────────────────────────────────────

async function getStreams(
  tmdbId:    string,
  mediaType: string,
  season?:   string,
  episode?:  string
): Promise<FinalStream[]> {
  console.log("[HDHub4u] Starting:", tmdbId, mediaType, season, episode);

  // ── 1. Cache check ──────────────────────────────────────────────────────────
  const cached = await getCachedStreams(tmdbId, mediaType, season, episode);
  if (cached) {
    console.log(`[HDHub4u] ⚡ Cache hit: ${cached.length} streams`);
    triggerDomainUpdate();
    return cached;
  }

  triggerDomainUpdate();

  // ── 2. TMDB metadata ────────────────────────────────────────────────────────
  const tmdbUrl  = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=342c3872f1357c6e1da3a5ac1ccc3605&append_to_response=external_ids`;
  const tmdbInfo = await fetch(tmdbUrl).then((r) => r.json()) as {
    imdb_id?: string;
    external_ids?: { imdb_id?: string };
    title?: string; name?: string;
    release_date?: string; first_air_date?: string;
  };

  const imdbId       = tmdbInfo.imdb_id ?? tmdbInfo.external_ids?.imdb_id;
  const displayTitle = (mediaType === "tv" ? tmdbInfo.name : tmdbInfo.title) ?? "";
  const year =
    mediaType === "movie"
      ? (tmdbInfo.release_date?.split("-")[0] ?? "")
      : (tmdbInfo.first_air_date?.split("-")[0] ?? "");

  // ── 3. WebStreamr + native scrape — fire both in parallel ──────────────────
  const [webstreamrResults, { nativeStreams, updatedTitle }] = await Promise.all([

    // ── 3a. WebStreamr path ──────────────────────────────────────────────────
    (async (): Promise<ExtractedStream[]> => {
      if (!imdbId) return [];
      console.log("[WebStreamr] Fetching for IMDb:", imdbId);
      return webstreamrExtractor(imdbId, mediaType, season, episode);
    })().catch(() => []),

    // ── 3b. Native HDHub4u scrape path ───────────────────────────────────────
    (async (): Promise<{ nativeStreams: FinalStream[]; updatedTitle: string }> => {
      try {
        const searchQueue: string[] = [];
        let updatedTitle = displayTitle;

        if (imdbId) {
          const [imdbRes, akasRes] = await Promise.all([
            fetch(`https://api.imdbapi.dev/titles/${imdbId}`)
              .then((r) => r.json())
              .catch(() => null) as Promise<{ originalTitle?: string; primaryTitle?: string } | null>,
            fetch(`https://api.imdbapi.dev/titles/${imdbId}/akas`)
              .then((r) => r.json())
              .catch(() => ({ akas: [] })) as Promise<{ akas?: { text: string; country?: { code: string } }[] }>,
          ]);

          if (imdbRes) {
            if (imdbRes.originalTitle) searchQueue.push(imdbRes.originalTitle);
            if (imdbRes.primaryTitle && !searchQueue.includes(imdbRes.primaryTitle))
              searchQueue.push(imdbRes.primaryTitle);
            updatedTitle = imdbRes.originalTitle ?? imdbRes.primaryTitle ?? displayTitle;
          }

          const indianAkas = (akasRes.akas ?? [])
            .filter((a) => a.country?.code === "IN")
            .map((a) => a.text)
            .filter((t) => /^[\w\s\-':.!&–—(),]+$/.test(t));

          for (const aka of indianAkas)
            if (!searchQueue.includes(aka)) searchQueue.push(aka);
        }

        if (!searchQueue.length) searchQueue.push(updatedTitle);

        const { results: searchResults } = await performParallelSearch(searchQueue, year);
        if (!searchResults.length) {
          console.log("[HDHub4u] No search results");
          return { nativeStreams: [], updatedTitle };
        }

        const bestMatch = searchResults.find((r) =>
          mediaType === "tv" && season
            ? r.title.toLowerCase().includes(`season ${season}`)
            : true
        );

        if (!bestMatch) {
          console.log("[HDHub4u] No match");
          return { nativeStreams: [], updatedTitle };
        }

        console.log("[HDHub4u] Page:", bestMatch.title);
        const pageHtml = await fetchText(bestMatch.url);
        const links    = extractLinks(pageHtml, mediaType, season, episode);
        console.log(`[HDHub4u] ${links.length} candidate links`);

        const extracted = await extractLinksInParallel(links, bestMatch.url);
        const streams: FinalStream[] = [];

        for (const res of extracted) {
          if (!res?.url || res.quality === "Unknown") continue;
          if (res.quality.includes("480p") || res.quality.includes("720p")) continue;

          const epSuffix = episodeSuffix(season, episode);
          const title    = [
            updatedTitle,
            year ? `(${year})` : "",
            epSuffix,
          ].filter(Boolean).join(" ");

          streams.push({
            name:    res.quality,
            title,
            url:     transformToProxyUrl(res.url),
            size:    formatBytes(res.size),
            headers: HEADERS,
          });
        }

        return { nativeStreams: streams, updatedTitle };
      } catch (err) {
        console.log("[HDHub4u Native Error]:", (err as Error).message);
        return { nativeStreams: [], updatedTitle: displayTitle };
      }
    })(),
  ]);

  // ── 4. Merge native + WebStreamr ─────────────────────────────────────────
  const merged: FinalStream[] = [...nativeStreams];

  for (const res of (webstreamrResults ?? [])) {
    if (!res?.url) continue;

    const epSuffix = episodeSuffix(season, episode);
    const title    = [
      updatedTitle,
      year ? `(${year})` : "",
      epSuffix,
    ].filter(Boolean).join(" ");

    merged.push({
      name:    res.quality,
      title,
      url:     transformToProxyUrl(res.url),
      size:    res.sizeText || formatBytes(res.size),
      headers: HEADERS,
    });
  }

  if (!merged.length) {
    console.log("[HDHub4u] No streams found");
    return [];
  }

  // ── 5. Deduplicate by URL ─────────────────────────────────────────────────
  const deduped = deduplicateByUrl(merged);
  if (deduped.length < merged.length) {
    console.log(`[HDHub4u] Deduped: ${merged.length} → ${deduped.length} streams`);
  }

  // ── 6. Sort + number ──────────────────────────────────────────────────────
  const final = sortAndNumberStreams(deduped);
  console.log(`[HDHub4u] ✅ ${final.length} streams`);

  // ── 7. Cache in background (non-blocking) ────────────────────────────────
  // In Deno, background promises are NOT killed when the response is sent.
  // No waitUntil() needed — just fire and forget.
  setCachedStreams(tmdbId, mediaType, season, episode, final, 3600)
    .then(() => getCacheStats())
    .then((stats) => console.log(`[CACHE] Saved — ${stats.totalEntries ?? 0} entries`))
    .catch((err: Error) => console.log("[CACHE] Background save error:", err.message));

  return final;
}

// ─── Deno HTTP Handler ────────────────────────────────────────────────────────

async function handler(request: Request): Promise<Response> {
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method.toUpperCase();

  // Preflight
  if (method === "OPTIONS") return new Response(null, { headers: CORS });

  // ── Health check ────────────────────────────────────────────────────────────
  if (path === "/health") {
    return json({ status: "ok", server: "hdhub4u-deno", ts: Date.now() });
  }

  // ── Cache clear ─────────────────────────────────────────────────────────────
  if (path === "/cache/clear" && method === "POST") {
    const ok = await clearAllCache();
    return json({ success: ok });
  }

  // ── Cache stats ─────────────────────────────────────────────────────────────
  if (path === "/cache/stats") {
    const stats = await getCacheStats();
    return json(stats);
  }

  // ── Main streams endpoint ───────────────────────────────────────────────────
  if (path === "/streams") {
    const tmdbId    = url.searchParams.get("tmdbId");
    const mediaType = url.searchParams.get("type") ?? url.searchParams.get("mediaType");
    const season    = parseNullableParam(url.searchParams.get("season"));
    const episode   = parseNullableParam(url.searchParams.get("episode"));

    if (!tmdbId || !mediaType) {
      return json({ error: "Missing required params: tmdbId, type" }, 400);
    }
    if (!["movie", "tv"].includes(mediaType)) {
      return json({ error: "type must be 'movie' or 'tv'" }, 400);
    }
    if (mediaType === "tv" && (!season || !episode)) {
      return json({ error: "season and episode required for tv" }, 400);
    }

    try {
      const streams = await getStreams(tmdbId, mediaType, season, episode);
      return json({ streams, count: streams.length });
    } catch (err) {
      console.error("[Server] Critical error:", err);
      return json({ error: "Internal server error", streams: [] }, 500);
    }
  }

  // ── 404 ─────────────────────────────────────────────────────────────────────
  return json(
    {
      error:     "Not found",
      endpoints: [
        "GET  /streams?tmdbId=&type=movie|tv[&season=&episode=]",
        "GET  /cache/stats",
        "POST /cache/clear",
        "GET  /health",
      ],
    },
    404
  );
}

// ─── Start Server ─────────────────────────────────────────────────────────────

const port = parseInt(Deno.env.get("PORT") ?? "8000");
console.log(`[HDHub4u] 🦕 Deno server running on http://localhost:${port}`);
Deno.serve({ port }, handler);
