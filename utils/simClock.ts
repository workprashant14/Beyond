/**
 * The Solar System simulation clock, as pure functions (no React, no three.js).
 *
 * The clock value is "days since J2000.0 in TDB" (the time argument of the JPL elements), so the 64 to 69 s between UTC and TDB is
 * accounted for. Dates shown to the user and typed by the user are UTC. The clock is limited to the years over which the planet
 * elements are valid (1800-01-01 to 2050-01-01): it stops there instead of silently drifting outside the accuracy range.
 */
import { J2000_JD, PLANET_ELEMENTS_VALID_FROM_JD, PLANET_ELEMENTS_VALID_TO_JD, SECONDS_PER_DAY, jdTdbFromUtc, julianDateUtc, ttMinusUtc, tdbMinusTt, dateFromJulianDate } from "./timeScales";

export type ClockLimit = "start" | "end";

/** UTC milliseconds to clock days (TDB days since J2000). */
export const utcMsToClockDays = (ms: number): number => jdTdbFromUtc(julianDateUtc(new Date(ms))) - J2000_JD;

/** Clock days back to UTC milliseconds (inverse of utcMsToClockDays; error well under a millisecond). */
export function clockDaysToUtcMs(days: number): number {
  const jdTdb = J2000_JD + days;
  let jdUtc = jdTdb;
  for (let i = 0; i < 3; i++) {
    const tt = jdUtc + ttMinusUtc(jdUtc).seconds / SECONDS_PER_DAY;
    jdUtc = jdTdb - (tt - jdUtc) - tdbMinusTt(tt) / SECONDS_PER_DAY;
  }
  return dateFromJulianDate(jdUtc).getTime();
}

/** Limits of the clock in clock days (1800-01-01 and 2050-01-01 UTC). */
export const CLOCK_MIN_DAYS = utcMsToClockDays((PLANET_ELEMENTS_VALID_FROM_JD - 2440587.5) * 86_400_000);
export const CLOCK_MAX_DAYS = utcMsToClockDays((PLANET_ELEMENTS_VALID_TO_JD - 2440587.5) * 86_400_000);

export function clampClock(days: number): { days: number; limit: ClockLimit | null } {
  if (!Number.isFinite(days)) throw new RangeError("clock value must be a finite number");
  if (days <= CLOCK_MIN_DAYS) return { days: CLOCK_MIN_DAYS, limit: days < CLOCK_MIN_DAYS ? "start" : null };
  if (days >= CLOCK_MAX_DAYS) return { days: CLOCK_MAX_DAYS, limit: days > CLOCK_MAX_DAYS ? "end" : null };
  return { days, limit: null };
}

/**
 * One frame: advance by speedDaysPerSecond (always positive) x dt in the given direction, ignoring pauses and dt that are not sensible.
 * dt is capped at 0.1 s so a stalled tab does not jump the simulation. Returns which limit was hit, if any.
 */
export function stepClock(days: number, dtSeconds: number, speedDaysPerSecond: number, direction: 1 | -1): { days: number; limit: ClockLimit | null } {
  if (!(dtSeconds > 0) || !(speedDaysPerSecond > 0)) return { days, limit: null };
  const next = days + direction * Math.min(dtSeconds, 0.1) * speedDaysPerSecond;
  const c = clampClock(next);
  return c;
}

/** UTC calendar date of a clock value, "YYYY-MM-DD". */
export const formatClockDate = (days: number): string => new Date(clockDaysToUtcMs(days)).toISOString().slice(0, 10);

/** Strict "YYYY-MM-DD" (a real calendar date) to UTC milliseconds at 00:00, or null. */
export function parseDateInput(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.getTime();
}

/** Date-picker bounds, "YYYY-MM-DD". */
export const CLOCK_MIN_DATE = "1800-01-01";
export const CLOCK_MAX_DATE = "2050-01-01";

/** Clock days for a typed date, or null if the text is not a real date inside 1800-01-01 to 2050-01-01. */
export function clockDaysFromDateInput(s: string): number | null {
  const ms = parseDateInput(s);
  if (ms === null) return null;
  const days = utcMsToClockDays(ms);
  return days < CLOCK_MIN_DAYS || days > CLOCK_MAX_DAYS ? null : days;
}
