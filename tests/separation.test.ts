import { test } from "node:test";
import assert from "node:assert/strict";
import { separation, distanceSeries, formatLightTime, AU_KM, bodyPosition, isSepBody } from "../utils/separation";

const D = (s: string) => new Date(s);
const near = (x: number, ref: number, tol: number, msg: string) => assert.ok(Math.abs(x - ref) / ref < tol, `${msg}: got ${x}, expected ${ref} within ${tol * 100}%`);

// Reference values are well-known published figures (independent of this code's formulas).
test("Earth-Sun distance follows perihelion (early Jan, ~0.983 au) and aphelion (early Jul, ~1.017 au)", () => {
  near(separation("earth", "sun", D("2026-01-03T12:00:00Z"))!.au, 0.9833, 0.003, "perihelion");
  near(separation("earth", "sun", D("2026-07-06T12:00:00Z"))!.au, 1.0167, 0.003, "aphelion");
});

test("Mars at opposition: closest approaches of 2003 and 2018 (NASA: 55.76 and 57.59 million km)", () => {
  near(separation("earth", "mars", D("2003-08-27T09:51:00Z"))!.km, 55.76e6, 0.02, "2003");
  near(separation("earth", "mars", D("2018-07-31T00:00:00Z"))!.km, 57.59e6, 0.02, "2018");
});

test("Venus at inferior conjunction 2020-06-03 is about 0.29 au away", () => {
  near(separation("earth", "venus", D("2020-06-03T12:00:00Z"))!.au, 0.2894, 0.03, "venus");
});

test("sunlight takes about 499 s per au", () => {
  const s = separation("sun", "earth", D("2000-01-01T12:00:00Z"))!;
  near(s.lightSeconds / s.au, 499.0, 0.001, "light time per au");
  assert.equal(s.km, s.au * AU_KM);
});

test("symmetric, zero for same body, and triangle inequality holds", () => {
  const d = D("2030-05-05T00:00:00Z");
  assert.equal(separation("mars", "jupiter", d)!.au, separation("jupiter", "mars", d)!.au);
  assert.equal(separation("venus", "venus", d)!.au, 0);
  const ab = separation("earth", "mars", d)!.au, bc = separation("mars", "saturn", d)!.au, ac = separation("earth", "saturn", d)!.au;
  assert.ok(ac <= ab + bc + 1e-12);
});

test("refuses dates outside JPL's 1800-2050 validity instead of extrapolating", () => {
  assert.equal(separation("earth", "mars", D("1750-01-01T00:00:00Z")), null);
  assert.equal(separation("earth", "mars", D("2100-01-01T00:00:00Z")), null);
  assert.equal(bodyPosition("earth", new Date(NaN)), null);
  assert.ok(separation("earth", "mars", D("1800-01-01T00:00:00Z")));
});

test("series is daily, stops at range end, and moons are not supported bodies", () => {
  assert.equal(distanceSeries("earth", "mars", D("2026-01-01T00:00:00Z"), 365).length, 366);
  assert.equal(distanceSeries("earth", "mars", D("2050-12-25T00:00:00Z"), 30).length, 7);
  assert.equal(isSepBody("moon"), false);
  assert.equal(isSepBody("jupiter"), true);
});

test("light-time formatting", () => {
  assert.equal(formatLightTime(499), "8.3 minutes");
  assert.equal(formatLightTime(45.2), "45.2 seconds");
  assert.equal(formatLightTime(18000), "5.00 hours");
});
