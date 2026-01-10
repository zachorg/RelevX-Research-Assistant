/**
 * Brave Search API client
 * Handles API initialization, rate limiting, and core search functionality
 */

import type { SearchFilters, BraveSearchResponse } from "./types";
import { buildQueryWithFilters } from "./filters";

// Brave Search API configuration
let braveApiKey: string | null = null;
const BRAVE_SEARCH_API_URL = "https://api.search.brave.com/res/v1/news/search";

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 1 second between requests

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

  // Add freshness filter - prioritize explicit freshness parameter
  if (filters?.freshness) {
    // Use the freshness parameter directly (pd, pw, pm, py, or custom date range)
    params.append("freshness", filters.freshness);
  } else if (filters?.dateFrom && filters?.dateTo) {
    // Use custom date range format: YYYY-MM-DDtoYYYY-MM-DD
    params.append("freshness", `${filters.dateFrom}to${filters.dateTo}`);
  } else if (filters?.dateFrom) {
    // Calculate relative freshness from dateFrom
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

    // Extract results - News API returns results directly, Web API uses data.web.results
    const webResults = data.results || data.web?.results || [];

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
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(error: Error): boolean {
  return (
    error.message.includes("429") || error.message.includes("RATE_LIMITED")
  );
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
        // Use longer delay for rate limit errors
        let delay: number;
        if (isRateLimitError(lastError)) {
          // For rate limit errors, wait at least 2 seconds, then exponential backoff
          delay = Math.min(2000 * Math.pow(2, attempt - 1), 15000);
          console.log(`Rate limit hit, waiting ${delay}ms before retry...`);
        } else {
          // Standard exponential backoff for other errors
          delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        }
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
      // If we failed due to rate limiting, wait extra time before next query
      if (error instanceof Error && isRateLimitError(error)) {
        console.log(
          "Adding extra delay after rate limit failure before next query..."
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      // Continue with other queries even if one fails
    }
  }

  return results;
}
