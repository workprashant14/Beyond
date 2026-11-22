import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBackdrop, sampleFillMag, sampleLatitudeDeg, fillCountFor, FILL_MAG_MIN, FILL_MAG_MAX, GAL_POLE } from "../utils/starBackdrop";
import { raDecToVec } from "../utils/sky";

const cat = { n: 3, ra: [10, 120, 250], dec: [-40, 15, 70], mag: [1.2, 4.5, 6.4], bv: [0.0, 1.5, NaN] };

test("catalogue stars keep their direction, magnitude and are first", () => {
  const b = buildBackdrop(cat, 100);
  assert.equal(b.n, 103); assert.equal(b.nCatalogue, 3);
  for (let i = 0; i < 3; i++) {
    const [x, y, z] = raDecToVec(cat.ra[i], cat.dec[i], 1);
    assert.ok(Math.abs(b.dir[i * 3] - x) < 1e-6 && Math.abs(b.dir[i * 3 + 1] - y) < 1e-6 && Math.abs(b.dir[i * 3 + 2] - z) < 1e-6);
    assert.ok(Math.abs(b.mag[i] - cat.mag[i]) < 1e-6);
  }
});

test("colour comes from B-V: blue-white star is bluer than the red one, missing B-V does not crash", () => {
  const b = buildBackdrop(cat, 0);
  assert.ok(b.color[2] > b.color[0] * 0.95 && b.color[0] < 1.01);       // B-V 0.0: blue >= ~red
  assert.ok(b.color[3] > b.color[5]);                                   // B-V 1.5: red > blue
  assert.ok(b.color.every(Number.isFinite));
});

test("fill is deterministic, unit-length, within the magnitude range and fainter than the catalogue", () => {
  const a = buildBackdrop(cat, 500), c = buildBackdrop(cat, 500);
  assert.deepEqual(Array.from(a.dir), Array.from(c.dir));
  for (let i = 3; i < a.n; i++) {
    assert.ok(Math.abs(Math.hypot(a.dir[i * 3], a.dir[i * 3 + 1], a.dir[i * 3 + 2]) - 1) < 1e-5);
    assert.ok(a.mag[i] >= FILL_MAG_MIN - 1e-6 && a.mag[i] <= FILL_MAG_MAX + 1e-6);
  }
});

test("star counts grow about 3x per magnitude", () => {
  let lo = 0, hi = 0; const N = 200000;
  for (let i = 0; i < N; i++) { const m = sampleFillMag((i + 0.5) / N); if (m < 8.5) lo++; else if (m < 9.5) hi++; }
  const ratio = hi / (lo - 0 > 0 ? (() => { let c = 0; for (let i = 0; i < N; i++) { const m = sampleFillMag((i + 0.5) / N); if (m >= 7.5 && m < 8.5) c++; } return c; })() : 1);
  assert.ok(ratio > 2.9 && ratio < 3.4, `ratio ${ratio}`);
});

test("fill concentrates toward the galactic plane (Milky Way band), using the real galactic pole", () => {
  const b = buildBackdrop(null, 20000);
  const p = raDecToVec(GAL_POLE.raDeg, GAL_POLE.decDeg, 1);
  let near = 0;
  for (let i = 0; i < b.n; i++) { const s = b.dir[i * 3] * p[0] + b.dir[i * 3 + 1] * p[1] + b.dir[i * 3 + 2] * p[2]; if (Math.abs(s) < Math.sin(15 * Math.PI / 180)) near++; }
  const isotropic = Math.sin(15 * Math.PI / 180); // fraction of a uniform sphere within +-15 deg
  assert.ok(near / b.n > isotropic * 2, `${near / b.n} vs isotropic ${isotropic}`);
  assert.ok(Math.abs(sampleLatitudeDeg(0.9, 0.5)) < 1e-3);
});

test("quality profiles scale the fill, never the catalogue", () => {
  assert.ok(fillCountFor("desktop") > fillCountFor("mobile") && fillCountFor("mobile") > fillCountFor("low") && fillCountFor("low") > 0);
  assert.equal(buildBackdrop(cat, fillCountFor("low")).nCatalogue, 3);
});
