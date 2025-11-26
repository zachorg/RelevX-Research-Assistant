/**
 * Deduplication utilities
 *
 * Functions for URL normalization, duplicate detection,
 * and managing processed content history.
 */

import type { ProcessedUrl } from "../models/search-history";

/**
 * Normalize URL for consistent comparison
 * - Remove www prefix
 * - Remove trailing slashes
 * - Remove query parameters and fragments
 * - Convert to lowercase
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Normalize hostname (remove www)
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Normalize pathname (remove trailing slash)
    let pathname = urlObj.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Return protocol + hostname + pathname (no query/hash)
    return `${urlObj.protocol}//${hostname}${pathname}`;
  } catch (error) {
    // If URL parsing fails, just lowercase and return
    return url.toLowerCase().trim();
  }
}
