/**
 * DeliveryLog data model
 *
 * Tracks each delivery of research results to the user.
 * Stored in Firestore under users/{userId}/projects/{projectId}/deliveryLogs/{logId}
 */

/**
 * Delivery statistics for the report
 */
export interface DeliveryStats {
  totalResults: number; // Total results analyzed
  includedResults: number; // Results included in report
  averageRelevancyScore: number; // Average score of included results
  searchQueriesUsed: number; // Number of search queries executed
  iterationsRequired: number; // Number of retry iterations (1-3)
  urlsFetched: number; // Total URLs fetched
  urlsSuccessful: number; // URLs successfully scraped

  // Performance metrics
  researchDurationMs: number; // Total research execution time

  // Token usage / cost estimates
  estimatedTotalTokens: number; // Estimated total tokens used (input + output)
  estimatedCostUsd: number; // Estimated API cost in USD

  // Search context
  freshnessUsed: string; // Final freshness value used (pd, pw, pm, py)
  freshnessExpanded: boolean; // Whether search timeframe was expanded

  // Provider info
  llmProvider: string; // LLM provider used (e.g., "openai", "gemini")
  llmModel: string; // Specific model used (e.g., "gpt-4o-mini")
}

/**
 * Full delivery log type
 */
export interface DeliveryLog {
  id: string; // Firestore document ID
  projectId: string; // Parent project ID
  userId: string; // Owner user ID

  // Delivery information
  destination: "email"; // Where it was delivered

  // Report content
  reportMarkdown: string; // The compiled markdown report
  reportTitle: string; // Title of the report
  reportSummary?: string; // Summary of the report

  // Statistics
  stats: DeliveryStats;

  // Status
  status: "pending" | "success" | "failed" | "partial"; // Delivery status
  error?: string; // Error message if delivery failed
  retryCount: number; // Number of delivery retry attempts

  // References
  resultUrls: string[]; // URLs of results included in this report

  // Timestamps
  researchStartedAt: number; // When the research process started
  researchCompletedAt: number; // When the research process completed
}

/**
 * Delivery log data for creation
 */
export interface NewDeliveryLog extends Omit<DeliveryLog, "id"> {}

export interface RelevxDeliveryLog
  extends Omit<
    DeliveryLog,
    "id" | "projectId" | "userId" | "destination" | "stats" | "resultUrls"
  > {}

/**
 * Simplified delivery log for listing
 */
export interface DeliveryLogSummary {
  id: string;
  projectId: string;
  destination: "email";
  status: "success" | "failed" | "partial";
  deliveredAt: number;
  includedResults: number;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ProjectDeliveryLogResponse {
  logs: RelevxDeliveryLog[];
  pagination?: PaginationInfo;
}
