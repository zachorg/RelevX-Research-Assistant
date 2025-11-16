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

/**
 * Check if a URL is a duplicate
 */
export function isDuplicate(
  url: string,
  processedUrls: ProcessedUrl[]
): boolean {
  const normalizedUrl = normalizeUrl(url);
  return processedUrls.some((p) => p.normalizedUrl === normalizedUrl);
}

/**
 * Add URL to processed list
 */
export function addToProcessed(
  url: string,
  processedUrls: ProcessedUrl[],
  relevancyScore?: number,
  wasIncluded: boolean = false
): ProcessedUrl[] {
  const normalizedUrl = normalizeUrl(url);
  const now = Date.now();

  // Check if already exists
  const existing = processedUrls.find((p) => p.normalizedUrl === normalizedUrl);

  if (existing) {
    // Update existing entry
    existing.timesFound++;
    existing.lastRelevancyScore = relevancyScore;
    existing.wasIncluded = existing.wasIncluded || wasIncluded;
    return processedUrls;
  }

  // Add new entry
  const newProcessed: ProcessedUrl = {
    url,
    normalizedUrl,
    firstSeenAt: now,
    timesFound: 1,
    lastRelevancyScore: relevancyScore,
    wasIncluded,
  };

  return [...processedUrls, newProcessed];
}

/**
 * Filter out duplicate URLs from an array
 */
export function filterDuplicates(
  urls: string[],
  processedUrls?: ProcessedUrl[]
): string[] {
  const seen = new Set<string>();
  const filtered: string[] = [];

  // Add already processed URLs to seen set
  if (processedUrls) {
    processedUrls.forEach((p) => seen.add(p.normalizedUrl));
  }

  // Filter new URLs
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      filtered.push(url);
    }
  }

  return filtered;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    
    // Remove www prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch (error) {
    return "";
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  return domain1 === domain2 && domain1 !== "";
}

/**
 * Group URLs by domain
 */
export function groupByDomain(urls: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const url of urls) {
    const domain = extractDomain(url);
    if (domain) {
      const existing = grouped.get(domain) || [];
      existing.push(url);
      grouped.set(domain, existing);
    }
  }

  return grouped;
}

/**
 * Calculate similarity between two URLs (0-100)
 * Based on path similarity
 */
export function calculateUrlSimilarity(url1: string, url2: string): number {
  try {
    const urlObj1 = new URL(url1);
    const urlObj2 = new URL(url2);

    // Different domains = 0% similar
    if (extractDomain(url1) !== extractDomain(url2)) {
      return 0;
    }

    // Same domain, compare paths
    const path1 = urlObj1.pathname.split("/").filter((p) => p);
    const path2 = urlObj2.pathname.split("/").filter((p) => p);

    if (path1.length === 0 && path2.length === 0) {
      return 100; // Both are root paths
    }

    // Calculate path segment overlap
    const maxLength = Math.max(path1.length, path2.length);
    let matchCount = 0;

    for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
      if (path1[i] === path2[i]) {
        matchCount++;
      } else {
        break; // Stop at first mismatch
      }
    }

    return Math.round((matchCount / maxLength) * 100);
  } catch (error) {
    return 0;
  }
}

/**
 * Create a map for quick duplicate lookup
 */
export function createUrlIndex(
  processedUrls: ProcessedUrl[]
): Map<string, ProcessedUrl> {
  const index = new Map<string, ProcessedUrl>();
  
  for (const processed of processedUrls) {
    index.set(processed.normalizedUrl, processed);
  }
  
  return index;
}

/**
 * Batch check if URLs are duplicates
 * Returns array of booleans matching input array order
 */
export function checkDuplicates(
  urls: string[],
  processedUrls: ProcessedUrl[]
): boolean[] {
  const index = createUrlIndex(processedUrls);
  
  return urls.map((url) => {
    const normalized = normalizeUrl(url);
    return index.has(normalized);
  });
}

