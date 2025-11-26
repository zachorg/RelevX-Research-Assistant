/**
 * Query filtering and building utilities
 */

import type { SearchFilters } from "./types";

/**
 * Build query string with site filters
 */
export function buildQueryWithFilters(
  query: string,
  filters?: SearchFilters
): string {
  let modifiedQuery = query;

  // Add site: operators for included domains
  if (filters?.includeDomains && filters.includeDomains.length > 0) {
    const siteFilters = filters.includeDomains
      .map((domain) => `site:${domain}`)
      .join(" OR ");
    modifiedQuery = `${modifiedQuery} (${siteFilters})`;
  }

  // Add -site: operators for excluded domains
  if (filters?.excludeDomains && filters.excludeDomains.length > 0) {
    const excludeFilters = filters.excludeDomains
      .map((domain) => `-site:${domain}`)
      .join(" ");
    modifiedQuery = `${modifiedQuery} ${excludeFilters}`;
  }

  return modifiedQuery.trim();
}
