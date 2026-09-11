/**
 * Authoritative PKT (Asia/Karachi - UTC+5) Date & Time Utilities
 * Enforces strict timezone boundaries across all Employee Operations modules.
 * NEVER derive PKT work dates from UTC toISOString().slice(0, 10).
 */

export const PKT_TIMEZONE = 'Asia/Karachi';

/**
 * Returns the current (or provided) date as "YYYY-MM-DD" in Asia/Karachi timezone.
 */
export function getPKTTodayDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Returns the current (or provided) month as "YYYY-MM" in Asia/Karachi timezone.
 */
export function getPKTCurrentMonthString(date: Date = new Date()): string {
  const dateStr = getPKTTodayDateString(date);
  return dateStr.slice(0, 7);
}

/**
 * Returns the current (or provided) 24-hour time as "HH:mm:ss" in Asia/Karachi timezone.
 */
export function getPKTTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

/**
 * Returns structured PKT date and time components.
 */
export function getPKTDateTimeParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
  dateStr: string;
  monthStr: string;
  timeStr: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = parseInt(get('year'), 10) || date.getFullYear();
  const month = parseInt(get('month'), 10) || date.getMonth() + 1;
  const day = parseInt(get('day'), 10) || date.getDate();
  const hour = parseInt(get('hour'), 10) || 0;
  const minute = parseInt(get('minute'), 10) || 0;
  const second = parseInt(get('second'), 10) || 0;

  // Day of week in PKT (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const weekdayStr = get('weekday');
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? date.getDay();

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    dateStr,
    monthStr,
    timeStr
  };
}

/**
 * Formats an ISO string or Date object into a readable 12-hour PKT time (e.g. "11:00 AM").
 */
export function formatPKTTime(
  isoOrDate: string | Date | null | undefined,
  includeSeconds: boolean = false
): string {
  if (!isoOrDate) return '--';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true
  }).format(d);
}

/**
 * Formats an ISO string, Date object, or "YYYY-MM-DD" string into readable PKT display date.
 */
export function formatPKTDate(
  isoOrDate: string | Date | null | undefined,
  format: 'iso' | 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!isoOrDate) return '--';
  const d = typeof isoOrDate === 'string'
    ? (isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00+05:00`) : new Date(isoOrDate))
    : isoOrDate;

  if (isNaN(d.getTime())) return typeof isoOrDate === 'string' ? isoOrDate : '--';

  if (format === 'iso') {
    return getPKTTodayDateString(d);
  }

  if (format === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PKT_TIMEZONE,
      month: 'short',
      day: 'numeric'
    }).format(d);
  }

  if (format === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PKT_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d);
}

/**
 * Returns exact number of calendar days in a given year and month (1-indexed).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns exact number of calendar days in a "YYYY-MM" month period string.
 */
export function getDaysInPKTMonth(monthPeriod: string = getPKTCurrentMonthString()): number {
  const [yearStr, monthStr] = monthPeriod.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!year || !month) return 30;
  return getDaysInMonth(year, month);
}

/**
 * Calculates calendar days until the 15th salary payout date in PKT.
 * Cycle: 1st - End of Month, paid on 15th of subsequent month.
 */
export function calculatePKTDaysUntil15th(currentDate: Date = new Date()): {
  nextSalaryDate: string;
  daysRemaining: number;
} {
  const { year, month, day } = getPKTDateTimeParts(currentDate);

  let targetYear = year;
  let targetMonth = month;
  let daysRemaining = 0;

  if (day <= 15) {
    targetYear = year;
    targetMonth = month;
    daysRemaining = 15 - day;
  } else {
    const daysInCurrentMonth = getDaysInMonth(year, month);
    daysRemaining = (daysInCurrentMonth - day) + 15;
    if (month === 12) {
      targetYear = year + 1;
      targetMonth = 1;
    } else {
      targetMonth = month + 1;
    }
  }

  const targetMonthStr = String(targetMonth).padStart(2, '0');
  const nextSalaryDate = `${targetYear}-${targetMonthStr}-15`;

  return { nextSalaryDate, daysRemaining };
}

/**
 * Returns formatted PKT countdown message.
 */
export function calculatePKTSalaryCountdown(currentDate: Date = new Date()): {
  nextSalaryDate: string;
  daysRemaining: number;
  formattedMessage: string;
} {
  const { nextSalaryDate, daysRemaining } = calculatePKTDaysUntil15th(currentDate);

  let formattedMessage = '';
  if (daysRemaining === 0) {
    formattedMessage = 'Salary Payout Day Today (15th) — Monthly Disbursal Active';
  } else if (daysRemaining === 1) {
    formattedMessage = `1 day until Salary Payout (15th) • Next Cycle Disbursal: ${nextSalaryDate}`;
  } else {
    formattedMessage = `${daysRemaining} days until Salary Payout (15th) • Next Cycle Disbursal: ${nextSalaryDate}`;
  }

  return { nextSalaryDate, daysRemaining, formattedMessage };
}

/**
 * Calculates tenure in days from start date to current PKT date.
 */
export function calculateDaysWithCompany(startDateStr: string, refDate: Date = new Date()): number {
  if (!startDateStr) return 0;
  const startParts = startDateStr.split('-').map(Number);
  if (startParts.length < 3 || isNaN(startParts[0])) return 0;

  const { year, month, day } = getPKTDateTimeParts(refDate);
  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const currentUtc = Date.UTC(year, month - 1, day);

  const diffMs = currentUtc - startUtc;
  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks whether a shift crosses midnight.
 * e.g. Start 20:00, End 05:00 -> true
 */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  return endMinutes <= startMinutes;
}

/**
 * Calculates absolute scheduled start and end Date objects for a shift on a given PKT work date.
 */
export function calculateShiftWindow(
  workDateStr: string,
  shiftOrStartTime: string | { startTime: string; endTime: string; crossesMidnight?: boolean },
  endTimeParam?: string,
  crossesMidnightParam?: boolean
): { scheduledStart: Date; scheduledEnd: Date; crossesMidnight: boolean; startIso: string; endIso: string; isOvernight: boolean } {
  let startTime: string;
  let endTime: string;
  let crossesMidnight: boolean;

  if (typeof shiftOrStartTime === 'object') {
    startTime = shiftOrStartTime.startTime;
    endTime = shiftOrStartTime.endTime;
    crossesMidnight = shiftOrStartTime.crossesMidnight ?? isOvernightShift(startTime, endTime);
  } else {
    startTime = shiftOrStartTime;
    endTime = endTimeParam || '20:00:00';
    crossesMidnight = crossesMidnightParam ?? isOvernightShift(startTime, endTime);
  }

  const scheduledStart = new Date(`${workDateStr}T${startTime}+05:00`);

  let scheduledEnd: Date;
  let nextDateStr = workDateStr;
  if (crossesMidnight) {
    const [y, m, d] = workDateStr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    nextDateStr = nextDate.toISOString().slice(0, 10);
    scheduledEnd = new Date(`${nextDateStr}T${endTime}+05:00`);
  } else {
    scheduledEnd = new Date(`${workDateStr}T${endTime}+05:00`);
  }

  const startIso = `${workDateStr}T${startTime}+05:00`;
  const endIso = `${nextDateStr}T${endTime}+05:00`;

  return { scheduledStart, scheduledEnd, crossesMidnight, startIso, endIso, isOvernight: crossesMidnight };
}
