import { Firestore } from "firebase-admin/firestore";
import {
  AnalyticsDocument,
  Plan,
  TopDownAnalyticsDocument,
  UserAnalyticsDocument,
  kAnalyticsCollectionTopDown,
  kAnalyticsDailyDateKey,
  kAnalyticsMonthlyDateKey,
  kAnalyticsUserCollection,
} from "core";

export const kCompletedResearchByUser = (userId: string) => `${userId}`;

async function update_topdown_analytics_completed_research(
  db: Firestore,
  numResearch: number = 1
) {
  if (!db) {
    throw new Error("Firebase firestore not initialized");
  }

  const monthKey = kAnalyticsMonthlyDateKey(new Date()); // YYYY-MM format
  const dailyKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM-DD format
  const usageRef = db.doc(kAnalyticsCollectionTopDown(monthKey));

  await db.runTransaction(async (transaction) => {
    const usageDoc = await transaction.get(usageRef);

    // Omit the monthly requests from the analytics document
    let data: TopDownAnalyticsDocument = {
      num_completed_monthly_research: 0,
    };
    if (usageDoc.exists) {
      data = usageDoc.data() as TopDownAnalyticsDocument;
    }

    const key = "num_completed_monthly_research";
    const num_completed_monthly_research = data[key];

    const keyDaily = "num_completed_daily_research";
    const num_completed_daily_research: Record<string, number> =
      data[keyDaily] || {};

    transaction.set(
      usageRef,
      {
        ...data,
        [key]: num_completed_monthly_research + numResearch,
        [keyDaily]: {
          ...num_completed_daily_research,
          [dailyKey]:
            (num_completed_daily_research[dailyKey] || 0) + numResearch,
        },
      } as TopDownAnalyticsDocument,
      { merge: true }
    );
  });
}

export async function check_and_increment_research_usage(
  onRun: () => Promise<any>,
  db: Firestore,
  userId: string,
  plan: Plan,
  projectTitle: string
): Promise<any> {
  if (!db) {
    throw new Error("Firebase firestore not initialized");
  }

  const dateKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM-DD format
  const usageRef = db.doc(kAnalyticsUserCollection(userId, dateKey));

  const result: any = await db.runTransaction(async (transaction) => {
    const usageDoc = await transaction.get(usageRef);

    let data: UserAnalyticsDocument = {
      num_completed_daily_research_projects: [],
      num_completed_research: 0,
    };
    if (usageDoc.exists) {
      data = usageDoc.data() as UserAnalyticsDocument;
    }

    const completed_daily_projects: string[] =
      data.num_completed_daily_research_projects || [];

    const currentCount = completed_daily_projects.length;

    // assume always one project update
    if (
      currentCount + 1 > plan.settingsMaxDailyRuns ||
      completed_daily_projects.find((id) => id === projectTitle) !== undefined
    ) {
      return null;
    }

    const value = await onRun();
    if (value) {
      completed_daily_projects.push(projectTitle);
      transaction.set(
        usageRef,
        {
          ...data,
          num_completed_daily_research_projects: completed_daily_projects,
        } as UserAnalyticsDocument,
        { merge: true }
      );

      // no need to wait for this to complete
      update_topdown_analytics_completed_research(db, 1);
    }

    return value;
  });

  return result;
}
