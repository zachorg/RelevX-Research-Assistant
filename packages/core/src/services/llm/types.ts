/**
 * Type definitions for OpenAI service
 */

/**
 * Generated search query with metadata
 */
export interface GeneratedQuery {
  query: string; // The actual search query string
  type: "broad" | "specific" | "question" | "temporal"; // Query strategy type
  reasoning?: string; // Why this query was generated
}

/**
 * Search result for pre-fetch filtering
 */
export interface SearchResultToFilter {
  url: string;
  title: string;
  description: string;
}

/**
 * Filtered search result status
 */
export interface FilteredSearchResult {
  url: string;
  keep: boolean;
  reasoning?: string;
}

/**
 * Content to analyze for relevancy
 */
export interface ContentToAnalyze {
  url: string;
  title?: string;
  snippet: string;
  publishedDate?: string;
  metadata?: Record<string, any>;
}

/**
 * Relevancy analysis result for a single piece of content
 */
export interface RelevancyResult {
  url: string;
  score: number; // 0-100
  reasoning: string;
  keyPoints: string[]; // Main relevant points found
  isRelevant: boolean; // true if score >= threshold
}

/**
 * Result with content for report compilation
 */
export interface ResultForReport {
  url: string;
  title?: string;
  snippet: string;
  score: number;
  keyPoints: string[];
  publishedDate?: string;
  author?: string;
  imageUrl?: string;
  imageAlt?: string;
}

/**
 * Compiled report output
 */
export interface CompiledReport {
  markdown: string;
  title: string;
  summary: string; // Summary
  resultCount: number;
  averageScore: number;
}

export interface ClientReport
  extends Omit<CompiledReport, "summary" | "resultCount" | "averageScore"> {}

/**
 * Source attribution for clustered articles
 */
export interface ArticleSource {
  name: string; // Publication name (extracted from URL or title)
  url: string;
  publishedDate?: string;
}

/**
 * A cluster of semantically similar articles covering the same topic/event
 */
export interface TopicCluster {
  id: string;
  topic: string; // Inferred topic/headline for the cluster
  primaryArticle: ResultForReport; // Highest scoring article (main content source)
  relatedArticles: ResultForReport[]; // Other articles in the cluster
  allSources: ArticleSource[]; // Combined sources for attribution
  combinedKeyPoints: string[]; // Merged key points from all articles
  averageScore: number; // Average relevancy score across cluster
}
