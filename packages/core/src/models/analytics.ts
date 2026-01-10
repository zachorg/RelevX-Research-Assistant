export interface AnalyticsDocument {
  // Array of completed research projects per day
  num_completed_daily_research_projects: Array<string>;
  // Number of completed research requests
  num_completed_research: number;
  // Number of completed research requests per month
  num_completed_monthly_research: number;
  // analytics metrics
  [key: string]: any;
}

export interface TopDownAnalyticsDocument
  extends Omit<
    AnalyticsDocument,
    "num_completed_daily_research_projects" | "num_completed_research"
  > {}

export interface UserAnalyticsDocument
  extends Omit<AnalyticsDocument, "num_completed_monthly_research"> {}
