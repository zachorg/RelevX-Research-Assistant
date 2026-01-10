import { AnalyticsDocument } from "core/models/analytics";

const kAnalyticsCollection = "analytics/research/v1/";
export const kAnalyticsCollectionTopDown = (dateKey: string) =>
  `${kAnalyticsCollection}topdown/${dateKey}`;
export const kAnalyticsUserCollection = (userId: string, dateKey: string) =>
  `users/${userId}/analytics/v1/${dateKey}`;

export const getUserAnalytics = async (
  db: any,
  userId: string,
  dateKey?: string
): Promise<AnalyticsDocument | null> => {
  dateKey = dateKey || new Date().toISOString().substring(0, 10);
  const docRef = db.doc(kAnalyticsUserCollection(userId, dateKey));
  const doc = await docRef.get();
  if (doc.exists) {
    return doc.data() as AnalyticsDocument;
  }
  return null;
};
