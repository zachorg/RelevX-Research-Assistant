/**
 * Core package entry point
 *
 * Exports all shared business logic, types, and hooks.
 */

// Models
export type {
  Project,
  ProjectInfo,
  NewProject,
  Frequency,
  ResultsDestination,
  ProjectStatus,
  DateRangePreference,
  SearchParameters,
  ProjectSettings,
  DeliveryConfig,
  ListProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
} from "./models/project";

export type { Plan, PlanInfo, FetchPlansResponse } from "./models/plans";

export type {
  RelevxUserBilling,
  BillingIntentResponse,
  BillingPaymentLinkResponse,
  BillingPortalLinkResponse,
  ActivateFreeTrialRequest,
  ActivateFreeTrialResponse,
} from "./models/billing";

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
  RelevxDeliveryLog,
  ProjectDeliveryLogResponse,
} from "./models/delivery-log";

export type {
  AdminNotification,
  NewAdminNotification,
  NotificationType,
  NotificationSeverity,
  NotificationStatus,
} from "./models/admin-notification";

export type {
  SearchHistory,
  NewSearchHistory,
  ProcessedUrl,
  QueryPerformance,
  DuplicateCheckResult,
} from "./models/search-history";

export type {
  RelevxUser,
  RelevxUserProfile,
  CreateProfileRequest,
  CreateProfileResponse,
} from "./models/users";

export type {
  AnalyticsDocument,
  TopDownAnalyticsDocument,
  UserAnalyticsDocument,
} from "./models/analytics";

// Services
export { auth, db, fireBaseRemoteConfig } from "./services/firebase";
export { signInWithGoogle, signOut } from "./services/auth";
// export {
//   createProject,
//   listProjects,
//   subscribeToProjects,
//   updateProjectStatus,
//   //updateProjectExecution,
//   activateProject,
//   updateProject,
//   deleteProject,
// } from "../../../apps/web/lib/projects";

export {
  extractContent,
  extractContentWithRetry,
  extractMultipleContents,
  getContentPreview,
} from "./services/content-extractor";
export type {
  ExtractedContent,
  ExtractionOptions,
} from "./services/content-extractor";

export {
  executeResearchForProject,
  setDefaultProviders,
} from "./services/research-engine";
export type {
  ResearchResult,
  ResearchOptions,
} from "./services/research-engine";

// Provider Interfaces
export type {
  LLMProvider,
  SearchProvider,
  GeneratedQuery,
  SearchFilters,
  SearchResultItem,
  SearchResponse,
} from "./interfaces";

// Provider Implementations
export { OpenAIProvider, createOpenAIProvider } from "./services/llm";
export {
  BraveSearchProvider,
  createBraveSearchProvider,
} from "./services/search";

// Provider Factories
export {
  createLLMProvider,
  createSearchProvider,
  createProviders,
} from "./providers";
export type {
  LLMProviderType,
  SearchProviderType,
  LLMProviderConfig,
  SearchProviderConfig,
} from "./providers";

// Utils
export { normalizeUrl as utilNormalizeUrl } from "./utils/deduplication";

export {
  calculateDateRange,
  calculateDateRangeByFrequency,
  calculateDateRangeByPreference,
} from "./utils/date-filters";
export type { DateRange } from "./utils/date-filters";

export {
  calculateNextRunAt,
  validateFrequency,
  isProjectDue,
} from "./utils/scheduling";

export { saveSearchResults } from "./services/research-engine/result-storage";

export { sendReportEmail } from "./services/email";

export {
  getUserAnalytics,
  kAnalyticsCollectionTopDown,
  kAnalyticsUserCollection,
  kAnalyticsDailyDateKey,
  kAnalyticsMonthlyDateKey,
} from "./utils/analytics";
