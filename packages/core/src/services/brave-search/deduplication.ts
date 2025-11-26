/**
 * URL normalization and deduplication utilities
 */

import type { BraveSearchResult, BraveSearchResponse } from "./types";

/**
 * Normalize URL for deduplication
 * Removes query params, fragments, trailing slashes, and www prefix
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove www prefix
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Remove trailing slash from pathname
    let pathname = urlObj.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Reconstruct without query params and hash
    return `${urlObj.protocol}//${hostname}${pathname}`;
  } catch (error) {
    // If URL parsing fails, return original URL
    return url.toLowerCase();
  }
}

/**
 * Deduplicate search results across multiple responses
 */
export function deduplicateResults(
  responses: BraveSearchResponse[],
  alreadyProcessedUrls?: Set<string>
): BraveSearchResult[] {
  const seenUrls = new Set<string>(alreadyProcessedUrls || []);
  const uniqueResults: BraveSearchResult[] = [];

  for (const response of responses) {
    for (const result of response.results) {
      const normalizedUrl = normalizeUrl(result.url);

      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueResults.push(result);
      }
    }
  }

  return uniqueResults;
}
