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
  RelevxDeliveryLog,
  ProjectDeliveryLogResponse,
  PaginationInfo,
  DeliveryLogSummary,
  DeliveryStats,
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

// Hooks
// export { useAuth } from "./hooks/useAuth";
