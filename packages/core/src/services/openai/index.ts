/**
 * OpenAI service
 *
 * Handles all OpenAI API interactions for the research assistant:
 * - Query generation from project descriptions
 * - Relevancy analysis of search results
 * - Report compilation in markdown format
 */

export { initializeOpenAI, getClient } from "./client";

export {
  generateSearchQueries,
  generateSearchQueriesWithRetry,
} from "./query-generation";

export {
  analyzeRelevancy,
  analyzeRelevancyWithRetry,
} from "./relevancy-analysis";

export { compileReport, compileReportWithRetry } from "./report-compilation";

export {
  QUERY_GENERATION_PROMPTS,
  RELEVANCY_ANALYSIS_PROMPTS,
  REPORT_COMPILATION_PROMPTS,
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
} from "./types";
