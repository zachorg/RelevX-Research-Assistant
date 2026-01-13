import { UserAnalyticsDocument } from "core";

const kAnalyticsCollection = "analytics/research-v1/";
export const kAnalyticsCollectionTopDown = (dateKey: string) =>
  `${kAnalyticsCollection}topdown/${dateKey}`;
export const kAnalyticsUserCollection = (userId: string, dateKey: string) =>
  `users/${userId}/analytics-v1/${dateKey}`;

export const kAnalyticsDailyDateKey = (date: Date): string =>
  date.toISOString().substring(0, 10);
export const kAnalyticsMonthlyDateKey = (date: Date): string =>
  date.toISOString().substring(0, 7);

export const getUserAnalytics = async (
  db: any,
  userId: string,
  date: Date = new Date()
): Promise<UserAnalyticsDocument> => {
  const doc = await db
    .doc(kAnalyticsUserCollection(userId, kAnalyticsDailyDateKey(date)))
    .get();
  if (!doc.exists)
    return {
      num_completed_daily_research_projects: [],
    } as UserAnalyticsDocument;
  return doc.data() as UserAnalyticsDocument;
};
