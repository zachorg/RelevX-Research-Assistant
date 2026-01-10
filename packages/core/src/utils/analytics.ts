import { AnalyticsDocument } from "core";

const kAnalyticsCollection = "analytics/research-v1/";
export const kAnalyticsCollectionTopDown = (dateKey: string) =>
  `${kAnalyticsCollection}topdown/${dateKey}`;
export const kAnalyticsUserCollection = (userId: string, dateKey: string) =>
  `users/${userId}/analytics-v1/${dateKey}`;

export const kAnalyticsDailyDateKey = (date: Date): string =>
  date.toISOString().substring(0, 10);

export const getUserAnalytics = async (
  db: any,
  userId: string,
  dateKey?: string
): Promise<AnalyticsDocument | null> => {
  dateKey = dateKey || kAnalyticsDailyDateKey(new Date());
  const docRef = db.doc(kAnalyticsUserCollection(userId, dateKey));
  if (!docRef?.exists) return null;
  const doc = await docRef.get();
  if (!doc.exists) return null;
  return doc.data() as AnalyticsDocument;
};
