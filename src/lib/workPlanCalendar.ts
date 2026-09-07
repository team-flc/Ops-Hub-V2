// ==============================================================================
// UTILITY: workPlanCalendar
// Location: src/lib/workPlanCalendar.ts
// Phase: 3D â€” Exact 90-Calendar-Day Work Plan Calendar & Business-Day Math
// ==============================================================================

import { isSunday, isSaturday, isWeekend } from './taskManagementService';
import { WorkPlanWeek } from '../types';

export interface PlanDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (startDate + 89 days)
  isStartDateWeekend: boolean;
  suggestedMonday: string;
}

export interface CalculatedTaskDates {
  plannedStart: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  isValid: boolean;
  error?: string;
}

/**
 * Add calendar days to a YYYY-MM-DD date string
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a YYYY-MM-DD date into "Sep 7, 2026"
 */
export function formatPlanDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}

/**
 * Computes exact 90-day boundary and checks weekend start
 */
export function compute90DayPlanRange(startDateInput: string): PlanDateRange {
  const startDate = startDateInput.trim();
  const endDate = addCalendarDays(startDate, 89);
  const isWeekendStart = isWeekend(startDate);

  // Calculate next Monday if start date is Saturday or Sunday
  let suggestedMonday = startDate;
  if (isWeekendStart) {
    const [y, m, d] = startDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay(); // 0 = Sun, 6 = Sat
    const daysToAdd = day === 6 ? 2 : 1;
    suggestedMonday = addCalendarDays(startDate, daysToAdd);
  }

  return {
    startDate,
    endDate,
    isStartDateWeekend: isWeekendStart,
    suggestedMonday
  };
}

/**
 * Generates the 13 week buckets for a 90-day plan:
 * Weeks 1â€“12: 7 calendar days each
 * Week 13: 6 calendar days
 */
export function generate13PlanWeeks(startDate: string): Array<{
  weekNumber: number;
  startDate: string;
  endDate: string;
  calendarDayCount: number;
  label: string;
}> {
  const weeks = [];
  let currentStart = startDate;

  for (let w = 1; w <= 13; w++) {
    const dayCount = w === 13 ? 6 : 7;
    const weekEnd = addCalendarDays(currentStart, dayCount - 1);
    weeks.push({
      weekNumber: w,
      startDate: currentStart,
      endDate: weekEnd,
      calendarDayCount: dayCount,
      label: `Week ${w} (${formatPlanDate(currentStart)} - ${formatPlanDate(weekEnd)})`
    });
    currentStart = addCalendarDays(weekEnd, 1);
  }

  return weeks;
}

/**
 * Get all business days (excluding Sunday) inside a date range [rangeStart, rangeEnd] inclusive
 */
export function getBusinessDaysInRange(rangeStart: string, rangeEnd: string): string[] {
  const list: string[] = [];
  let curr = rangeStart;
  while (curr <= rangeEnd) {
    if (!isSunday(curr)) {
      list.push(curr);
    }
    curr = addCalendarDays(curr, 1);
  }
  return list;
}

/**
 * Calculates planned start and due dates for a task definition inside a specific week:
 * - plannedOffsetDays: 0 = first business day inside the target week
 * - durationBusinessDays: 1 = due on that same business day, 2 = due on next business day
 * Enforces that dates stay strictly within the target week and within the 90-day plan boundary.
 */
export function calculateTaskDatesForWeek(params: {
  weekStartDate: string;
  weekEndDate: string;
  planEndDate: string;
  plannedOffsetDays: number;
  durationBusinessDays: number;
}): CalculatedTaskDates {
  const businessDays = getBusinessDaysInRange(params.weekStartDate, params.weekEndDate);

  if (businessDays.length === 0) {
    return {
      plannedStart: params.weekStartDate,
      dueDate: params.weekStartDate,
      isValid: false,
      error: 'No business days available in the selected week.'
    };
  }

  const offset = Math.max(0, Math.floor(params.plannedOffsetDays || 0));
  const duration = Math.max(1, Math.floor(params.durationBusinessDays || 1));

  if (offset >= businessDays.length) {
    return {
      plannedStart: businessDays[businessDays.length - 1],
      dueDate: businessDays[businessDays.length - 1],
      isValid: false,
      error: `Offset ${offset} business days exceeds available business days in this week (${businessDays.length} available).`
    };
  }

  const plannedStart = businessDays[offset];

  // Duration in business days starting from plannedStart
  // E.g. Duration 1 -> due on plannedStart
  // Duration 2 -> next business day
  const dueIndex = offset + duration - 1;

  if (dueIndex >= businessDays.length) {
    // Cannot fit inside the week!
    return {
      plannedStart,
      dueDate: businessDays[businessDays.length - 1],
      isValid: false,
      error: `Task duration (${duration} business days from offset ${offset}) exceeds the end of this week. Available days remaining: ${businessDays.length - offset}.`
    };
  }

  const dueDate = businessDays[dueIndex];

  // Verify within overall 90-day plan end date
  if (dueDate > params.planEndDate) {
    return {
      plannedStart,
      dueDate,
      isValid: false,
      error: `Task due date (${dueDate}) exceeds the 90-day plan end date (${params.planEndDate}).`
    };
  }

  return {
    plannedStart,
    dueDate,
    isValid: true
  };
}


export const isSundayKarachi = isSunday;

export function calculateBusinessDueDate(startDate: string, durationBusinessDays: number): string {
  let curr = startDate;
  let count = 0;
  while (true) {
    if (!isSunday(curr)) {
      count++;
      if (count >= durationBusinessDays) {
        return curr;
      }
    }
    curr = addCalendarDays(curr, 1);
  }
}