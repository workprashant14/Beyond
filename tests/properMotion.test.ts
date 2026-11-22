import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchVertices, maxMoveDeg, movedPositions, movedRaDec } from "../utils/properMotion";

const oracle = JSON.parse(readFileSync(new URL("./fixtures/pm_oracle.json", import.meta.url), "utf8")) as {
  cases: { ra: number; dec: number; pmra: number; pmdec: number; years: number; d: number; rv: number; ra2: number; dec2: number }[];
  barnard: { years: number; sep_arcsec: number }[];
};
const expect = (v: number) => ({
  toBeLessThan: (x: number) => assert.ok(v < x, `${v} < ${x}`),
  toBeGreaterThan: (x: number) => assert.ok(v > x, `${v} > ${x}`),
  toBeGreaterThanOrEqual: (x: number) => assert.ok(v >= x),
  toBeLessThanOrEqual: (x: number) => assert.ok(v <= x),
  toBe: (x: number) => assert.equal(v, x),
  not: { toBe: (x: number) => assert.notEqual(v, x) },
  toBeCloseTo: (x: number, d: number) => assert.ok(Math.abs(v - x) < 10 ** -d),
});

const sepArcsec = (a: { ra: number; dec: number }, b: { ra: number; dec: number }) => {
  const r = Math.PI / 180;
  const c = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r);
  return Math.acos(Math.min(1, c)) / r * 3600;
};

describe("proper motion vs astropy/ERFA", () => {
  it("matches apply_space_motion (with distance and radial velocity) to well under 0.1 arcsecond", () => {
    for (const c of oracle.cases) {
      const m = movedRaDec(c.ra, c.dec, c.pmra, c.pmdec, c.years, c.d, c.rv);
      expect(sepArcsec(m, { ra: c.ra2, dec: c.dec2 })).toBeLessThan(0.1);
    }
  });
  it("without distance/rv it equals the rv = 0 model", () => {
    for (const c of oracle.cases.filter((x) => x.rv === 0)) {
      const m = movedRaDec(c.ra, c.dec, c.pmra, c.pmdec, c.years);
      expect(sepArcsec(m, { ra: c.ra2, dec: c.dec2 })).toBeLessThan(0.1);
    }
  });
  it("ignoring radial velocity is NOT negligible for Barnard's star (measured, 1000 y and 3000 y)", () => {
    const [a, b] = oracle.barnard;
    expect(a.sep_arcsec).toBeGreaterThan(600); // about 0.19 degrees
    expect(b.sep_arcsec).toBeGreaterThan(6000); // about 1.9 degrees
  });
});

describe("movedPositions / helpers", () => {
  it("zero years or missing proper motion leaves the place unchanged", () => {
    const r = movedPositions([10, 20], [5, -5], { pmra: [100, null], pmdec: [100, null] }, 500);
    expect(r.ra[1]).toBe(20);
    expect(r.dec[1]).toBe(-5);
    expect(r.ra[0]).not.toBe(10);
    const z = movedPositions([10], [5], { pmra: [100], pmdec: [100] }, 0);
    expect(z.ra[0]).toBe(10);
  });
  it("stays on the sphere and handles RA wrap at the pole", () => {
    const m = movedRaDec(359.99, 89.9, 5000, 5000, 3000);
    expect(m.ra).toBeGreaterThanOrEqual(0);
    expect(m.ra).toBeLessThan(360);
    expect(Math.abs(m.dec)).toBeLessThanOrEqual(90);
  });
  it("maxMoveDeg is the fastest star times the years", () => {
    expect(maxMoveDeg({ pmra: [3600000, 1], pmdec: [0, 1] }, 1)).toBeCloseTo(1, 9);
  });
  it("matchVertices finds the star under a vertex and -1 for a vertex on empty sky", () => {
    const m = matchVertices([[10.001, 20.001], [50, 50]], [10, 200], [20, 0]);
    assert.deepEqual(Array.from(m), [0, -1]);
  });
});
