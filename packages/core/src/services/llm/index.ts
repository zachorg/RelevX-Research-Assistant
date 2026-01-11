/**
 * LLM Provider implementations
 */

export { OpenAIProvider, createOpenAIProvider } from "./openai-provider";
export type { LLMProvider } from "../../interfaces/llm-provider";

export { initializeOpenAI, getClient } from "./client";

export {
  generateSearchQueries,
  generateSearchQueriesWithRetry,
} from "./query-generation";

export {
  analyzeRelevancy,
  analyzeRelevancyWithRetry,
} from "./relevancy-analysis";

export {
  filterSearchResults,
  filterSearchResultsSafe,
} from "./search-filtering";

export {
  compileReport,
  compileReportWithRetry,
  compileClusteredReport,
  compileClusteredReportWithRetry,
  generateReportSummary,
  generateReportSummaryWithRetry,
  type CompileReportOptions,
  type CompileClusteredReportOptions,
  type GenerateSummaryOptions,
} from "./report-compilation";

export {
  clusterArticlesByTopic,
  shouldCluster,
  type ClusteringOptions,
} from "./topic-clustering";

export {
  generateEmbeddings,
  generateEmbedding,
  cosineSimilarity,
  calculateSimilarityMatrix,
  findSimilarPairs,
} from "./embeddings";

export {
  QUERY_GENERATION_PROMPTS,
  RELEVANCY_ANALYSIS_PROMPTS,
  REPORT_COMPILATION_PROMPTS,
  CLUSTERED_REPORT_COMPILATION_PROMPTS,
  renderPrompt,
  getPromptConfig,
  type PromptConfig,
  type PromptType,
} from "./prompts";

export type {
  GeneratedQuery,
  ContentToAnalyze,
  RelevancyResult,
  ResultForReport,
  CompiledReport,
  TopicCluster,
  ArticleSource,
} from "./types";
