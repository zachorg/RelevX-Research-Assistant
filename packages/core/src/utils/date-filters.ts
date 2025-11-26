/**
 * Date filtering utilities
 *
 * Functions for calculating date ranges, formatting dates for queries,
 * and working with project schedules.
 */

import type { Frequency, DateRangePreference } from "../models/project";

/**
 * Date range type
 */
export interface DateRange {
  from: Date;
  to: Date;
  fromISO: string; // ISO date string (YYYY-MM-DD)
  toISO: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Calculate date range from a duration
 */
export function calculateDateRange(
  durationDays: number,
  endDate?: Date
): DateRange {
  const to = endDate || new Date();
  const from = new Date(to.getTime() - durationDays * 24 * 60 * 60 * 1000);

  return {
    from,
    to,
    fromISO: from.toISOString().split("T")[0],
    toISO: to.toISOString().split("T")[0],
  };
}

/**
 * Calculate date range based on project frequency
 */
export function calculateDateRangeByFrequency(
  frequency: Frequency,
  endDate?: Date
): DateRange {
  switch (frequency) {
    case "daily":
      return calculateDateRange(1, endDate);
    case "weekly":
      return calculateDateRange(7, endDate);
    case "monthly":
      return calculateDateRange(30, endDate);
  }
}

/**
 * Calculate date range based on preference
 */
export function calculateDateRangeByPreference(
  preference: DateRangePreference,
  endDate?: Date
): DateRange {
  switch (preference) {
    case "last_24h":
      return calculateDateRange(1, endDate);
    case "last_week":
      return calculateDateRange(7, endDate);
    case "last_month":
      return calculateDateRange(30, endDate);
    case "last_3months":
      return calculateDateRange(90, endDate);
    case "last_year":
      return calculateDateRange(365, endDate);
    case "custom":
      // For custom, return last week as default
      return calculateDateRange(7, endDate);
  }
}
