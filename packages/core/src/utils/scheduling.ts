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
  frequency: Frequency,
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
 * @param lastRunAt - Optional timestamp of last execution
 * @returns Timestamp (milliseconds) for next execution
 */
export function calculateNextRunAt(
  frequency: Frequency,
  deliveryTime: string,
  timezone: string,
  lastRunAt?: number
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

  // If we've already passed the delivery time today, move to the next period
  if (!isAfter(nextRunInUserTz, nowInUserTz)) {
    nextRunInUserTz = addFrequencyPeriod(nextRunInUserTz, frequency);
  }

  // Apply frequency rules - ensure we're in the future
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
