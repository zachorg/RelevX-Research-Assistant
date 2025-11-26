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
 */

export {
  executeResearchForProject,
  executeResearchBatch,
  setDefaultProviders,
} from "./orchestrator";
export { getSearchHistory, updateSearchHistory } from "./search-history";
export { saveSearchResults, saveDeliveryLog } from "./result-storage";
export type { ResearchOptions, ResearchResult } from "./types";
