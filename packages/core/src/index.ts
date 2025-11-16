/**
 * Core package entry point
 *
 * Exports all shared business logic, types, and hooks.
 */

// Models
export type {
  Project,
  NewProject,
  Frequency,
  ResultsDestination,
  ProjectStatus,
  DateRangePreference,
  SearchParameters,
  ProjectSettings,
  DeliveryConfig,
} from "./models/project";

export type {
  SearchResult,
  NewSearchResult,
  SearchResultSummary,
  SearchResultMetadata,
} from "./models/search-result";

export type {
  DeliveryLog,
  NewDeliveryLog,
  DeliveryLogSummary,
  DeliveryStats,
} from "./models/delivery-log";

export type {
  SearchHistory,
  NewSearchHistory,
  ProcessedUrl,
  QueryPerformance,
  DuplicateCheckResult,
} from "./models/search-history";

// Services
export { auth, db } from "./services/firebase";
export { signInWithGoogle, signOut } from "./services/auth";
export {
  createProject,
  listProjects,
  subscribeToProjects,
  updateProjectStatus,
  updateProjectExecution,
  activateProject,
} from "./services/projects";

// Hooks
export { useAuth } from "./hooks/useAuth";
export { useProjects } from "./hooks/useProjects";
