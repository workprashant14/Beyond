import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiameterKm, parseMassKg, ratio, describeRatio } from "../utils/compare";
import { getAllObjects, getObject } from "../services/catalogue";

test("parses strict diameter and mass formats", () => {
  assert.equal(parseDiameterKm("12,742 km"), 12742);
  assert.equal(parseDiameterKm("139,820 km"), 139820);
  assert.equal(parseMassKg("5.972 × 10²⁴ kg"), 5.972e24);
  assert.equal(parseMassKg("1.0 × 10⁻³ kg"), 1e-3);
});

test("refuses prose, ranges and missing values instead of guessing", () => {
  for (const s of ["about 940 km", "roughly 100,000 light-years", "", null, undefined, "12 km - 15 km", "0 km"]) {
    assert.equal(parseDiameterKm(s as string | null), null);
  }
  for (const s of ["about 21 solar masses", "5.972 kg", null, undefined]) assert.equal(parseMassKg(s as string | null), null);
});

test("ratio and wording", () => {
  assert.equal(ratio(10, 5), 2);
  assert.equal(ratio(null, 5), null);
  assert.equal(ratio(5, 0), null);
  assert.equal(describeRatio(null, "diameter", "A", "B"), null);
  assert.equal(describeRatio(0.1, "diameter", "Earth", "Jupiter"), "Jupiter is 10.0× Earth in diameter");
  assert.equal(describeRatio(1, "mass", "A", "B"), "A and B have the same mass");
});

test("real catalogue: Earth vs Jupiter ratios are physically right", () => {
  const e = getObject("earth")!, j = getObject("jupiter")!;
  const d = ratio(parseDiameterKm(j.diameter), parseDiameterKm(e.diameter))!;
  assert.ok(d > 10.5 && d < 11.5, `diameter ratio ${d}`); // Jupiter ~ 11 Earths wide
  const m = ratio(parseMassKg(j.mass), parseMassKg(e.mass))!;
  assert.ok(m > 310 && m < 325, `mass ratio ${m}`); // ~318
});

test("every catalogue object either parses cleanly or returns null (never NaN)", () => {
  for (const o of getAllObjects()) {
    for (const v of [parseDiameterKm(o.diameter), parseMassKg(o.mass)]) assert.ok(v === null || Number.isFinite(v), o.id);
  }
});
