import { WEBSTREAMR_BASE_URL, fetchWithRetry } from "./config.ts";
import { shouldFilterStream, cleanStreamMetadata } from "./filter.ts";
import type { ExtractedStream, RawStream } from "./types.ts";

export async function webstreamrExtractor(
  imdbId: string,
  mediaType: string,
  season?: string | number | null,
  episode?: string | number | null
): Promise<ExtractedStream[]> {
  console.log("[WEBSTREAMR] Starting:", { imdbId, mediaType, season, episode });
  if (!imdbId) return [];

  try {
    const endpoint =
      mediaType === "movie"
        ? `/stream/movie/${imdbId}.json`
        : mediaType === "tv" && season && episode
        ? `/stream/series/${imdbId}:${season}:${episode}.json`
        : null;

    if (!endpoint) { console.log("[WEBSTREAMR] Invalid params"); return []; }

    const url      = `${WEBSTREAMR_BASE_URL}${endpoint}`;
    console.log("[WEBSTREAMR] Fetching:", url);

    const response = await fetchWithRetry(url);
    const data     = (await response.json()) as { streams?: RawStream[] };

    if (!data.streams?.length) { console.log("[WEBSTREAMR] No streams"); return []; }

    const filtered = data.streams.filter((s) => !shouldFilterStream(s));
    console.log(`[WEBSTREAMR] After filter: ${filtered.length} streams`);
    if (!filtered.length) return [];

    const cleaned = cleanStreamMetadata(filtered);
    return cleaned.map((stream) => ({
      source:   "WebStreamr",
      quality:  `${stream.name ?? "Unknown"}.`,
      url:      stream.url ?? "",
      size:     stream.behaviorHints?.videoSize ?? 0,
      filename: stream.title,
      sizeText: String(stream.size ?? ""),
    }));
  } catch (err) {
    console.log("[WEBSTREAMR] Error:", (err as Error).message);
    return [];
  }
}
