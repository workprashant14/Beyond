import { test } from "node:test";
import assert from "node:assert/strict";
import { REGIONS, generateRegionAu, getRegion, regionScenePositions, regionVisualRadius, LOG_FROM_AU } from "../utils/conceptualRegions";
import { visualOrbitRadius } from "../universe/objects/solarScale";

const norm = (a: Float32Array, i: number) => Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);

test("metadata: three regions with honest provenance, sources and caveats", () => {
  assert.deepEqual(REGIONS.map((r) => r.id), ["kuiper", "scattered", "oort"]);
  assert.equal(getRegion("oort").kind, "theoretical", "never directly observed");
  assert.equal(getRegion("kuiper").kind, "artistic");
  assert.equal(getRegion("scattered").kind, "artistic");
  for (const r of REGIONS) { assert.ok(r.source.length > 20 && r.caveat.length > 20 && r.extent.length > 20, r.id); assert.ok(r.rMinAu < r.rMaxAu); }
  assert.equal(getRegion("kuiper").rMinAu, 30); assert.equal(getRegion("kuiper").rMaxAu, 55);
  assert.equal(getRegion("oort").rMinAu, 5000); assert.equal(getRegion("oort").rMaxAu, 100000);
});

test("generation is deterministic and the seed matters", () => {
  const k = getRegion("kuiper");
  assert.deepEqual(generateRegionAu(k, 500, 1), generateRegionAu(k, 500, 1));
  assert.notDeepEqual(generateRegionAu(k, 500, 1), generateRegionAu(k, 500, 2));
  assert.equal(generateRegionAu(k, 0).length, 0);
});

test("every dot lies inside its region's radial extent", () => {
  for (const r of REGIONS) {
    const a = generateRegionAu(r, 4000, 3);
    for (let i = 0; i < 4000; i++) { const d = norm(a, i); assert.ok(d >= r.rMinAu * 0.9999 && d <= r.rMaxAu * 1.0001, `${r.id} dot ${i} at ${d} au`); }
  }
});

test("discs are thin (mean |latitude| near the spread) and the Oort cloud is spherical and log-distributed", () => {
  const k = getRegion("kuiper"), a = generateRegionAu(k, 6000, 5);
  let sum = 0, up = 0;
  for (let i = 0; i < 6000; i++) { const lat = Math.asin(a[i * 3 + 2] / norm(a, i)); sum += Math.abs(lat); if (lat > 0) up++; }
  const meanDeg = (sum / 6000) * 180 / Math.PI;
  assert.ok(Math.abs(meanDeg - 6 * Math.sqrt(2 / Math.PI)) < 0.5, `mean |lat| ${meanDeg}`);
  assert.ok(Math.abs(up / 6000 - 0.5) < 0.03);
  const o = getRegion("oort"), b = generateRegionAu(o, 6000, 5);
  let mx = 0, my = 0, mz = 0, small = 0;
  for (let i = 0; i < 6000; i++) { const d = norm(b, i); mx += b[i * 3] / d; my += b[i * 3 + 1] / d; mz += b[i * 3 + 2] / d; if (d < Math.sqrt(5000 * 100000)) small++; }
  for (const m of [mx, my, mz]) assert.ok(Math.abs(m / 6000) < 0.03, "no preferred direction");
  assert.ok(Math.abs(small / 6000 - 0.5) < 0.03, "half the dots inside the geometric-mean radius (log-uniform)");
  let fullRange = 0; for (let i = 0; i < 6000; i++) if (Math.abs(b[i * 3 + 2]) > 0.5 * norm(b, i)) fullRange++;
  assert.ok(fullRange / 6000 > 0.4, "cloud is a shell, not a disc");
});

test("display radius: identical to the orbit compression up to 100 au, continuous, increasing, log beyond", () => {
  for (const au of [0, 1, 5.2, 39.5, 100]) assert.equal(regionVisualRadius(au), visualOrbitRadius(au));
  assert.ok(Math.abs(regionVisualRadius(LOG_FROM_AU + 1e-9) - regionVisualRadius(LOG_FROM_AU)) < 1e-6);
  let prev = -1; for (const au of [0, 1, 30, 100, 150, 1000, 5000, 100000]) { const v = regionVisualRadius(au); assert.ok(v > prev); prev = v; }
  assert.ok(regionVisualRadius(100000) < 400 && regionVisualRadius(100000) > 300, String(regionVisualRadius(100000)));
  assert.ok(regionVisualRadius(5000) < regionVisualRadius(100000));
  assert.throws(() => regionVisualRadius(-1), RangeError); assert.throws(() => regionVisualRadius(NaN), RangeError);
});

test("scene mapping puts the ecliptic in the XZ plane, north on +Y, and keeps direction", () => {
  const p = regionScenePositions(new Float32Array([100, 0, 0, 0, 100, 0, 0, 0, 100]));
  assert.ok(p[0] > 0 && Math.abs(p[1]) < 1e-6 && Math.abs(p[2]) < 1e-6, "+x au is +x");
  assert.ok(Math.abs(p[3]) < 1e-6 && Math.abs(p[4]) < 1e-6 && p[5] < 0, "+y au is -z");
  assert.ok(p[7] > 0 && Math.abs(p[6]) < 1e-6 && Math.abs(p[8]) < 1e-6, "+z au (north) is +y");
  assert.ok(Math.abs(p[0] - visualOrbitRadius(100)) < 1e-3);
});
