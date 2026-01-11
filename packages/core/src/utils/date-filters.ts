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

/**
 * Format a date string to a human-readable format like "Jan 10th, 2026"
 * Handles ISO date strings, timestamps, and date objects
 * Returns empty string if date is invalid or missing
 */
export function formatReadableDate(
  dateInput: string | Date | undefined | null
): string {
  if (!dateInput) {
    return "";
  }

  try {
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "";
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const getOrdinalSuffix = (n: number): string => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
    };

    return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
  } catch {
    return "";
  }
}
