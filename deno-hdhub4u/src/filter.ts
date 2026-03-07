import {
  ALLOWED_LANGUAGES,
  BLOCKED_QUALITY_PATTERNS,
  MIN_QUALITY,
} from "./config.ts";
import type { RawStream, FinalStream } from "./types.ts";

// ─── Quality Extraction ───────────────────────────────────────────────────────

export function extractQuality(streamName: string): number {
  const lower = streamName.toLowerCase();
  const match  = lower.match(/(\d{3,4})p/);
  if (match) return parseInt(match[1]);
  if (/2160p|4k|uhd/.test(lower)) return 2160;
  if (/1080p|fhd/.test(lower))    return 1080;
  return 0;
}

export function hasBlockedQuality(streamName: string): boolean {
  for (const pattern of BLOCKED_QUALITY_PATTERNS) {
    if (new RegExp(`\\b${pattern}\\b`, "i").test(streamName)) return true;
  }
  const quality = extractQuality(streamName);
  return quality > 0 && quality < MIN_QUALITY;
}

// ─── Stream Filter ────────────────────────────────────────────────────────────

const BLOCKED_LANGS = ["telugu", "tamil", "kannada", "malayalam"];
const ALLOWED_BINGE = ["_hi", "_gu", "_en"];

export function shouldFilterStream(stream: RawStream): boolean {
  const name      = (stream.name  ?? "").toLowerCase();
  const title     = (stream.title ?? "").toLowerCase();
  const combined  = `${name} ${title}`;
  const bingeGroup = (stream.behaviorHints?.bingeGroup ?? "").toLowerCase();

  // Block low quality
  if (hasBlockedQuality(combined)) return true;

  const titleHasBlocked = BLOCKED_LANGS.some((l) => title.includes(l));
  const titleHasAllowed = ALLOWED_LANGUAGES.some((l) => title.includes(l));

  if (titleHasBlocked || titleHasAllowed) {
    if (titleHasBlocked && !titleHasAllowed) return true;
  } else {
    const codes = bingeGroup.match(/_([a-z]{2})(?=_|$)/g) ?? [];
    if (codes.length > 0) {
      const last           = codes[codes.length - 1];
      const isDuplicateSuffix = codes.filter((c) => c === last).length > 1;
      if (isDuplicateSuffix && !ALLOWED_BINGE.includes(last)) return true;
    }
    if (!ALLOWED_BINGE.some((code) => bingeGroup.includes(code))) return true;
  }

  const quality = extractQuality(combined);
  return quality < MIN_QUALITY;
}

// ─── Metadata Cleaner ─────────────────────────────────────────────────────────

export function cleanStreamMetadata(streams: RawStream[]): RawStream[] {
  return streams.map((stream) => {
    const name  = stream.name  ?? "";
    const title = stream.title ?? "";

    const qualityMatch = title.match(/(\d{3,4}p|4k|uhd)/i);
    const cleanName    = qualityMatch
      ? qualityMatch[1].toLowerCase()
      : name.match(/\d{3,4}p/i)?.[0]?.toLowerCase() ?? "HD";

    const yearMatch    = title.match(/\b(19|20)\d{2}\b/);
    const year         = yearMatch?.[0] ?? "";

    const langMatch    = title.match(/hindi|gujarati|english/i);
    const lang         = langMatch
      ? langMatch[0].charAt(0).toUpperCase() + langMatch[0].slice(1).toLowerCase()
      : "Multi";

    const nameMatch    = title.match(/^(.*?)(?=\s*\d{3,4}p|\s*4k|\s*uhd|\s*\b(19|20)\d{2}\b|\n)/i);
    const movieName    = nameMatch
      ? nameMatch[1].replace(/[._]/g, " ").replace(/[()]/g, "").trim()
      : title.split("\n")[0].trim();

    const cleanTitleLine = `${movieName}  ${year}  ${lang}`.replace(/\s+/g, " ").trim();
    const sizeMatch      = title.match(/(\d+(?:\.\d+)?\s*[GM]B)/i);

    return {
      ...stream,
      name:  cleanName,
      title: cleanTitleLine,
      size:  sizeMatch?.[1] ? (sizeMatch[1] as unknown as number) : stream.size,
    };
  });
}

// ─── Sort Streams ─────────────────────────────────────────────────────────────

const Q_ORDER: Record<string, number> = { "2160p": 10, "4k": 10, "1080p": 8 };

export function sortAndNumberStreams(streams: FinalStream[]): FinalStream[] {
  const sorted = [...streams].sort((a, b) => {
    const aKey = a.name.toLowerCase().replace(/\./g, "").replace(/^\d+\.\s*/, "").trim();
    const bKey = b.name.toLowerCase().replace(/\./g, "").replace(/^\d+\.\s*/, "").trim();
    const diff = (Q_ORDER[bKey] ?? 0) - (Q_ORDER[aKey] ?? 0);
    if (diff !== 0) return diff;
    // Secondary sort: file size descending
    const aSize = parseFloat(a.size) || 0;
    const bSize = parseFloat(b.size) || 0;
    return bSize - aSize;
  });
  return sorted.map((s, i) => ({ ...s, name: `${i + 1}. ${s.name}` }));
}
