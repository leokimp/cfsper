import { PINGORA_API_URL, MAIN_URL, fetchWithRetry } from "./config.ts";
import { calcTitleSim } from "./utils.ts";
import type { SearchResult, ScoredResult, SearchResponse, PingoraResponse } from "./types.ts";

// ─── Single Search ────────────────────────────────────────────────────────────

async function performSingleSearch(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.replace(/Season \d+/i, "").trim();
  const params = new URLSearchParams({
    q:        cleanQuery,
    query_by: "post_title",
    sort_by:  "sort_by_date:desc",
  });

  // ── Pingora (fast search index) ──
  // Isolated in its own try/catch so any failure (HTML response, network error)
  // falls through cleanly to the native site search below.
  try {
    const res = await fetchWithRetry(`${PINGORA_API_URL}?${params}`);
    const ct  = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as PingoraResponse;
      console.log(`[Search] Pingora hits for "${query}":`, data.hits?.length ?? 0);
      if (data.hits?.length) {
        return data.hits.map((hit) => ({
          title:         hit.document.post_title,
          url:           MAIN_URL + hit.document.permalink,
          source:        "Pingora",
          searchedTitle: query,
        }));
      }
    } else {
      console.log(`[Search] Pingora returned non-JSON (${res.status}), falling back to native`);
    }
  } catch (err) {
    console.log(`[Search] Pingora error for "${query}":`, (err as Error).message);
  }

  // ── Fallback: native site search ──
  try {
    console.log(`[Search] Native fallback for "${cleanQuery}"`);
    const nativeRes    = await fetchWithRetry(`${MAIN_URL}/?s=${encodeURIComponent(cleanQuery)}`);
    const html         = await nativeRes.text();
    const articleRegex = /<article[^>]*>.*?<\/article>/gis;
    const articles     = html.match(articleRegex) ?? [];
    console.log(`[Search] Native articles for "${cleanQuery}":`, articles.length);

    return articles.flatMap((article): SearchResult[] => {
      const m = article.match(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/i);
      if (!m) return [];
      const url   = m[1];
      const title = m[2].replace(/<[^>]*>/g, "").trim();
      if (!url || !title) return [];
      return [{ title, url, source: "Native", searchedTitle: query }];
    });
  } catch (err) {
    console.log(`[Search] Native fallback error for "${query}":`, (err as Error).message);
    return [];
  }
}

// ─── Parallel Search with Scoring ────────────────────────────────────────────

export async function performParallelSearch(
  queries: string[],
  year?: string
): Promise<SearchResponse> {
  console.log("[Search] Queue:", queries);

  const allResults = await Promise.all(queries.map((q) => performSingleSearch(q)));
  const scored: ScoredResult[] = [];

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

      scored.push({ ...r, titleScore, rankScore, usedQuery: queries[i] });
    }
  }

  if (!scored.length) return { results: [], usedTitle: "" };

  scored.sort((a, b) => b.rankScore - a.rankScore);

  const seen   = new Set<string>();
  const unique = scored.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return { results: unique, usedTitle: unique[0].usedQuery };
}
