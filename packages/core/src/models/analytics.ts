export interface AnalyticsDocument {
  // Array of completed research projects per day
  num_completed_daily_research_projects: string[];
  // Number of completed research requests per month
  num_completed_monthly_research: number;
  // Number of completed research requests per day
  num_completed_daily_research: Record<string, number>;
  // analytics metrics
  [key: string]: any;
}

export interface TopDownAnalyticsDocument
  extends Omit<AnalyticsDocument, "num_completed_daily_research_projects"> {}

export interface UserAnalyticsDocument
  extends Omit<
    AnalyticsDocument,
    "num_completed_monthly_research" | "num_completed_daily_research"
  > {}
