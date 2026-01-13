/**
 * Research Engine service
 *
 * Core orchestrator that coordinates the full research flow:
 * 1. Generate search queries (via LLM provider)
 * 2. Execute searches (via Search provider)
 * 3. Extract content from URLs
 * 4. Analyze relevancy (via LLM provider)
 * 5. Compile report (via LLM provider)
 * 6. Save results and update project
 *
 * Now supports pluggable providers for LLM and Search services.
 * Configuration is loaded from research-config.yaml.
 */

export { executeResearchForProject, setDefaultProviders } from "./orchestrator";
export { getSearchHistory, updateSearchHistory } from "./search-history";
export { saveSearchResults, saveDeliveryLog } from "./result-storage";
export type { ResearchOptions, ResearchResult, ModelOverrides } from "./types";

// Config exports
export {
  loadConfig,
  getConfig,
  clearConfigCache,
  getConfigPath,
  withConfigOverrides,
  getModelConfig,
  getDefaultLLMProvider,
  getDefaultSearchProvider,
  getEmbeddingsConfig,
  getExtractionConfig,
  getResearchConfig,
  getClusteringConfig,
  getReportConfig,
  getLimitsConfig,
  getSearchConfig,
  DEFAULT_CONFIG,
} from "./config";

export type {
  ResearchConfig,
  ModelConfig,
  LLMConfig,
  SearchConfig,
  ExtractionConfig,
  ResearchPipelineConfig,
  ClusteringConfig,
  ReportConfig,
  LimitsConfig,
} from "./config";
