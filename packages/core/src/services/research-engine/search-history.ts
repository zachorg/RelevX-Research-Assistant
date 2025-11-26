/**
 * Search history management
 * Handles CRUD operations for tracking processed URLs and query performance
 */

import { db } from "../firebase";
import type {
  SearchHistory,
  NewSearchHistory,
  ProcessedUrl,
  QueryPerformance,
} from "../../models/search-history";

/**
 * Get or create search history for a project
 */
export async function getSearchHistory(
  userId: string,
  projectId: string
): Promise<SearchHistory> {
  const historyRef = db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .doc(projectId)
    .collection("metadata")
    .doc("searchHistory");

  const historyDoc = await historyRef.get();

  if (historyDoc.exists) {
    return historyDoc.data() as SearchHistory;
  }

  // Create new history
  const newHistory: NewSearchHistory = {
    projectId,
    userId,
    processedUrls: [],
    urlIndex: {},
    queryPerformance: [],
    queryIndex: {},
    totalUrlsProcessed: 0,
    totalSearchesExecuted: 0,
    totalReportsGenerated: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await historyRef.set(newHistory);
  return newHistory as SearchHistory;
}

/**
 * Update search history with new data
 */
export async function updateSearchHistory(
  userId: string,
  projectId: string,
  newUrls: ProcessedUrl[],
  queryPerformance: Map<string, { relevant: number; total: number }>
): Promise<void> {
  const historyRef = db
    .collection("users")
    .doc(userId)
    .collection("projects")
    .doc(projectId)
    .collection("metadata")
    .doc("searchHistory");

  const history = await getSearchHistory(userId, projectId);

  // Update processed URLs
  const updatedUrls = [...history.processedUrls];
  const updatedUrlIndex = { ...history.urlIndex };

  for (const newUrl of newUrls) {
    const existing = updatedUrls.find(
      (u) => u.normalizedUrl === newUrl.normalizedUrl
    );

    if (existing) {
      existing.timesFound++;
      existing.lastRelevancyScore = newUrl.lastRelevancyScore;
      existing.wasIncluded = existing.wasIncluded || newUrl.wasIncluded;
    } else {
      updatedUrls.push(newUrl);
      updatedUrlIndex[newUrl.normalizedUrl] = true;
    }
  }

  // Update query performance
  const updatedQueryPerformance = [...history.queryPerformance];
  const updatedQueryIndex = { ...history.queryIndex };

  for (const [query, stats] of queryPerformance.entries()) {
    const existingIdx = updatedQueryIndex[query];

    if (existingIdx !== undefined) {
      const existing = updatedQueryPerformance[existingIdx];
      existing.timesUsed++;
      existing.urlsFound += stats.total;
      existing.relevantUrlsFound += stats.relevant;
      existing.lastUsedAt = Date.now();

      const totalRelevant = existing.relevantUrlsFound;
      const totalFound = existing.urlsFound;
      existing.successRate =
        totalFound > 0 ? (totalRelevant / totalFound) * 100 : 0;
      existing.averageRelevancyScore =
        totalRelevant > 0 ? existing.averageRelevancyScore : 0;
    } else {
      const newPerf: QueryPerformance = {
        query,
        timesUsed: 1,
        urlsFound: stats.total,
        relevantUrlsFound: stats.relevant,
        averageRelevancyScore: 0,
        lastUsedAt: Date.now(),
        successRate: stats.total > 0 ? (stats.relevant / stats.total) * 100 : 0,
      };
      updatedQueryPerformance.push(newPerf);
      updatedQueryIndex[query] = updatedQueryPerformance.length - 1;
    }
  }

  await historyRef.update({
    processedUrls: updatedUrls,
    urlIndex: updatedUrlIndex,
    queryPerformance: updatedQueryPerformance,
    queryIndex: updatedQueryIndex,
    totalUrlsProcessed: updatedUrls.length,
    totalSearchesExecuted:
      history.totalSearchesExecuted + queryPerformance.size,
    updatedAt: Date.now(),
  });
}
