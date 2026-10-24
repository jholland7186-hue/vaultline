/**
 * Planning horizon helpers.
 *
 * Lookback (default 2 months): Justin can catch the ledger up from that start
 * date through today — obligations, pay-ons, splits, spends.
 * Forward glance: upcoming dues ~1 month ahead (weekly pay still uses the
 * current pay period for the waterfall).
 */

export type LookbackMonths = 1 | 2;

/** Default catch-up window Justin asked for */
export const DEFAULT_LOOKBACK_MONTHS: LookbackMonths = 2;

/** How far ahead the Due schedule surfaces upcoming payments */
export const FORWARD_GLANCE_MONTHS = 1;

export function todayIsoDate(now = new Date()): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function normalizeLookbackMonths(value: unknown): LookbackMonths {
  return value === 1 ? 1 : 2;
}

/** Start of lookback window (inclusive), ending at today */
export function planningLookbackStart(
  months: LookbackMonths,
  now = new Date()
): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** End of forward glance (inclusive) — upcoming dues beyond today */
export function forwardGlanceEnd(now = new Date()): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() + FORWARD_GLANCE_MONTHS);
  return d.toISOString().slice(0, 10);
}

export function planningWindowBounds(months: LookbackMonths, now = new Date()) {
  return {
    start: planningLookbackStart(months, now),
    end: todayIsoDate(now),
    forwardEnd: forwardGlanceEnd(now),
  };
}

/** e.g. "Planning from 2026-08-24 → today" */
export function planningWindowLabel(months: LookbackMonths, now = new Date()): string {
  const { start } = planningWindowBounds(months, now);
  return `Planning from ${start} → today`;
}

export function isIsoDay(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Day is inside lookback → today (catch-up entry window) */
export function isInLookbackThroughToday(
  day: string,
  months: LookbackMonths,
  now = new Date()
): boolean {
  if (!isIsoDay(day)) return false;
  const { start, end } = planningWindowBounds(months, now);
  return day >= start && day <= end;
}

/** Day is after today through forward glance */
export function isInForwardGlance(day: string, now = new Date()): boolean {
  if (!isIsoDay(day)) return false;
  const today = todayIsoDate(now);
  const forwardEnd = forwardGlanceEnd(now);
  return day > today && day <= forwardEnd;
}

/**
 * Soft clamp for spend / due entry: prefer lookback→today; allow forward glance
 * for upcoming dues. Returns null if the day is outside both windows.
 */
export function suggestDateInHorizon(
  day: string | null | undefined,
  months: LookbackMonths,
  now = new Date()
): { ok: boolean; day: string; hint?: string } {
  const today = todayIsoDate(now);
  if (!isIsoDay(day)) {
    return { ok: true, day: today };
  }
  const cleaned = day.trim();
  if (isInLookbackThroughToday(cleaned, months, now)) {
    return { ok: true, day: cleaned };
  }
  if (isInForwardGlance(cleaned, now)) {
    return { ok: true, day: cleaned };
  }
  const { start, forwardEnd } = planningWindowBounds(months, now);
  return {
    ok: false,
    day: cleaned,
    hint: `Use a date from ${start} through ${forwardEnd} (lookback → today, then ~1 month ahead).`,
  };
}
