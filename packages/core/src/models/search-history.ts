/**
 * SearchHistory data model
 *
 * Tracks processed URLs and query performance for a project to avoid duplicates
 * and optimize future searches. Stored as a single document per project.
 * Firestore path: users/{userId}/projects/{projectId}/metadata/searchHistory
 */

/**
 * Performance metrics for a search query
 */
export interface QueryPerformance {
  query: string; // The search query
  timesUsed: number; // How many times this query was executed
  urlsFound: number; // Total URLs found by this query
  relevantUrlsFound: number; // URLs that passed relevancy threshold
  averageRelevancyScore: number; // Average score of results from this query
  lastUsedAt: number; // Last time this query was used
  successRate: number; // Percentage of URLs that were relevant (0-100)
}

/**
 * Record of a processed URL
 */
export interface ProcessedUrl {
  url: string; // Original URL
  normalizedUrl: string; // Normalized for deduplication
  firstSeenAt: number; // First time this URL was encountered
  timesFound: number; // How many times this URL appeared in searches
  lastRelevancyScore?: number; // Most recent relevancy score
  wasIncluded: boolean; // Whether it was included in any report
}

/**
 * Full search history type
 */
export interface SearchHistory {
  projectId: string; // Parent project ID
  userId: string; // Owner user ID
  
  // URL tracking
  processedUrls: ProcessedUrl[]; // All URLs that have been processed
  urlIndex: Record<string, boolean>; // Quick lookup: normalizedUrl -> exists
  
  // Query performance tracking
  queryPerformance: QueryPerformance[]; // Performance data for each query
  queryIndex: Record<string, number>; // Quick lookup: query -> array index
  
  // Statistics
  totalUrlsProcessed: number;
  totalSearchesExecuted: number;
  totalReportsGenerated: number;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Search history data for creation
 */
export interface NewSearchHistory {
  projectId: string;
  userId: string;
  processedUrls: ProcessedUrl[];
  urlIndex: Record<string, boolean>;
  queryPerformance: QueryPerformance[];
  queryIndex: Record<string, number>;
  totalUrlsProcessed: number;
  totalSearchesExecuted: number;
  totalReportsGenerated: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Helper type for checking if URL was already processed
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalUrl?: ProcessedUrl;
  lastScore?: number;
  wasIncluded?: boolean;
}

