/**
 * Type definitions for research engine
 */

import type { SearchResult } from "../../models/search-result";
import type { LLMProvider } from "../../interfaces/llm-provider";
import type { SearchProvider } from "../../interfaces/search-provider";
import type { ResearchConfig, ModelConfig } from "./config";

/**
 * LLM model overrides for specific steps
 */
export interface ModelOverrides {
  queryGeneration?: Partial<ModelConfig>;
  searchFiltering?: Partial<ModelConfig>;
  relevancyAnalysis?: Partial<ModelConfig>;
  reportCompilation?: Partial<ModelConfig>;
  clusteredReportCompilation?: Partial<ModelConfig>;
  reportSummary?: Partial<ModelConfig>;
}

/**
 * Research execution options
 */
export interface ResearchOptions {
  // === Core Research Settings ===
  maxIterations?: number; // Max retry iterations (default: from config)
  minResults?: number; // Min results to find (default: from project.settings)
  maxResults?: number; // Max results to include (default: from project.settings)
  relevancyThreshold?: number; // Min score (default: from project.settings)
  ignoreFrequencyCheck?: boolean; // Skip frequency validation (default: false)

  // === Provider Injection ===
  llmProvider?: LLMProvider; // Custom LLM provider (default: from config)
  searchProvider?: SearchProvider; // Custom search provider (default: from config)

  // === Query Generation Settings ===
  queriesPerIteration?: number; // Number of queries to generate (default: from config)

  // === Search Settings ===
  resultsPerQuery?: number; // Results per search query (default: from config)
  maxUrlsToExtract?: number; // Max URLs to extract per iteration (default: from config)

  // === LLM Model Overrides ===
  // Override model/temperature for specific steps
  modelOverrides?: ModelOverrides;

  // === Clustering Settings ===
  enableClustering?: boolean; // Enable topic clustering (default: from config)
  clusteringSimilarityThreshold?: number; // Similarity threshold (default: from config)

  // === Report Settings ===
  reportTone?: "professional" | "casual" | "technical"; // Report tone (default: from config)
  reportMaxLength?: number; // Max report length (default: from config)
  includeExecutiveSummary?: boolean; // Include summary (default: from config)

  // === Rate Limiting (advisory) ===
  apiDelayMs?: number; // Delay between API calls (default: from config)
  maxConcurrentLlmRequests?: number; // Max concurrent LLM requests (default: from config)

  // === Full Config Override ===
  // Provide a complete config object to override all defaults
  config?: Partial<ResearchConfig>;
}

/**
 * Research execution result
 */
export interface ResearchResult {
  success: boolean;
  projectId: string;

  // Results
  relevantResults: SearchResult[];
  totalResultsAnalyzed: number;
  iterationsUsed: number;

  // Queries
  queriesGenerated: string[];
  queriesExecuted: string[];

  // URLs
  urlsFetched: number;
  urlsSuccessful: number;
  urlsRelevant: number;

  // Report
  report?: {
    markdown: string;
    title: string;
    summary: string;
    averageScore: number;
    resultCount: number;
  };

  // Delivery
  deliveryLogId?: string; // ID of the created delivery log (if results were saved)

  // Errors
  error?: string;

  // Timing
  startedAt: number;
  completedAt: number;
  durationMs: number;
}
