/**
 * Result and delivery log storage
 * Handles saving delivery logs to Firestore
 */

import { db } from "../firebase";
import type { Project } from "../../models/project";
import type { NewDeliveryLog, DeliveryStats } from "../../models/delivery-log";

/**
 * Save delivery log to Firestore
 */
export async function saveDeliveryLog(
  userId: string,
  projectId: string,
  project: Project,
  report: {
    markdown: string;
    title: string;
    summary: string;
    averageScore: number;
    resultCount?: number;
  },
  stats: DeliveryStats,
  resultUrls: string[],
  researchStartedAt: number,
  researchCompletedAt: number,
  status: "pending" | "success" | "failed" | "partial" = "pending"
): Promise<string> {
  const deliveryLogsCollection = db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .doc(projectId)
    .collection("deliveryLogs");

  // Determine destination and address based on project configuration
  let destination: "email" | "slack" | "sms" = "email"; // Default
  let destinationAddress = "pending";

  if (project.resultsDestination !== "none" && project.deliveryConfig) {
    if (
      project.resultsDestination === "email" &&
      project.deliveryConfig.email
    ) {
      destination = "email";
      destinationAddress = project.deliveryConfig.email.address;
    } else if (
      project.resultsDestination === "slack" &&
      project.deliveryConfig.slack
    ) {
      destination = "slack";
      destinationAddress = project.deliveryConfig.slack.webhookUrl;
    } else if (
      project.resultsDestination === "sms" &&
      project.deliveryConfig.sms
    ) {
      destination = "sms";
      destinationAddress = project.deliveryConfig.sms.phoneNumber;
    }
  }

  const deliveryLogData: NewDeliveryLog = {
    projectId,
    userId,
    // Delivery destination and address
    destination,
    destinationAddress,
    reportMarkdown: report.markdown,
    reportTitle: report.title,
    reportSummary: report.summary,
    stats,
    status, // Can be "pending" for pre-runs, "success" for immediate delivery
    retryCount: 0,
    resultUrls,
    researchStartedAt,
    researchCompletedAt,
  };

  const docRef = await deliveryLogsCollection.add(deliveryLogData);
  return docRef.id;
}
