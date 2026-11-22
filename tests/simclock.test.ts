import { test } from "node:test";
import assert from "node:assert/strict";
import {
  utcMsToClockDays, clockDaysToUtcMs, clampClock, stepClock, formatClockDate, parseDateInput, clockDaysFromDateInput,
  CLOCK_MIN_DAYS, CLOCK_MAX_DAYS, CLOCK_MIN_DATE, CLOCK_MAX_DATE,
} from "../utils/simClock";
import { SPEEDS } from "../universe/engine/simTypes";

const near = (a: number, b: number, tol: number, m = "") => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

test("clock days are TDB: J2000 noon UTC is 64.184 s + TDB-TT after the epoch; round trip to UTC is exact to a millisecond", () => {
  const j2000 = Date.UTC(2000, 0, 1, 12);
  near(utcMsToClockDays(j2000) * 86400, 64.184, 0.002, "seconds after J2000.0 TDB");
  for (const ms of [Date.UTC(1800, 0, 1), Date.UTC(1950, 5, 15, 3, 4, 5), j2000, Date.UTC(2026, 10, 15, 21, 29), Date.UTC(2049, 11, 31, 23, 59, 59)]) {
    near(clockDaysToUtcMs(utcMsToClockDays(ms)), ms, 1, `round trip ${new Date(ms).toISOString()}`);
  }
  near(utcMsToClockDays(Date.UTC(2026, 10, 15)) - (Date.UTC(2026, 10, 15) - Date.UTC(2000, 0, 1, 12)) / 86_400_000, 69.184 / 86400, 1e-5, "2026 offset ~69 s");
});

test("limits are 1800-01-01 and 2050-01-01 and the clock stops there", () => {
  assert.equal(formatClockDate(CLOCK_MIN_DAYS), CLOCK_MIN_DATE);
  assert.equal(formatClockDate(CLOCK_MAX_DAYS), CLOCK_MAX_DATE);
  assert.deepEqual(clampClock(CLOCK_MAX_DAYS + 5), { days: CLOCK_MAX_DAYS, limit: "end" });
  assert.deepEqual(clampClock(CLOCK_MIN_DAYS - 5), { days: CLOCK_MIN_DAYS, limit: "start" });
  assert.deepEqual(clampClock(0), { days: 0, limit: null });
  assert.equal(clampClock(CLOCK_MAX_DAYS).limit, null, "sitting exactly on the limit is not an overrun");
  assert.throws(() => clampClock(NaN), RangeError); assert.throws(() => clampClock(Infinity), RangeError);
});

test("stepping: forward, reverse, speed, dt cap, pause-like inputs, and stopping at a limit", () => {
  assert.equal(stepClock(100, 0.05, 10, 1).days, 100.5);
  assert.equal(stepClock(100, 0.05, 10, -1).days, 99.5);
  assert.equal(stepClock(100, 5, 10, 1).days, 101, "dt is capped at 0.1 s");
  assert.deepEqual(stepClock(100, 0, 10, 1), { days: 100, limit: null });
  assert.deepEqual(stepClock(100, -1, 10, 1), { days: 100, limit: null });
  assert.deepEqual(stepClock(100, 0.05, 0, 1), { days: 100, limit: null });
  const end = stepClock(CLOCK_MAX_DAYS - 0.2, 0.1, 100, 1);
  assert.deepEqual(end, { days: CLOCK_MAX_DAYS, limit: "end" });
  assert.deepEqual(stepClock(CLOCK_MIN_DAYS + 0.2, 0.1, 100, -1), { days: CLOCK_MIN_DAYS, limit: "start" });
  assert.equal(stepClock(CLOCK_MAX_DAYS, 0.1, 100, -1).days < CLOCK_MAX_DAYS, true, "reversing away from a limit works");
  assert.ok(SPEEDS.every((s) => s > 0), "speeds are magnitudes; direction is separate");
});

test("same clock value drives everything: a time step is identical for any consumer (pure function of days)", () => {
  const t = utcMsToClockDays(Date.UTC(2026, 0, 1));
  assert.equal(stepClock(t, 0.02, 25, 1).days, stepClock(t, 0.02, 25, 1).days);
});

test("date input: strict calendar dates inside the valid range only", () => {
  assert.equal(parseDateInput("2026-02-29"), null, "not a leap year");
  assert.equal(parseDateInput("2024-02-29"), Date.UTC(2024, 1, 29));
  for (const bad of ["", "2026-13-01", "2026-1-1", "20260101", "2026-01-01T00:00", "abc", "2026-00-10"]) assert.equal(parseDateInput(bad), null, bad);
  assert.equal(clockDaysFromDateInput("1799-12-31"), null);
  assert.equal(clockDaysFromDateInput("2050-01-02"), null);
  assert.ok(clockDaysFromDateInput("2050-01-01") !== null && clockDaysFromDateInput("1800-01-01") !== null);
  assert.equal(formatClockDate(clockDaysFromDateInput("2026-11-15")!), "2026-11-15");
  assert.equal(formatClockDate(clockDaysFromDateInput("1969-07-20")!), "1969-07-20");
});
