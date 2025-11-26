/**
 * Brave Search API client
 * Handles API initialization, rate limiting, and core search functionality
 */

import type { SearchFilters, BraveSearchResponse } from "./types";
import { buildQueryWithFilters } from "./filters";

// Brave Search API configuration
let braveApiKey: string | null = null;
const BRAVE_SEARCH_API_URL = "https://api.search.brave.com/res/v1/web/search";

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

/**
 * Initialize Brave Search API
 */
export function initializeBraveSearch(apiKey: string): void {
  braveApiKey = apiKey;
}

/**
 * Get the API key
 */
function getApiKey(): string {
  if (!braveApiKey) {
    throw new Error(
      "Brave Search API key not initialized. Call initializeBraveSearch() first."
    );
  }
  return braveApiKey;
}

/**
 * Rate limiting delay
 */
async function applyRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Search the web using Brave Search API
 */
export async function searchWeb(
  query: string,
  filters?: SearchFilters
): Promise<BraveSearchResponse> {
  const apiKey = getApiKey();

  // Apply rate limiting
  await applyRateLimit();

  // Build query with site filters
  const modifiedQuery = buildQueryWithFilters(query, filters);

  // Build URL parameters
  const params = new URLSearchParams({
    q: modifiedQuery,
    count: (filters?.count || 20).toString(),
  });

  if (filters?.offset) {
    params.append("offset", filters.offset.toString());
  }

  if (filters?.country) {
    params.append("country", filters.country);
  }

  if (filters?.language) {
    params.append("search_lang", filters.language);
  }

  if (filters?.safesearch) {
    params.append("safesearch", filters.safesearch);
  }

  // Add date filters using freshness parameter
  if (filters?.dateFrom || filters?.dateTo) {
    // Brave uses "freshness" parameter with values like "pd" (past day), "pw" (past week), etc.
    // For custom date ranges, we'll calculate relative time
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= 1) {
        params.append("freshness", "pd"); // Past day
      } else if (daysDiff <= 7) {
        params.append("freshness", "pw"); // Past week
      } else if (daysDiff <= 30) {
        params.append("freshness", "pm"); // Past month
      } else if (daysDiff <= 365) {
        params.append("freshness", "py"); // Past year
      }
    }
  }

  const url = `${BRAVE_SEARCH_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Brave Search API error (${response.status}): ${errorText}`
      );
    }

    const data: any = await response.json();

    // Extract web results
    const webResults = data.web?.results || [];

    return {
      query: modifiedQuery,
      results: webResults.map((result: any) => ({
        title: result.title || "",
        url: result.url || "",
        description: result.description || "",
        published_date: result.age,
        thumbnail: result.thumbnail
          ? {
              src: result.thumbnail.src,
              alt: result.thumbnail.alt,
            }
          : undefined,
        language: result.language,
        meta_url: result.meta_url,
      })),
      totalResults: webResults.length,
    };
  } catch (error) {
    console.error("Error searching with Brave:", error);
    throw error;
  }
}

/**
 * Search with retry logic
 */
export async function searchWithRetry(
  query: string,
  filters?: SearchFilters,
  maxRetries: number = 3
): Promise<BraveSearchResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await searchWeb(query, filters);
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Search attempt ${attempt}/${maxRetries} failed for query "${query}":`,
        error
      );

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to search after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Execute multiple search queries
 */
export async function searchMultipleQueries(
  queries: string[],
  filters?: SearchFilters
): Promise<Map<string, BraveSearchResponse>> {
  const results = new Map<string, BraveSearchResponse>();

  for (const query of queries) {
    try {
      const response = await searchWithRetry(query, filters);
      results.set(query, response);
    } catch (error) {
      console.error(`Failed to search query "${query}":`, error);
      // Continue with other queries even if one fails
    }
  }

  return results;
}
