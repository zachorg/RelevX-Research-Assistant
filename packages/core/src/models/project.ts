/**
 * Project data model
 *
 * Represents a research project that the user wants to track.
 */

export type Frequency = "daily" | "weekly" | "monthly";

export type ResultsDestination = "email";

export type ProjectStatus = "active" | "paused" | "error" | "running";

export type DateRangePreference =
  | "last_24h"
  | "last_week"
  | "last_month"
  | "last_3months"
  | "last_year"
  | "custom";

/**
 * Search parameters for customizing research queries
 */
export interface SearchParameters {
  priorityDomains?: string[]; // Domains to prioritize in results
  excludedDomains?: string[]; // Domains to exclude from results
  dateRangePreference?: DateRangePreference; // Preferred date range for results
  language?: string; // ISO language code (e.g., "en", "es")
  region?: string; // ISO region code (e.g., "US", "GB")
  requiredKeywords?: string[]; // Keywords that must appear in results
  excludedKeywords?: string[]; // Keywords to exclude from results
  customParameters?: Record<string, any>; // Extensible for future parameters
}

/**
 * Project settings for research execution
 */
export interface ProjectSettings {
  relevancyThreshold: number; // 0-100, minimum score to include result
  minResults: number; // Minimum results required before stopping retries
  maxResults: number; // Maximum results to include in report
}

/**
 * Delivery configuration for email
 */
export interface DeliveryConfig {
  email?: {
    address: string;
    subject?: string; // Optional custom subject line
  };
}

/**
 * Full project type as stored in Firestore
 */
export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  frequency: Frequency;
  resultsDestination: ResultsDestination;

  // Scheduling configuration
  deliveryTime: string; // HH:MM format (24-hour), any minute value, e.g., "09:15", "14:37", "23:42"
  timezone: string; // IANA timezone identifier, e.g., "America/New_York", "Europe/London"
  dayOfWeek?: number; // 0-6 (Sunday-Saturday), used when frequency is "weekly"
  dayOfMonth?: number; // 1-31, used when frequency is "monthly"

  // Search configuration
  searchParameters?: SearchParameters;

  // Project settings
  settings: ProjectSettings;

  // Delivery configuration
  deliveryConfig?: DeliveryConfig;

  // Execution tracking
  status: ProjectStatus;
  lastRunAt?: number; // Timestamp of last research execution
  nextRunAt?: number; // Timestamp of next scheduled execution
  lastError?: string; // Error message from last failed execution
  preparedDeliveryLogId?: string; // ID of pre-run delivery log ready to send
  researchStartedAt?: number; // Timestamp when current research started (for "running" status)

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInfo extends Omit<Project, "id" | "userId"> {}

/**
 * Project data needed to create a new project
 * (omits auto-generated fields)
 */
export interface NewProject
  extends Omit<
    ProjectInfo,
    | "createdAt"
    | "updatedAt"
    | "status"
    | "lastRunAt"
    | "nextRunAt"
    | "lastError"
  > {}

export interface ListProjectsResponse {
  projects: ProjectInfo[];
}

export interface CreateProjectRequest {
  projectInfo: NewProject;
}

export interface CreateProjectResponse {
  project: ProjectInfo;
}

export interface ToggleProjectStatusResponse {
  errorCode?: string;
  errorMessage?: string;
  status: ProjectStatus;
}
