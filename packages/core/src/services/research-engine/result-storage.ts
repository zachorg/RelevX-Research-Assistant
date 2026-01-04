/**
 * Result and delivery log storage
 * Handles saving search results and delivery logs to Firestore
 */

import { db } from "../firebase";
import type { Project } from "../../models/project";
import type { SearchResult, NewSearchResult } from "../../models/search-result";
import type { NewDeliveryLog, DeliveryStats } from "../../models/delivery-log";

/**
 * Save search results to Firestore
 */
export async function saveSearchResults(
  userId: string,
  projectId: string,
  results: SearchResult[]
): Promise<string[]> {
  const resultsCollection = db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .doc(projectId)
    .collection("searchResults");

  const resultIds: string[] = [];

  for (const result of results) {
    const resultData: NewSearchResult = {
      projectId: result.projectId,
      userId: result.userId,
      url: result.url,
      normalizedUrl: result.normalizedUrl,
      sourceQuery: result.sourceQuery,
      searchEngine: result.searchEngine,
      snippet: result.snippet,
      fullContent: result.fullContent,
      relevancyScore: result.relevancyScore,
      relevancyReason: result.relevancyReason,
      metadata: result.metadata,
      fetchedAt: result.fetchedAt,
      fetchStatus: result.fetchStatus,
      fetchError: result.fetchError,
    };

    const docRef = await resultsCollection.add(resultData);
    resultIds.push(docRef.id);
  }

  return resultIds;
}

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
  searchResultIds: string[],
  researchStartedAt: number,
  researchCompletedAt: number,
  status: "pending" | "success" | "failed" | "partial" = "success"
): Promise<string> {
  const deliveryLogsCollection = db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .doc(projectId)
    .collection("deliveryLogs");

  // Determine destination and address based on project configuration
  let destination: "email" | "slack" | "sms" = "email"; // Default
  let deliveryStatus = "pending";

  if (project.resultsDestination !== "none" && project.deliveryConfig) {
    if (
      project.resultsDestination === "email" &&
      project.deliveryConfig.email
    ) {
      destination = "email";
      deliveryStatus = project.deliveryConfig.email.address;
    } else if (
      project.resultsDestination === "slack" &&
      project.deliveryConfig.slack
    ) {
      destination = "slack";
      deliveryStatus = project.deliveryConfig.slack.webhookUrl;
    } else if (
      project.resultsDestination === "sms" &&
      project.deliveryConfig.sms
    ) {
      destination = "sms";
      deliveryStatus = project.deliveryConfig.sms.phoneNumber;
    }
  }

  const deliveryLogData: NewDeliveryLog = {
    projectId,
    userId,
    // Delivery destination and address
    destination,
    deliveryStatus,
    reportMarkdown: report.markdown,
    reportTitle: report.title,
    stats,
    status, // Can be "pending" for pre-runs, "success" for immediate delivery
    retryCount: 0,
    searchResultIds,
    researchStartedAt,
    researchCompletedAt,
  };

  const docRef = await deliveryLogsCollection.add(deliveryLogData);
  return docRef.id;
}
