/**
 * Brave Search Provider Implementation
 *
 * Adapter that wraps the existing Brave Search service to implement SearchProvider interface
 */

import type {
  SearchProvider,
  SearchFilters,
  SearchResultItem,
  SearchResponse,
} from "../../interfaces/search-provider";
import {
  searchWeb as braveSearchWeb,
  searchWithRetry as braveSearchRetry,
  searchMultipleQueries as braveSearchMultiple,
  initializeBraveSearch as initBrave,
} from "../brave-search/client";
import type {
  BraveSearchResponse,
  BraveSearchResult,
} from "../brave-search/types";

/**
 * Brave Search implementation of SearchProvider
 */
export class BraveSearchProvider implements SearchProvider {
  private initialized: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      initBrave(apiKey);
      this.initialized = true;
    }
  }

  /**
   * Ensure the provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "Brave Search provider not initialized. Call initializeBraveSearch() first or provide API key in constructor."
      );
    }
  }

  /**
   * Convert Brave-specific result to generic SearchResultItem
   */
  private convertResult(braveResult: BraveSearchResult): SearchResultItem {
    return {
      title: braveResult.title,
      url: braveResult.url,
      description: braveResult.description,
      publishedDate: braveResult.published_date,
      thumbnail: braveResult.thumbnail,
      language: braveResult.language,
      meta: braveResult.meta_url
        ? {
            hostname: braveResult.meta_url.hostname,
            path: braveResult.meta_url.path,
          }
        : undefined,
    };
  }

  /**
   * Convert Brave response to generic SearchResponse
   */
  private convertResponse(braveResponse: BraveSearchResponse): SearchResponse {
    return {
      query: braveResponse.query,
      results: braveResponse.results.map((r) => this.convertResult(r)),
      totalResults: braveResponse.totalResults,
    };
  }

  /**
   * Execute a single web search
   */
  async search(
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResponse> {
    this.ensureInitialized();

    // Use retry logic for reliability
    const braveResponse = await braveSearchRetry(query, filters, 3);
    return this.convertResponse(braveResponse);
  }

  /**
   * Execute multiple searches (with built-in rate limiting)
   */
  async searchMultiple(
    queries: string[],
    filters?: SearchFilters
  ): Promise<Map<string, SearchResponse>> {
    this.ensureInitialized();

    // Use existing Brave search multiple function
    const braveResults = await braveSearchMultiple(queries, filters);

    // Convert results to generic format
    const results = new Map<string, SearchResponse>();
    for (const [query, braveResponse] of braveResults.entries()) {
      results.set(query, this.convertResponse(braveResponse));
    }

    return results;
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return "Brave Search";
  }
}

/**
 * Factory function to create Brave Search provider
 */
export function createBraveSearchProvider(apiKey: string): BraveSearchProvider {
  return new BraveSearchProvider(apiKey);
}
