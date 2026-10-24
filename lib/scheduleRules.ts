import type { Cadence, IncomeProfile, PayCadence } from '@/types';

/** JS weekday: 0 = Sunday … 6 = Saturday (Thursday = 4). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Array<{ value: Weekday; short: string; long: string }> = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
];

export function weekdayLabel(day: number | null | undefined): string {
  if (day == null || day < 0 || day > 6) return '';
  return WEEKDAYS[day as Weekday]?.long ?? '';
}

export function clampMonthDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, Math.round(day)), last);
}

function atLocalNoon(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function fromIsoDay(iso: string): Date {
  return atLocalNoon(new Date(iso + 'T12:00:00'));
}

export function toIsoDay(d: Date): string {
  const x = atLocalNoon(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, clampMonthDay(year, monthIndex, day), 12, 0, 0, 0);
}

/** Length of the current pay period in days (inclusive span helper). */
export function periodLengthDays(cadence: PayCadence): number {
  switch (cadence) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'semi_monthly':
      return 15;
    case 'monthly':
      return 30;
  }
}

/**
 * Current pay period from income schedule anchors.
 * Weekly: most recent payday weekday → +6 days.
 * Semi-monthly: between the two month-days (e.g. 2nd & 15th).
 * Monthly: from month-day through day before next.
 * Biweekly: weekday + optional anchor ISO payday.
 */
export function periodBoundsForIncome(
  income: Pick<
    IncomeProfile,
    'cadence' | 'payWeekday' | 'payMonthDay' | 'payMonthDay2' | 'payAnchorDate'
  >,
  today: Date = new Date()
): { start: string; end: string } {
  const t = atLocalNoon(today);
  const cadence = income.cadence;

  if (cadence === 'weekly') {
    const weekday = normalizeWeekday(income.payWeekday) ?? 1;
    const start = new Date(t);
    const diff = (start.getDay() - weekday + 7) % 7;
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toIsoDay(start), end: toIsoDay(end) };
  }

  if (cadence === 'biweekly') {
    const weekday = normalizeWeekday(income.payWeekday) ?? 1;
    const msDay = 86400000;
    let payday: Date;
    if (income.payAnchorDate && /^\d{4}-\d{2}-\d{2}$/.test(income.payAnchorDate)) {
      const anchor = fromIsoDay(income.payAnchorDate);
      payday = new Date(anchor);
      while (payday.getTime() + 14 * msDay <= t.getTime()) {
        payday.setDate(payday.getDate() + 14);
      }
      while (payday.getTime() > t.getTime()) {
        payday.setDate(payday.getDate() - 14);
      }
    } else {
      payday = mostRecentWeekday(t, weekday);
    }
    const end = new Date(payday);
    end.setDate(end.getDate() + 13);
    return { start: toIsoDay(payday), end: toIsoDay(end) };
  }

  if (cadence === 'semi_monthly') {
    const raw1 = income.payMonthDay ?? 1;
    const raw2 = income.payMonthDay2 ?? 15;
    const a = Math.min(raw1, raw2);
    const b = Math.max(raw1, raw2);
    return semiMonthlyBounds(t, a, b);
  }

  // monthly
  const day = income.payMonthDay ?? 1;
  return monthlyBounds(t, day);
}

function mostRecentWeekday(today: Date, weekday: number): Date {
  const start = new Date(today);
  const diff = (start.getDay() - weekday + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

function semiMonthlyBounds(today: Date, dayA: number, dayB: number): { start: string; end: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const candidates: Date[] = [];
  for (let offset = -1; offset <= 2; offset++) {
    const dt = new Date(y, m + offset, 1);
    candidates.push(monthDate(dt.getFullYear(), dt.getMonth(), dayA));
    candidates.push(monthDate(dt.getFullYear(), dt.getMonth(), dayB));
  }
  candidates.sort((x, z) => x.getTime() - z.getTime());
  let start = candidates[0];
  for (const c of candidates) {
    if (c.getTime() <= today.getTime()) start = c;
  }
  const next = candidates.find((c) => c.getTime() > start.getTime()) ?? start;
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  return { start: toIsoDay(start), end: toIsoDay(end) };
}

function monthlyBounds(today: Date, day: number): { start: string; end: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  let start = monthDate(y, m, day);
  if (start.getTime() > today.getTime()) {
    start = monthDate(y, m - 1, day);
  }
  const next = monthDate(start.getFullYear(), start.getMonth() + 1, day);
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  return { start: toIsoDay(start), end: toIsoDay(end) };
}

export function normalizeWeekday(value: number | null | undefined): Weekday | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > 6) return null;
  return n as Weekday;
}

export function normalizeMonthDay(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 31) return null;
  return n;
}

/** Next due ISO day on/after `onOrAfter` for a recurring bill rule. */
export function nextDueOnOrAfter(
  onOrAfter: string | Date,
  rule: {
    cadence: Cadence;
    recurWeekday?: number | null;
    recurMonthDay?: number | null;
  }
): string {
  const start = typeof onOrAfter === 'string' ? fromIsoDay(onOrAfter) : atLocalNoon(onOrAfter);

  if (rule.cadence === 'once') {
    return toIsoDay(start);
  }

  if (rule.cadence === 'weekly' || rule.cadence === 'biweekly') {
    const weekday = normalizeWeekday(rule.recurWeekday) ?? start.getDay();
    const d = new Date(start);
    const diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return toIsoDay(d);
  }

  // monthly
  const monthDay = normalizeMonthDay(rule.recurMonthDay) ?? start.getDate();
  let candidate = monthDate(start.getFullYear(), start.getMonth(), monthDay);
  if (candidate.getTime() < start.getTime()) {
    candidate = monthDate(start.getFullYear(), start.getMonth() + 1, monthDay);
  }
  return toIsoDay(candidate);
}

/** After marking a cycle paid, roll to the next occurrence (exclusive of current due). */
export function nextDueAfterPaid(
  currentDue: string,
  rule: {
    cadence: Cadence;
    recurWeekday?: number | null;
    recurMonthDay?: number | null;
  }
): string | null {
  if (rule.cadence === 'once') return null;
  const cur = fromIsoDay(currentDue);
  const after = new Date(cur);
  after.setDate(after.getDate() + 1);

  if (rule.cadence === 'weekly') {
    return nextDueOnOrAfter(after, rule);
  }
  if (rule.cadence === 'biweekly') {
    const weekday = normalizeWeekday(rule.recurWeekday) ?? cur.getDay();
    const d = new Date(cur);
    d.setDate(d.getDate() + 14);
    // snap to weekday if needed
    const diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return toIsoDay(d);
  }
  // monthly
  const monthDay = normalizeMonthDay(rule.recurMonthDay) ?? cur.getDate();
  const next = monthDate(cur.getFullYear(), cur.getMonth() + 1, monthDay);
  return toIsoDay(next);
}

export function incomeScheduleLabel(
  income: Pick<
    IncomeProfile,
    'cadence' | 'payWeekday' | 'payMonthDay' | 'payMonthDay2' | 'payAnchorDate'
  >
): string {
  const cadence = income.cadence;
  if (cadence === 'weekly') {
    const w = weekdayLabel(income.payWeekday);
    return w ? `Weekly on ${w}` : 'Weekly';
  }
  if (cadence === 'biweekly') {
    const w = weekdayLabel(income.payWeekday);
    const base = w ? `Every 2 weeks on ${w}` : 'Every 2 weeks';
    return income.payAnchorDate ? `${base} (from ${income.payAnchorDate})` : base;
  }
  if (cadence === 'semi_monthly') {
    const a = income.payMonthDay ?? 1;
    const b = income.payMonthDay2 ?? 15;
    return `Twice a month on the ${ordinal(Math.min(a, b))} & ${ordinal(Math.max(a, b))}`;
  }
  const d = income.payMonthDay ?? 1;
  return `Monthly on the ${ordinal(d)}`;
}

export function obligationRecurrenceLabel(o: {
  cadence: Cadence;
  recurWeekday?: number | null;
  recurMonthDay?: number | null;
}): string {
  if (o.cadence === 'once') return 'One-time';
  if (o.cadence === 'weekly') {
    const w = weekdayLabel(o.recurWeekday);
    return w ? `Every ${w}` : 'Weekly';
  }
  if (o.cadence === 'biweekly') {
    const w = weekdayLabel(o.recurWeekday);
    return w ? `Every 2 weeks on ${w}` : 'Every 2 weeks';
  }
  const d = o.recurMonthDay;
  return d ? `Monthly on the ${ordinal(d)}` : 'Monthly';
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** @deprecated Prefer periodBoundsForIncome — kept for older call sites */
export function periodBoundsForCadence(cadence: PayCadence): { start: string; end: string } {
  return periodBoundsForIncome({ cadence });
}
