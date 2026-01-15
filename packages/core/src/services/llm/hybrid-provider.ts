/**
 * Hybrid LLM Provider
 * Delegates different research tasks to different providers to optimize cost/performance.
 */

import type {
  GeneratedQuery,
  ContentToAnalyze,
  RelevancyResult,
  ResultForReport,
  CompiledReport,
  FilteredSearchResult,
  LlmMessage,
  SearchResultToFilter,
  TopicCluster,
} from "core/services/llm/types";
import { LLMProvider } from "core/interfaces";

export interface HybridProviderConfig {
  queryProvider: LLMProvider;
  analysisProvider: LLMProvider;
  reportProvider: LLMProvider;
}

export class HybridProvider implements LLMProvider {
  private queryProvider: LLMProvider;
  private analysisProvider: LLMProvider;
  private reportProvider: LLMProvider;

  constructor(config: HybridProviderConfig) {
    this.queryProvider = config.queryProvider;
    this.analysisProvider = config.analysisProvider;
    this.reportProvider = config.reportProvider;
  }
  query(messages: Array<LlmMessage>, temperature?: number): Promise<JSON> {
    throw new Error("Method not implemented.");
  }
  filterSearchResults?(results: SearchResultToFilter[], projectDescription: string): Promise<FilteredSearchResult[]> {
    throw new Error("Method not implemented.");
  }
  clusterByTopic?(results: ResultForReport[], options?: { similarityThreshold?: number; }): Promise<TopicCluster[]> {
    throw new Error("Method not implemented.");
  }
  compileClusteredReport?(projectDescription: string, clusters: TopicCluster[], options?: { tone?: "professional" | "casual" | "technical"; maxLength?: number; projectTitle?: string; frequency?: "daily" | "weekly" | "monthly"; }): Promise<CompiledReport> {
    throw new Error("Method not implemented.");
  }

  /**
   * Get the provider name (reports the primary/report provider)
   */
  getName(): string {
    return `hybrid(${this.reportProvider.getName()})`;
  }

  /**
   * Get the model name (reports the primary/report provider model)
   */
  getModel(): string {
    return this.reportProvider.getModel();
  }

  async generateSearchQueries(
    description: string,
    additionalContext?: string,
    options?: { count?: number; focusRecent?: boolean }
  ): Promise<GeneratedQuery[]> {
    return this.queryProvider.generateSearchQueries(
      description,
      additionalContext,
      options
    );
  }

  async analyzeRelevancy(
    description: string,
    contents: ContentToAnalyze[],
    options?: { threshold?: number; batchSize?: number }
  ): Promise<RelevancyResult[]> {
    return this.analysisProvider.analyzeRelevancy(
      description,
      contents,
      options
    );
  }

  async compileReport(
    description: string,
    results: ResultForReport[],
    options?: {
      tone?: "professional" | "casual" | "technical";
      maxLength?: number;
    }
  ): Promise<CompiledReport> {
    return this.reportProvider.compileReport(description, results, options);
  }
}
