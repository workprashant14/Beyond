import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  julianDateUtc, dateFromJulianDate, mjd, taiMinusUtc, ttMinusUtc, jdTtFromUtc, jdTdbFromUtc, tdbMinusTt, J2000_JD, LAST_LEAP_SECOND_JD,
  planetElementsValidity, PLANET_ELEMENTS_VALID_FROM_JD, PLANET_ELEMENTS_VALID_TO_JD, centuriesSinceJ2000FromJd,
} from "../utils/timeScales";
import { PLANET_ELEMENTS } from "../data/keplerElements";
import { planetPosition, norm } from "../utils/kepler";

const near = (a: number, b: number, tol: number, m = "") => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const oracle = JSON.parse(readFileSync("tests/fixtures/time-oracle.json", "utf8")) as { rows: { jd_utc: number; tt_minus_utc: number; tdb_minus_tt: number }[] };
const planets = JSON.parse(readFileSync("tests/fixtures/planets-oracle.json", "utf8")) as { dates: { jd: number; bodies: Record<string, [number, number, number]> }[] };

test("Julian Date of well-known instants", () => {
  assert.equal(julianDateUtc(new Date(Date.UTC(2000, 0, 1, 12))), J2000_JD);
  assert.equal(julianDateUtc(new Date(Date.UTC(1970, 0, 1))), 2440587.5);
  assert.equal(julianDateUtc(new Date(Date.UTC(1858, 10, 17))), 2400000.5);
  assert.equal(mjd(julianDateUtc(new Date(Date.UTC(1858, 10, 17)))), 0);
  assert.equal(julianDateUtc(new Date(Date.UTC(1800, 0, 1))), PLANET_ELEMENTS_VALID_FROM_JD);
  assert.equal(julianDateUtc(new Date(Date.UTC(2050, 0, 1))), PLANET_ELEMENTS_VALID_TO_JD);
  for (const jd of [2415020.5, 2451545.25, 2461000.123]) near(julianDateUtc(dateFromJulianDate(jd)), jd, 1e-9, "round trip");
});

test("TT - UTC agrees with ERFA (astropy) wherever UTC has leap seconds; table is the real history", () => {
  for (const r of oracle.rows) {
    const mine = ttMinusUtc(r.jd_utc);
    assert.equal(mine.exact, true, String(r.jd_utc));
    near(mine.seconds, r.tt_minus_utc, 2e-4, `JD ${r.jd_utc}`);
  }
  assert.equal(taiMinusUtc(2441317.5).seconds, 10);        // 1972-01-01
  assert.equal(taiMinusUtc(2457754.5).seconds, 37);        // 2017-01-01
  assert.equal(taiMinusUtc(2461000.5).seconds, 37);        // 2026: no later leap second in the table
  assert.equal(LAST_LEAP_SECOND_JD, 2457754.5);
  const t0 = taiMinusUtc(2441317.4);                        // before UTC existed
  assert.deepEqual([t0.seconds, t0.exact], [10, false]);
});

test("TDB - TT periodic term is within 50 microseconds of ERFA", () => {
  for (const r of oracle.rows) near(tdbMinusTt(jdTtFromUtc(r.jd_utc)), r.tdb_minus_tt, 5e-5, `JD ${r.jd_utc}`);
  for (const jd of [2451545, 2455000, 2460000]) assert.ok(Math.abs(tdbMinusTt(jd)) < 0.00172);
  const jd = 2461000.5; near((jdTdbFromUtc(jd) - jd) * 86400, 69.184 + tdbMinusTt(jdTtFromUtc(jd)), 1e-4);
});

test("element validity window is 1800-2050", () => {
  assert.equal(planetElementsValidity(2451545), "valid");
  assert.equal(planetElementsValidity(PLANET_ELEMENTS_VALID_FROM_JD - 1), "outside");
  assert.equal(planetElementsValidity(PLANET_ELEMENTS_VALID_TO_JD + 1), "outside");
});

test("planet positions agree with an independent low-precision ephemeris (astropy builtin: ERFA epv00 + plan94), 1900 to 2050", () => {
  // Both are approximations. JPL states 15 arcsec (Mercury) to 600 arcsec (Saturn) for its own table, so the angular limits follow
  // those stated accuracies plus margin; distances must agree within 0.2%. Transcription or algorithm errors would be degrees.
  const limitArcmin: Record<string, number> = { mercury: 1, venus: 1, earth: 1, mars: 3, jupiter: 12, saturn: 15, uranus: 5, neptune: 3 };
  let worst = 0;
  for (const row of planets.dates) for (const [id, v] of Object.entries(row.bodies)) {
    const p = planetPosition(PLANET_ELEMENTS[id], centuriesSinceJ2000FromJd(row.jd));
    const ang = (Math.acos(Math.min(1, (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / (norm(p) * norm(v)))) * 180 * 60) / Math.PI;
    assert.ok(ang <= limitArcmin[id], `${id} JD ${row.jd}: ${ang.toFixed(2)} arcmin`);
    assert.ok(Math.abs(norm(p) / norm(v) - 1) < 0.002, `${id} distance`);
    worst = Math.max(worst, ang);
  }
  console.log(`worst planet direction difference vs ERFA/plan94 over ${planets.dates.length} dates x 8 planets: ${worst.toFixed(1)} arcmin`);
});
