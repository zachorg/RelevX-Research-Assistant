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
}

/**
 * Full delivery log type
 */
export interface DeliveryLog {
  id: string; // Firestore document ID
  projectId: string; // Parent project ID
  userId: string; // Owner user ID

  // Delivery information
  destination: "email" | "slack" | "sms"; // Where it was delivered
  destinationAddress: string; // Email/phone/webhook that received it

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
  searchResultIds: string[]; // IDs of SearchResults included in this report

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
    | "id"
    | "projectId"
    | "userId"
    | "destination"
    | "destinationAddress"
    | "stats"
    | "searchResultIds"
  > {}

/**
 * Simplified delivery log for listing
 */
export interface DeliveryLogSummary {
  id: string;
  projectId: string;
  destination: "email" | "slack" | "sms";
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
