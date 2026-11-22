import { test } from "node:test";
import assert from "node:assert/strict";
import { precessToDate, precessToJ2000 } from "../utils/precession";
import { utcFromParts, formatUt, partsFromDate, centuriesSinceJ2000, MAX_YEAR } from "../utils/skyTime";

const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const sep = (a: { ra: number; dec: number }, b: { ra: number; dec: number }) => {
  const r = Math.PI / 180;
  const c = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
};

test("identity at J2000 and exact round trip", () => {
  const p = precessToDate(123.4, -56.7, 0);
  near(p.ra, 123.4, 1e-9); near(p.dec, -56.7, 1e-9);
  for (const T of [-30, -3.3, 0.26, 1, 20]) {
    const b = precessToJ2000(...(Object.values(precessToDate(210.5, 37.2, T)) as [number, number]), T);
    near(b.ra, 210.5, 1e-9, `T=${T}`); near(b.dec, 37.2, 1e-9, `T=${T}`);
  }
});

test("rotation keeps angular separations", () => {
  const a = { ra: 10, dec: 20 }, b = { ra: 200, dec: -40 };
  for (const T of [-20, 0.5, 10]) near(sep(precessToDate(a.ra, a.dec, T), precessToDate(b.ra, b.dec, T)), sep(a, b), 1e-9);
});

test("first-order rates at the equinox: RA +1.2812 and Dec +0.5567 degrees per century (Meeus m and n)", () => {
  const p = precessToDate(0, 0, 1);
  near(p.ra, 1.2812, 0.005); near(p.dec, 0.5567, 0.005);
});

test("a star on the ecliptic moves along it by the general precession, about 1.397 degrees per century", () => {
  const eps = 23.4392911 * Math.PI / 180;
  const lam = 100 * Math.PI / 180; // ecliptic longitude 100 degrees, latitude 0
  const ra = Math.atan2(Math.sin(lam) * Math.cos(eps), Math.cos(lam)) * 180 / Math.PI;
  const dec = Math.asin(Math.sin(lam) * Math.sin(eps)) * 180 / Math.PI;
  const p = precessToDate(ra, dec, 1);
  // ecliptic of date differs slightly from the J2000 ecliptic, so measure along-ecliptic motion as the angular separation
  near(sep({ ra, dec }, p), 1.397, 0.02);
});

test("Polaris approaches the pole until about 2100; Thuban was close to it around 2800 BCE", () => {
  const polaris = { ra: 37.9546, dec: 89.2641 };
  const d2100 = precessToDate(polaris.ra, polaris.dec, 1).dec;
  assert.ok(d2100 > polaris.dec + 0.2 && d2100 < 90, `d2100=${d2100}`);
  const thuban = { ra: 211.0973, dec: 64.3759 };
  const T = (-2800 - 2000) / 100;
  assert.ok(precessToDate(thuban.ra, thuban.dec, T).dec > 87.5, "Thuban near the pole");
});

test("UT parts: validation, year 0 to 99 handled, formatting, centuries", () => {
  const d = utcFromParts({ year: 2000, month: 1, day: 1, hour: 12, minute: 0 })!;
  near(centuriesSinceJ2000(d), 0, 1e-9);
  assert.equal(formatUt(d), "2000-01-01 12:00");
  const old = utcFromParts({ year: 33, month: 4, day: 3, hour: 6, minute: 30 })!;
  assert.equal(old.getUTCFullYear(), 33);
  assert.deepEqual(partsFromDate(old), { year: 33, month: 4, day: 3, hour: 6, minute: 30 });
  const bce = utcFromParts({ year: -44, month: 3, day: 15, hour: 12, minute: 0 })!;
  assert.equal(formatUt(bce), "−0044-03-15 12:00");
  assert.equal(utcFromParts({ year: 2023, month: 2, day: 29, hour: 0, minute: 0 }), null);
  assert.ok(utcFromParts({ year: 2024, month: 2, day: 29, hour: 0, minute: 0 }));
  assert.equal(utcFromParts({ year: 1900, month: 2, day: 29, hour: 0, minute: 0 }), null);
  assert.equal(utcFromParts({ year: MAX_YEAR + 1, month: 1, day: 1, hour: 0, minute: 0 }), null);
  assert.equal(utcFromParts({ year: 2000, month: 13, day: 1, hour: 0, minute: 0 }), null);
  assert.equal(utcFromParts({ year: 2000.5, month: 1, day: 1, hour: 0, minute: 0 }), null);
});
