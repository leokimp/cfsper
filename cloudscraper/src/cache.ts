import { CACHE_API_BASE, DEFAULT_TTL } from "./config.ts";
import type { FinalStream, CacheStats } from "./types.ts";

// ─── Key ──────────────────────────────────────────────────────────────────────

function cacheKey(
  tmdbId: string,
  mediaType: string,
  season?: string | number | null,
  episode?: string | number | null
): string {
  return `${tmdbId}_${mediaType}_${season ?? "null"}_${episode ?? "null"}`;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getCachedStreams(
  tmdbId: string,
  mediaType: string,
  season?: string | number | null,
  episode?: string | number | null
): Promise<FinalStream[] | null> {
  const key = cacheKey(tmdbId, mediaType, season, episode);
  try {
    console.log("[CACHE] Fetching:", key);
    const res = await fetch(`${CACHE_API_BASE}/${key}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 404) { console.log("[CACHE] Miss:", key); return null; }
    if (!res.ok)            { console.log("[CACHE] Error:", res.status); return null; }

    const data = (await res.json()) as { streams?: FinalStream[] };
    if (!data?.streams || !Array.isArray(data.streams)) {
      console.log("[CACHE] Invalid format");
      return null;
    }
    console.log(`[CACHE] Hit: ${key} (${data.streams.length} streams)`);
    return data.streams;
  } catch (err) {
    console.log("[CACHE] Fetch error:", (err as Error).message);
    return null;
  }
}

// ─── Set ──────────────────────────────────────────────────────────────────────

export async function setCachedStreams(
  tmdbId: string,
  mediaType: string,
  season: string | number | null | undefined,
  episode: string | number | null | undefined,
  streams: FinalStream[],
  ttl: number = DEFAULT_TTL
): Promise<boolean> {
  const key = cacheKey(tmdbId, mediaType, season, episode);
  try {
    console.log(`[CACHE] Saving: ${key} (${streams.length} streams, TTL: ${ttl}s)`);
    const res = await fetch(CACHE_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        streams,
        ttl,
        metadata: { tmdbId, mediaType, season, episode, timestamp: Date.now() },
      }),
    });
    if (!res.ok) { console.log("[CACHE] Save failed:", res.status); return false; }
    console.log("[CACHE] Saved ✓");
    return true;
  } catch (err) {
    console.log("[CACHE] Save error:", (err as Error).message);
    return false;
  }
}

// ─── Clear All ────────────────────────────────────────────────────────────────

export async function clearAllCache(): Promise<boolean> {
  try {
    const res = await fetch(`${CACHE_API_BASE}/clearall`, { method: "POST" });
    if (res.ok) { console.log("[CACHE] All cleared ✓"); return true; }
    console.log("[CACHE] Clear failed:", res.status);
    return false;
  } catch (err) {
    console.log("[CACHE] Clear error:", (err as Error).message);
    return false;
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getCacheStats(): Promise<CacheStats> {
  try {
    const res = await fetch(`${CACHE_API_BASE}/stats`, { method: "GET" });
    if (!res.ok) return { totalEntries: 0, totalSize: 0, error: "Failed to fetch stats" };
    return (await res.json()) as CacheStats;
  } catch (err) {
    return { totalEntries: 0, totalSize: 0, error: (err as Error).message };
  }
}
