/**
 * SearchResult data model
 *
 * Represents a single search result from the research process.
 * Stored in Firestore under users/{userId}/projects/{projectId}/searchResults/{resultId}
 */

/**
 * Metadata extracted from the search result
 */
export interface SearchResultMetadata {
  title?: string; // Page title
  description?: string; // Meta description
  author?: string; // Article author if available
  publishedDate?: string; // ISO date string
  imageUrl?: string; // Featured image URL
  imageAlt?: string; // Image alt text
  contentType?: string; // "article", "video", "pdf", etc.
  wordCount?: number; // Approximate word count
  [key: string]: any; // Extensible for additional metadata
}

/**
 * Full search result type
 */
export interface SearchResult {
  id: string; // Firestore document ID
  projectId: string; // Parent project ID
  userId: string; // Owner user ID
  
  // Source information
  url: string; // Original URL
  normalizedUrl: string; // Normalized URL for deduplication
  sourceQuery: string; // The search query that found this result
  searchEngine: string; // "brave", "google", etc.
  
  // Content
  snippet: string; // Extracted content snippet (200-500 words)
  fullContent?: string; // Full extracted content (optional, can be large)
  
  // Relevancy
  relevancyScore: number; // 0-100 score from AI analysis
  relevancyReason?: string; // Brief explanation of why it's relevant
  
  // Metadata
  metadata: SearchResultMetadata;
  
  // Timestamps
  fetchedAt: number; // When the content was fetched
  analyzedAt?: number; // When AI analyzed the content
  includedInReport?: boolean; // Whether this was included in final report
  reportId?: string; // ID of the delivery log if included
  
  // Status
  fetchStatus: "success" | "failed" | "timeout" | "blocked";
  fetchError?: string; // Error message if fetch failed
}

/**
 * Search result data for creation
 */
export interface NewSearchResult
  extends Omit<SearchResult, "id" | "analyzedAt" | "includedInReport" | "reportId"> {}

/**
 * Simplified search result for quick queries
 */
export interface SearchResultSummary {
  id: string;
  url: string;
  title?: string;
  relevancyScore: number;
  fetchedAt: number;
  includedInReport?: boolean;
}

