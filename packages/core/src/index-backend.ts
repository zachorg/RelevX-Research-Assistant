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
  ToggleProjectStatusResponse,
} from "./models/project";

export type { Plan, PlanInfo, FetchPlansResponse } from "./models/plans";

export type {
  RelevxUserBilling,
  BillingIntentResponse,
  BillingPaymentLinkResponse,
  BillingPortalLinkResponse,
  ActivateFreeTrialRequest,
  ActivateFreeTrialResponse,
} from "./models/billing.js";

export type {
  RelevxUser,
  RelevxUserProfile,
  CreateProfileRequest,
  CreateProfileResponse,
} from "./models/users";

export type {
  RelevxDeliveryLog,
  DeliveryLog,
  ProjectDeliveryLogResponse,
} from "./models/delivery-log";

export type {
  AnalyticsDocument,
  TopDownAnalyticsDocument,
  UserAnalyticsDocument,
} from "./models/analytics";

export {
  getUserAnalytics,
  kAnalyticsCollectionTopDown,
  kAnalyticsUserCollection,
  kAnalyticsDailyDateKey,
} from "./utils/analytics";

export type {
  ImproveProjectDescriptionRequest,
  ImproveProjectDescriptionResponse,
} from "./models/ai";

export { OpenAIProvider, createOpenAIProvider } from "./services/llm";
export type { LLMProvider } from "./interfaces/llm-provider";
