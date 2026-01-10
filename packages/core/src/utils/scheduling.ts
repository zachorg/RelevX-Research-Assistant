/**
 * Scheduling utilities for calculating project execution times
 *
 * Handles timezone conversions, nextRunAt calculations, and validation
 * for user-specified delivery times and frequencies.
 */

import { add, set, isAfter } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { Frequency } from "../models/project";

/**
 * Validate that a project hasn't run too frequently (max daily)
 * @param frequency - Project frequency
 * @param lastRunAt - Timestamp of last execution
 * @returns true if enough time has passed, false if too soon
 */
export function validateFrequency(
  // frequency: Frequency,
  lastRunAt?: number
): boolean {
  if (!lastRunAt) {
    return true; // Never run before, always valid
  }

  const now = Date.now();
  const timeSinceLastRun = now - lastRunAt;
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Prevent running more than once per day (daily is the maximum frequency)
  return timeSinceLastRun >= oneDayMs;
}

/**
 * Calculate the next run timestamp based on frequency, delivery time, and timezone
 * @param frequency - daily, weekly, or monthly
 * @param deliveryTime - HH:MM format in user's timezone
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param dayOfWeek - 0-6 (Sunday-Saturday), used when frequency is "weekly"
 * @param dayOfMonth - 1-31, used when frequency is "monthly"
 * @returns Timestamp (milliseconds) for next execution
 */
export function calculateNextRunAt(
  frequency: Frequency,
  deliveryTime: string,
  timezone: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): number {
  // Parse delivery time
  const [hours, minutes] = deliveryTime.split(":").map(Number);

  // Get current time in UTC
  const now = new Date();

  // Convert to user's timezone
  const nowInUserTz = toZonedTime(now, timezone);

  // Set the delivery time for today in user's timezone
  let nextRunInUserTz = set(nowInUserTz, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });

  // Handle weekly frequency - find the next occurrence of the specified day
  if (frequency === "weekly" && dayOfWeek !== undefined) {
    const currentDayOfWeek = nextRunInUserTz.getDay();
    let daysUntilTarget = dayOfWeek - currentDayOfWeek;

    // If today is the target day but time has passed, or if target day is earlier in week
    if (
      daysUntilTarget < 0 ||
      (daysUntilTarget === 0 && !isAfter(nextRunInUserTz, nowInUserTz))
    ) {
      daysUntilTarget += 7;
    }

    nextRunInUserTz = add(nextRunInUserTz, { days: daysUntilTarget });
  }
  // Handle monthly frequency - find the next occurrence of the specified day
  else if (frequency === "monthly" && dayOfMonth !== undefined) {
    const currentDay = nextRunInUserTz.getDate();
    const currentMonth = nextRunInUserTz.getMonth();
    const currentYear = nextRunInUserTz.getFullYear();

    // Get the last day of the current month
    const lastDayOfCurrentMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();
    const targetDay = Math.min(dayOfMonth, lastDayOfCurrentMonth);

    // Check if we can still run this month
    if (
      currentDay < targetDay ||
      (currentDay === targetDay && isAfter(nextRunInUserTz, nowInUserTz))
    ) {
      nextRunInUserTz = set(nextRunInUserTz, { date: targetDay });
    } else {
      // Move to next month
      const nextMonth = currentMonth + 1;
      const nextMonthYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const actualNextMonth = nextMonth > 11 ? 0 : nextMonth;
      const lastDayOfNextMonth = new Date(
        nextMonthYear,
        actualNextMonth + 1,
        0
      ).getDate();
      const nextTargetDay = Math.min(dayOfMonth, lastDayOfNextMonth);

      nextRunInUserTz = set(nextRunInUserTz, {
        year: nextMonthYear,
        month: actualNextMonth,
        date: nextTargetDay,
      });
    }
  }
  // Daily frequency - just ensure we're in the future
  else {
    if (!isAfter(nextRunInUserTz, nowInUserTz)) {
      nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
    }
  }

  // Final check - ensure we're in the future
  while (!isAfter(nextRunInUserTz, nowInUserTz)) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // Convert from user's timezone to UTC timestamp
  const nextRunUtc = fromZonedTime(nextRunInUserTz, timezone);
  return nextRunUtc.getTime();
}

/**
 * Add one frequency period to a date
 * @param date - Starting date
 * @param frequency - Period to add
 * @returns New date with period added
 */
function addFrequencyPeriod(date: Date, frequency: Frequency): Date {
  switch (frequency) {
    case "daily":
      return add(date, { days: 1 });
    case "weekly":
      return add(date, { weeks: 1 });
    case "monthly":
      return add(date, { months: 1 });
  }
}

/**
 * Check if a project is due to run now
 * @param nextRunAt - Scheduled next run timestamp
 * @param gracePeriodMs - Grace period in milliseconds (default: 1 minute)
 * @returns true if project should run now
 */
export function isProjectDue(
  nextRunAt?: number,
  gracePeriodMs: number = 60000
): boolean {
  if (!nextRunAt) {
    return false; // No scheduled time, don't run
  }

  const now = Date.now();
  // Allow a 1-minute grace period in case the cron runs slightly late
  return nextRunAt <= now + gracePeriodMs;
}
