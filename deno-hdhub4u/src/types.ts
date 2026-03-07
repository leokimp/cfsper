// ─── Stream Types ─────────────────────────────────────────────────────────────

export interface RawStream {
  name?: string;
  title?: string;
  url?: string;
  size?: number;
  behaviorHints?: {
    bingeGroup?: string;
    videoSize?: number;
  };
}

export interface ExtractedStream {
  source: string;
  quality: string;
  url: string;
  size: number;
  filename?: string;
  sizeText?: string;
}

export interface FinalStream {
  name: string;
  title: string;
  url: string;
  size: string;
  headers: Record<string, string>;
}

export interface LinkMetadata {
  url: string;
  requiresQualityCheck: boolean;
  preFilteredQuality: boolean;
}

// ─── Search Types ──────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  source: string;
  searchedTitle: string;
  titleScore?: number;
  rankScore?: number;
  usedQuery?: string;
}

export interface ScoredResult extends SearchResult {
  titleScore: number;
  rankScore: number;
  usedQuery: string;
}

export interface SearchResponse {
  results: ScoredResult[];
  usedTitle: string;
}

// ─── TMDB / IMDb Types ────────────────────────────────────────────────────────

export interface TMDBResponse {
  imdb_id?: string;
  external_ids?: { imdb_id?: string };
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
}

export interface IMDbResponse {
  originalTitle?: string;
  primaryTitle?: string;
}

export interface IMDbAka {
  text: string;
  country?: { code: string };
}

export interface IMDbAkasResponse {
  akas?: IMDbAka[];
}

// ─── Cache Types ──────────────────────────────────────────────────────────────

export interface CacheMetadata {
  tmdbId: string;
  mediaType: string;
  season?: string | number | null;
  episode?: string | number | null;
  timestamp: number;
}

export interface CachePayload {
  key: string;
  streams: FinalStream[];
  ttl: number;
  metadata: CacheMetadata;
}

export interface CacheResponse {
  streams: FinalStream[];
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  error?: string;
}

// ─── Pingora Types ────────────────────────────────────────────────────────────

export interface PingoraHit {
  document: {
    post_title: string;
    permalink: string;
  };
}

export interface PingoraResponse {
  hits?: PingoraHit[];
}

// ─── Runtime Env (Deno) ───────────────────────────────────────────────────────
// Environment variables are accessed via Deno.env.get("VAR_NAME")
// No interface needed — kept here as documentation only.
// export interface Env { TMDB_API_KEY?: string; }

// ─── Quality Markers (TV) ────────────────────────────────────────────────────

export interface QualityMarker {
  quality: string;
  index: number;
  isHighQuality: boolean;
}

// ─── NativeScrape Return ─────────────────────────────────────────────────────

export interface NativeScrapeResult {
  nativeStreams: FinalStream[];
  updatedTitle: string;
}
