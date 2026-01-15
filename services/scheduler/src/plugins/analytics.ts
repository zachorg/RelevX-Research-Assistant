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
      { merge: false } // we don't want to merge, we want to overwrite the entire document
    );
  });
}

async function try_increment_research_usage(
  db: Firestore,
  userId: string,
  plan: Plan,
  projectTitle: string
): Promise<any> {
  const dateKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM-DD format
  const usageRef = db.doc(kAnalyticsUserCollection(userId, dateKey));

  // assume onRun is a success
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

    completed_daily_projects.push(projectTitle);
    transaction.set(
      usageRef,
      {
        ...data,
        num_completed_daily_research_projects: completed_daily_projects,
      } as UserAnalyticsDocument,
      { merge: false } // we don't want to merge, we want to overwrite the entire document
    );

    // no need to wait for this to complete
    update_topdown_analytics_completed_research(db, 1);
    return true;
  });

  return result;
}

async function decrement_research_usage(
  db: Firestore,
  userId: string,
  projectTitle: string
): Promise<any> {
  const dateKey = kAnalyticsDailyDateKey(new Date()); // YYYY-MM-DD format
  const usageRef = db.doc(kAnalyticsUserCollection(userId, dateKey));

  // assume onRun is a success
  const result: any = await db.runTransaction(async (transaction) => {
    const usageDoc = await transaction.get(usageRef);

    let data: UserAnalyticsDocument = {
      num_completed_daily_research_projects: [],
      num_completed_research: 0,
    };
    if (usageDoc.exists) {
      data = usageDoc.data() as UserAnalyticsDocument;
    }

    let completed_daily_projects: string[] =
      data.num_completed_daily_research_projects || [];

    completed_daily_projects = completed_daily_projects.filter(
      (id) => id !== projectTitle
    );
    transaction.set(
      usageRef,
      {
        ...data,
        num_completed_daily_research_projects: completed_daily_projects,
      } as UserAnalyticsDocument,
      { merge: false } // we don't want to merge, we want to overwrite the entire document
    );

    // no need to wait for this to complete
    update_topdown_analytics_completed_research(db, -1);
    return true;
  });

  return result;
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

  // first increment the research usage -- if this fails, we don't need to execute the onRun function
  let result = await try_increment_research_usage(
    db,
    userId,
    plan,
    projectTitle
  );

  // execute the onRun function
  if (result) {
    const value = await onRun();
    if (!value) {
      // no need to wait for this to complete
      // decrement the research usage
      // -- this project will get executed again ASAP..
      decrement_research_usage(db, userId, projectTitle);
    }
    return value;
  }

  return null;
}
