import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLOBE_SHADOW_STRENGTH, RING_SHADOW_STRENGTH, ringCoversPoint, ringCrossingRadius, sphereShadowOnPoint, sunDirection, type V3 } from "../utils/ringShadow";
import { mulberry32 } from "../utils/random";

const R = 1, INNER = 1.3, OUTER = 2.3;
/** Independent oracle: march along the ray toward the Sun in small steps and test the annulus / sphere directly. */
function marchRing(p: V3, C: V3, N: V3): boolean {
  const s = sunDirection(p);
  let prev = (p[0] - C[0]) * N[0] + (p[1] - C[1]) * N[1] + (p[2] - C[2]) * N[2];
  for (let t = 0.002; t < 400; t += 0.002) {
    const q: V3 = [p[0] + s[0] * t, p[1] + s[1] * t, p[2] + s[2] * t];
    const h = (q[0] - C[0]) * N[0] + (q[1] - C[1]) * N[1] + (q[2] - C[2]) * N[2];
    if (prev * h <= 0 && prev !== h) { const rho = Math.hypot(q[0] - C[0], q[1] - C[1], q[2] - C[2]); return rho > INNER && rho < OUTER; }
    prev = h;
    if (t > 12) break;
  }
  return false;
}
function marchSphere(p: V3, C: V3, r: number): boolean {
  const s = sunDirection(p);
  for (let t = 0.002; t < 12; t += 0.002) {
    const q: V3 = [p[0] + s[0] * t, p[1] + s[1] * t, p[2] + s[2] * t];
    if (Math.hypot(q[0] - C[0], q[1] - C[1], q[2] - C[2]) < r) return true;
  }
  return false;
}

const tilt = (deg: number): V3 => { const a = (deg * Math.PI) / 180; return [-Math.sin(a), Math.cos(a), 0]; };

test("ring plane crossing: simple cases", () => {
  const C: V3 = [100, 0, 0], N: V3 = [0, 1, 0];
  // A point just above the plane, 100 units from the Sun, sees the Sun slightly below it: the ray reaches the plane at the Sun's end, ~100 units from C.
  const far = ringCrossingRadius([100, 0.5, 0], C, N)!;
  assert.ok(Math.abs(far - 100) < 0.01, String(far));
  assert.equal(ringCrossingRadius([100, 0, 0], C, N), null, "a point in the plane: ray (almost) parallel, no usable crossing");
  assert.equal(ringCrossingRadius([-3, 0, 0], [0, 0, 0], N), null, "ray parallel to the ring plane");
  // Hand calculation: planet (10,0,0), plane normal tilted 26.73 deg, point (10,-0.5,0): the ray reaches the plane after t = 0.9026 at distance 1.01 from the planet.
  const tilted = ringCrossingRadius([10, -0.5, 0], [10, 0, 0], tilt(26.73))!;
  assert.ok(Math.abs(tilted - 1.01) < 0.01, `tilted plane crossing ${tilted}`);
});

test("ring covers a globe point: analytic result equals the brute-force ray march on 400 random points and 4 tilts", () => {
  const rnd = mulberry32(11);
  let covered = 0, mismatches = 0, n = 0;
  for (const tiltDeg of [5, 26.73, 60, 90]) for (const dist of [9.5, 30]) {
    const C: V3 = [dist, 0, 0], N = tilt(tiltDeg);
    for (let i = 0; i < 100; i++) {
      // random point on the globe surface
      const u = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), q = Math.sqrt(1 - u * u);
      const p: V3 = [C[0] + R * q * Math.cos(a), C[1] + R * u, C[2] + R * q * Math.sin(a)];
      const analytic = ringCoversPoint(p, C, N, INNER, OUTER), oracle = marchRing(p, C, N);
      n++; if (analytic) covered++;
      if (analytic !== oracle) mismatches++;
    }
  }
  assert.equal(mismatches, 0, `${mismatches}/${n} mismatches`);
  assert.ok(covered > 20 && covered < n * 0.8, `non-trivial mix of shadowed and lit points (${covered}/${n})`);
});

test("physical sanity: Sun straight above the ring plane (normal pointing at the Sun) casts no ring shadow on the lit hemisphere", () => {
  const C: V3 = [10, 0, 0], N = sunDirection(C); // normal points at the Sun
  const rnd = mulberry32(5);
  for (let i = 0; i < 300; i++) {
    const u = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), q = Math.sqrt(1 - u * u);
    const off: V3 = [R * q * Math.cos(a), R * u, R * q * Math.sin(a)];
    const lit = off[0] * N[0] + off[1] * N[1] + off[2] * N[2] > 0;
    if (!lit) continue;
    assert.equal(ringCoversPoint([C[0] + off[0], off[1], off[2]], C, N, INNER, OUTER), false);
  }
});

test("globe shadow on the ring: analytic equals brute-force march, ring points behind the planet are shadowed, those beside it are not", () => {
  const C: V3 = [10, 0, 0], rnd = mulberry32(3);
  let inShadow = 0, mismatch = 0;
  for (let i = 0; i < 400; i++) {
    const rho = INNER + rnd() * (OUTER - INNER), a = 2 * Math.PI * rnd();
    const p: V3 = [C[0] + rho * Math.cos(a), C[1] + 0.0, C[2] + rho * Math.sin(a)]; // ring plane y = 0 here (normal +y)
    const analytic = sphereShadowOnPoint(p, C, R) > 0.5, oracle = marchSphere(p, C, R);
    if (analytic) inShadow++;
    // Allow disagreement only inside the 1.5% penumbra band at the sphere's edge.
    if (analytic !== oracle) { const s = sphereShadowOnPoint(p, C, R); if (s <= 0.02 || s >= 0.98) mismatch++; }
  }
  assert.equal(mismatch, 0);
  assert.ok(inShadow > 0 && inShadow < 200, String(inShadow));
  // Far side of the planet from the Sun: shadowed; the near side (between Sun and planet): lit.
  assert.equal(sphereShadowOnPoint([C[0] + 1.5, 0, 0], C, R), 1, "behind the planet, on the line to the Sun");
  assert.equal(sphereShadowOnPoint([C[0] - 1.5, 0, 0], C, R), 0, "in front of the planet");
  assert.equal(sphereShadowOnPoint([C[0] + 1.5, 0, 3], C, R), 0, "well to the side");
});

test("drift guard: the GLSL uses the same constants as the reference functions", () => {
  const sh = readFileSync(new URL("../universe/objects/ringShadowShader.ts", import.meta.url), "utf8");
  for (const piece of ["abs(denom) > 1e-4", "t > 0.0", "rho > uRingInner && rho < uRingOuter", "smoothstep(uGlobeR * 0.985, uGlobeR * 1.015, d)", `1.0 - ${GLOBE_SHADOW_STRENGTH} * shadow`, `1.0 - ${RING_SHADOW_STRENGTH} * sh`]) assert.ok(sh.includes(piece), piece);
});
