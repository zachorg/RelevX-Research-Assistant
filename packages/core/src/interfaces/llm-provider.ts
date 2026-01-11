/**
 * LLM Provider Interface
 *
 * Abstract interface for large language model providers.
 * Allows switching between OpenAI, Gemini, Anthropic, etc.
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
 * Filtered search result status
 */
export interface FilteredSearchResult {
  url: string;
  keep: boolean;
  reasoning?: string;
}

/**
 * Search result item validation
 */
export interface SearchResultToFilter {
  url: string;
  title: string;
  description: string;
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

/**
 * Source attribution for clustered articles
 */
export interface ArticleSource {
  name: string;
  url: string;
  publishedDate?: string;
}

/**
 * A cluster of semantically similar articles
 */
export interface TopicCluster {
  id: string;
  topic: string;
  primaryArticle: ResultForReport;
  relatedArticles: ResultForReport[];
  allSources: ArticleSource[];
  combinedKeyPoints: string[];
  averageScore: number;
}

/**
 * LLM Provider interface
 * All LLM providers must implement these methods
 */
export interface LLMProvider {
  /**
   * Generate search queries from project description
   */
  generateSearchQueries(
    projectDescription: string,
    additionalContext?: string,
    options?: {
      count?: number;
      focusRecent?: boolean;
    }
  ): Promise<GeneratedQuery[]>;

  /**
   * Filter search results based on title/snippet before fetching content
   */
  filterSearchResults?(
    results: SearchResultToFilter[],
    projectDescription: string
  ): Promise<FilteredSearchResult[]>;

  /**
   * Analyze relevancy of content against project description
   */
  analyzeRelevancy(
    projectDescription: string,
    contents: ContentToAnalyze[],
    options?: {
      threshold?: number;
      batchSize?: number;
    }
  ): Promise<RelevancyResult[]>;

  /**
   * Compile a report from relevant results
   */
  compileReport(
    projectDescription: string,
    results: ResultForReport[],
    options?: {
      tone?: "professional" | "casual" | "technical";
      maxLength?: number;
      projectTitle?: string;
      frequency?: "daily" | "weekly" | "monthly";
    }
  ): Promise<CompiledReport>;

  /**
   * Cluster articles by semantic similarity (optional)
   * Groups similar articles together for consolidated reporting
   */
  clusterByTopic?(
    results: ResultForReport[],
    options?: {
      similarityThreshold?: number;
    }
  ): Promise<TopicCluster[]>;

  /**
   * Compile a report from clustered results (optional)
   * Uses topic clusters for consolidated multi-source sections
   */
  compileClusteredReport?(
    projectDescription: string,
    clusters: TopicCluster[],
    options?: {
      tone?: "professional" | "casual" | "technical";
      maxLength?: number;
      projectTitle?: string;
      frequency?: "daily" | "weekly" | "monthly";
    }
  ): Promise<CompiledReport>;
}
