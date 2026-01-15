/**
 * LLM Provider Interface
 *
 * Abstract interface for large language model providers.
 * Allows switching between OpenAI, Gemini, Anthropic, etc.
 */

import {
  GeneratedQuery,
  ContentToAnalyze,
  RelevancyResult,
  ResultForReport,
  CompiledReport,
  LlmMessage,
  SearchResultToFilter,
  FilteredSearchResult,
  TopicCluster,
} from "./../services/llm/types";

/**
 * LLM Provider interface
 * All LLM providers must implement these methods
 */
export interface LLMProvider {
  /**
   * Get the provider name (e.g., "openai", "gemini")
   */
  getName(): string;

  /**
   * Get the model name being used (e.g., "gpt-4o-mini", "gemini-1.5-flash-8b")
   */
  getModel(): string;

  /**
   * Query the LLM with a prompt
   */
  query(messages: Array<LlmMessage>, temperature?: number): Promise<JSON>;

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
