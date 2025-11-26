/**
 * AdminNotification data model
 *
 * Tracks system errors and failures that require admin attention.
 * Stored in Firestore at root level: adminNotifications/{notificationId}
 */

export type NotificationType =
  | "research_failure"
  | "delivery_failure"
  | "system_error";

export type NotificationSeverity = "low" | "medium" | "high" | "critical";

export type NotificationStatus = "pending" | "sent" | "failed";

/**
 * Full admin notification type
 */
export interface AdminNotification {
  id: string; // Firestore document ID
  type: NotificationType;
  severity: NotificationSeverity;

  // Project context
  projectId: string;
  userId: string;
  projectTitle: string;

  // Error details
  errorMessage: string;
  errorStack?: string;
  retryCount: number;

  // Timestamps
  occurredAt: number;
  notifiedAt?: number;

  // Notification status
  status: NotificationStatus;
}

/**
 * Admin notification data for creation
 */
export interface NewAdminNotification extends Omit<AdminNotification, "id"> {}
