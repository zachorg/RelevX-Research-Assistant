/**
 * Search Provider Interface
 *
 * Abstract interface for web search providers.
 * Allows switching between Brave Search, Google, Bing, ScrapingBee, etc.
 */

/**
 * Search freshness filter values
 * - pd: Past day (24 hours)
 * - pw: Past week (7 days)
 * - pm: Past month (31 days)
 * - py: Past year (365 days)
 * - Custom date range: YYYY-MM-DDtoYYYY-MM-DD
 */
export type SearchFreshness = "pd" | "pw" | "pm" | "py" | string;

/**
 * Search filters for customizing queries
 */
export interface SearchFilters {
  // Date filtering
  dateFrom?: string; // ISO date string (YYYY-MM-DD) - used for custom date range
  dateTo?: string; // ISO date string (YYYY-MM-DD) - used for custom date range
  freshness?: SearchFreshness; // Freshness parameter (pd, pw, pm, py, or custom range)

  // Location/language
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
  language?: string; // ISO 639-1 language code (e.g., "en", "es")

  // Result configuration
  count?: number; // Number of results to return (default: 20)
  offset?: number; // Pagination offset

  // Content filtering
  safesearch?: "off" | "moderate" | "strict"; // Safe search level

  // Site filtering (applied to query string)
  includeDomains?: string[]; // Domains to prioritize
  excludeDomains?: string[]; // Domains to exclude
}

/**
 * Single search result (provider-agnostic)
 */
export interface SearchResultItem {
  title: string;
  url: string;
  description: string;
  publishedDate?: string; // ISO date string
  thumbnail?: {
    src: string;
    alt?: string;
  };
  language?: string;
  meta?: Record<string, any>; // Provider-specific metadata
}

/**
 * Search response (provider-agnostic)
 */
export interface SearchResponse {
  query: string; // The query that was executed
  results: SearchResultItem[];
  totalResults: number;
  metadata?: Record<string, any>; // Provider-specific metadata
}

/**
 * Search Provider interface
 * All search providers must implement these methods
 */
export interface SearchProvider {
  /**
   * Execute a single web search
   */
  search(query: string, filters?: SearchFilters): Promise<SearchResponse>;

  /**
   * Execute multiple searches (with built-in rate limiting)
   */
  searchMultiple(
    queries: string[],
    filters?: SearchFilters
  ): Promise<Map<string, SearchResponse>>;

  /**
   * Get the provider name
   */
  getName(): string;
}
