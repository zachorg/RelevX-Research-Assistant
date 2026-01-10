import { Firestore } from "firebase-admin/firestore";
import {
  AnalyticsDocument,
  Plan,
  TopDownAnalyticsDocument,
  UserAnalyticsDocument,
  kAnalyticsCollectionTopDown,
  kAnalyticsDailyDateKey,
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

  const dateKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM format
  const usageRef = db.doc(kAnalyticsCollectionTopDown(dateKey));

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
    transaction.set(
      usageRef,
      {
        ...data,
        [key]: num_completed_monthly_research + numResearch,
      },
      { merge: true }
    );
  });
}

export async function check_and_increment_research_usage(
  onRun: () => Promise<any>,
  db: Firestore,
  userId: string,
  plan: Plan,
  projectId: string
): Promise<any> {
  if (!db) {
    throw new Error("Firebase firestore not initialized");
  }

  const dateKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM-DD format
  const usageRef = db.doc(kAnalyticsUserCollection(userId, dateKey));

  const result: any = await db.runTransaction(async (transaction) => {
    const usageDoc = await transaction.get(usageRef);

    let data: UserAnalyticsDocument = {
      num_completed_daily_research_projects: {},
      num_completed_research: 0,
    };
    if (usageDoc.exists) {
      data = usageDoc.data() as UserAnalyticsDocument;
    }

    const key = "num_completed_research";
    const completed_requests = data[key];

    const key_daily = "num_completed_daily_research_projects";
    const completed_daily_projects: Array<string> = data[key_daily];

    const currentCount = completed_daily_projects?.length || 0;

    // assume always one project update
    if (
      currentCount + 1 > plan.settingsMaxDailyRuns ||
      completed_daily_projects?.includes(projectId)
    ) {
      return false;
    }

    const value = await onRun();
    if (value) {
      completed_daily_projects.push(projectId);
      transaction.set(
        usageRef,
        {
          ...data,
          [key]: completed_requests + 1,
          [key_daily]: {
            ...completed_daily_projects,
          },
        } as AnalyticsDocument,
        { merge: true }
      );

      // no need to wait for this to complete
      update_topdown_analytics_completed_research(db, 1);
    }

    return value;
  });

  return result;
}
