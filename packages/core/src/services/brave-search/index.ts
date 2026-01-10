/**
 * Brave Search API service
 *
 * Handles web search via Brave Search API with:
 * - Rate limiting (1 request per second)
 * - Query filtering and parameter support
 * - Result deduplication
 * - Error handling and retries
 */

export {
  initializeBraveSearch,
  searchWeb,
  searchWithRetry,
  searchMultipleQueries,
} from "./client";
export { normalizeUrl, deduplicateResults } from "./deduplication";
export { buildQueryWithFilters } from "./filters";
export type {
  SearchFilters,
  BraveSearchResult,
  BraveSearchResponse,
  BraveFreshness,
} from "./types";
