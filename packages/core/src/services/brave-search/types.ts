/**
 * Type definitions for Brave Search service
 */

/**
 * Brave Search freshness filter values
 * - pd: Past day (24 hours)
 * - pw: Past week (7 days)
 * - pm: Past month (31 days)
 * - py: Past year (365 days)
 * - Custom date range: YYYY-MM-DDtoYYYY-MM-DD
 */
export type BraveFreshness = "pd" | "pw" | "pm" | "py" | string;

/**
 * Search filters for customizing queries
 */
export interface SearchFilters {
  // Date filtering
  dateFrom?: string; // ISO date string (YYYY-MM-DD) - used for custom date range
  dateTo?: string; // ISO date string (YYYY-MM-DD) - used for custom date range
  freshness?: BraveFreshness; // Brave API freshness parameter (pd, pw, pm, py, or custom range)

  // Location/language
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
  language?: string; // ISO 639-1 language code (e.g., "en", "es")

  // Result configuration
  count?: number; // Number of results to return (default: 20, max: 20)
  offset?: number; // Pagination offset

  // Content filtering
  safesearch?: "off" | "moderate" | "strict"; // Safe search level

  // Site filtering (applied to query string)
  includeDomains?: string[]; // Domains to prioritize
  excludeDomains?: string[]; // Domains to exclude
}

/**
 * Single search result from Brave
 */
export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  published_date?: string; // ISO date string
  thumbnail?: {
    src: string;
    alt?: string;
  };
  language?: string;
  meta_url?: {
    hostname: string;
    path: string;
  };
}

/**
 * Brave Search API response
 */
export interface BraveSearchResponse {
  query: string;
  results: BraveSearchResult[];
  totalResults: number;
}
