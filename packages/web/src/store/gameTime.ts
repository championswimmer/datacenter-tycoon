/**
 * gameTime.ts — tick ↔ calendar conversion helpers.
 *
 * Convention: 1 tick = 1 month.
 * Tick 0 = 1 Jan 2025 (EPOCH_YEAR, month 0).
 * Days within a month are derived from the authoritative `subtick` plus an
 * optional animation fraction from `tickFractionStore`.
 *
 * This module is the *only* place that knows about the tick→calendar mapping.
 * All UI that wants to display time should import from here; it must NOT
 * render `state.tick` directly.
 */

import { DAYS_PER_TICK, type GameTimeView } from "@datacenter-tycoon/game-logic";

export const EPOCH_YEAR = 2025;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_MONTH = DAYS_PER_TICK;

export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface GameDate {
  year: number;  // e.g. 2025
  month: number; // 0-indexed: 0 = Jan, 11 = Dec
  day: number;   // 1..30
}

function clampFraction(fraction: number): number {
  return Math.min(Math.max(fraction, 0), 0.999999);
}

/** Build a display-friendly time view from authoritative month/day state. */
export function toGameTimeView(tick: number, subtick = 0, fraction = 0): GameTimeView {
  const clampedSubtick = Math.min(Math.max(subtick, 0), DAYS_PER_MONTH - 1);
  const monthFraction = clampFraction((clampedSubtick + clampFraction(fraction)) / DAYS_PER_MONTH);
  return {
    tick,
    subtick: clampedSubtick,
    dayOfMonth: clampedSubtick + 1,
    monthFraction,
  };
}

export function tickToGameDate(tick: number, fraction?: number): GameDate;
export function tickToGameDate(tick: number, subtick: number, fraction: number): GameDate;
/**
 * Convert authoritative month/day state into a calendar date.
 *
 * Compatibility overloads:
 * - `tickToGameDate(tick, fraction)` for older callers that only know about
 *   month progress.
 * - `tickToGameDate(tick, subtick, fraction)` for authoritative day state.
 */
export function tickToGameDate(tick: number, subtickOrFraction = 0, fraction = 0): GameDate {
  const month = tick % MONTHS_PER_YEAR;
  const year = EPOCH_YEAR + Math.floor(tick / MONTHS_PER_YEAR);
  const timeView = fraction === 0 && subtickOrFraction >= 0 && subtickOrFraction <= 1
    ? toGameTimeView(tick, Math.floor(clampFraction(subtickOrFraction) * DAYS_PER_MONTH), 0)
    : toGameTimeView(tick, subtickOrFraction, fraction);
  const day = Math.min(DAYS_PER_MONTH, Math.floor(timeView.monthFraction * DAYS_PER_MONTH) + 1);
  return { year, month, day };
}

/** "15 Mar 2025" — full date with day precision */
export function formatGameDate(d: GameDate): string {
  return `${d.day} ${MONTH_ABBR[d.month]} ${d.year}`;
}

/** "Mar 2025" — month/year only (log feed, sparkline, etc.) */
export function formatGameDateShort(d: GameDate): string {
  return `${MONTH_ABBR[d.month]} ${d.year}`;
}

/**
 * Compute how many whole months and remaining days lie between two tick positions.
 *
 * Both positions are expressed as (tick, fraction) where tick is an integer
 * month count and fraction is 0..1 progress through that month.
 *
 * Result is clamped to {months:0, days:0} when the "to" position is already
 * in the past relative to "from".
 */
export function monthsAndDaysBetween(
  fromTick: number, fromFraction: number,
  toTick: number,   toFraction: number,
): { months: number; days: number } {
  // Express everything in fractional days
  const fromDays = fromTick * DAYS_PER_MONTH + fromFraction * DAYS_PER_MONTH;
  const toDays   = toTick   * DAYS_PER_MONTH + toFraction   * DAYS_PER_MONTH;
  const totalDays = Math.max(0, toDays - fromDays);

  const months = Math.floor(totalDays / DAYS_PER_MONTH);
  const days   = Math.floor(totalDays % DAYS_PER_MONTH);
  return { months, days };
}

/**
 * Human-readable time remaining.
 *
 * Examples:
 *   (0, 0) → "expires today"
 *   (0, 7) → "7 days left"
 *   (2, 0) → "2 months left"
 *   (2,14) → "2 months 14 days left"
 */
export function formatRemaining(months: number, days: number): string {
  if (months <= 0 && days <= 0) return "expires today";
  if (months <= 0)              return `${days} day${days !== 1 ? "s" : ""} left`;
  if (days <= 0)                return `${months} month${months !== 1 ? "s" : ""} left`;
  return `${months} month${months !== 1 ? "s" : ""} ${days} day${days !== 1 ? "s" : ""} left`;
}
