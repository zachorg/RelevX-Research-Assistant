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

  // Statistics
  stats: DeliveryStats;

  // Status
  status: "pending" | "success" | "failed" | "partial"; // Delivery status
  error?: string; // Error message if delivery failed
  retryCount: number; // Number of delivery retry attempts
  preparedAt?: number; // When research completed (for pending status)

  // References
  searchResultIds: string[]; // IDs of SearchResults included in this report

  // Timestamps
  deliveredAt?: number; // When delivery was attempted/completed (undefined for pending status)
  researchStartedAt: number; // When the research process started
  researchCompletedAt: number; // When the research process completed
}

/**
 * Delivery log data for creation
 */
export interface NewDeliveryLog extends Omit<DeliveryLog, "id"> {}

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
