import { test } from "node:test";
import assert from "node:assert/strict";
import { smallBodyPosition, type SmallBody } from "../utils/smallBodies";
import { toScene } from "../universe/objects/smallBodyScene";
import { buildPropagator } from "../utils/smallBodyFast";
import { BATCH, newSliceState, stepSlice } from "../utils/sliceUpdate";

const mk = (k: number): SmallBody => ({ id: "S" + k, n: "x", k: k % 7 === 0 ? "c" : "a", a: k % 11 === 0 ? -3 - (k % 5) : 1.2 + (k % 60) / 9, e: k % 11 === 0 ? 1.1 + (k % 9) / 10 : 0.02 + (k % 90) / 100, i: (k * 3) % 170, om: (k * 17) % 360, w: (k * 29) % 360, ma: (k * 13) % 360, ep: 2459000.5 + k, per: k % 11 === 0 ? null : 365.25636 * (1.2 + (k % 60) / 9) ** 1.5, H: 10, d: null } as unknown as SmallBody);

test("fast propagator equals smallBodyPosition + toScene (closed and open orbits, several dates)", () => {
  const bodies = Array.from({ length: 400 }, (_, k) => mk(k));
  const f = buildPropagator(bodies, toScene);
  for (const days of [-30000, -1, 0, 4321.5, 9000]) {
    const a = new Float32Array(bodies.length * 3), b = new Float32Array(bodies.length * 3);
    bodies.forEach((bd, i) => { f.write(a, i, days); toScene(bd, smallBodyPosition(bd, days), b, i * 3); });
    for (let j = 0; j < a.length; j++) assert.ok(Math.abs(a[j] - b[j]) <= 1e-4 * Math.max(1, Math.abs(b[j])) * 1e-2, `component ${j} at ${days}: ${a[j]} vs ${b[j]}`);
  }
});

test("a running clock never evaluates an item twice in one call (one pass per frame at most)", () => {
  const total = BATCH * 4, seen = new Array(total).fill(0), st = newSliceState();
  let d = 1;
  for (let frame = 0; frame < 20; frame++) {
    seen.fill(0);
    stepSlice(st, total, d++, 1e9, () => 0, (i) => { seen[i]++; });
    assert.ok(seen.every((c) => c <= 1), `frame ${frame}`);
  }
});

test("warm-started solve stays equal to the reference over many consecutive frames, including across the 2 pi wrap and at high e", () => {
  const bodies = [0, 1, 2, 3].map((n) => ({ ...mk(n + 1), e: [0.02, 0.6, 0.9, 0.99][n], a: 2.5, per: 365.25636 * 2.5 ** 1.5 }) as SmallBody);
  const f = buildPropagator(bodies, toScene);
  const a = new Float32Array(12), b = new Float32Array(12);
  let worst = 0;
  for (let frame = 0; frame < 3000; frame++) {
    const days = -2000 + frame * 17.3; // 100x-style big steps, many wraps
    bodies.forEach((bd, i) => { f.write(a, i, days); toScene(bd, smallBodyPosition(bd, days), b, i * 3); });
    for (let j = 0; j < 12; j++) worst = Math.max(worst, Math.abs(a[j] - b[j]) / Math.max(1, Math.abs(b[j])));
  }
  assert.ok(worst < 1e-6, `worst relative difference ${worst}`);
});

import { solveKepler } from "../utils/kepler";
test("solveKepler satisfies Kepler's equation for high eccentricities (regression: plain Newton from pi did not converge for e >= 0.8)", () => {
  const T = 2 * Math.PI;
  for (const e of [0, 0.3, 0.8, 0.9, 0.99, 0.9999]) {
    for (let k = 0; k < 20000; k++) {
      const M = -30 + k * 0.0137, m = ((M + Math.PI) % T + T) % T - Math.PI, E = solveKepler(M, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - m) < 1e-9, `e=${e} M=${M}`);
    }
  }
});

test("warm start survives date jumps, backward time and e near 1 (falls back to the robust solver) and stays equal to the reference", () => {
  const bodies = [0.05, 0.5, 0.9, 0.97, 0.995].map((e, n) => ({ ...mk(n + 20), e, a: 3, per: 365.25636 * 3 ** 1.5 }) as SmallBody);
  const f = buildPropagator(bodies, toScene);
  const a = new Float32Array(15), b = new Float32Array(15);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let days = 0, worst = 0;
  for (let step = 0; step < 4000; step++) {
    const r = rnd();
    days += r < 0.05 ? (rnd() - 0.5) * 60000 /* jump within the 1800-2050 window */ : r < 0.5 ? -rnd() * 40 /* backwards */ : rnd() * 40;
    days = Math.max(-72000, Math.min(18000, days));
    bodies.forEach((bd, i) => { f.write(a, i, days); toScene(bd, smallBodyPosition(bd, days), b, i * 3); });
    for (let j = 0; j < 15; j++) worst = Math.max(worst, Math.abs(a[j] - b[j]) / Math.max(1, Math.abs(b[j])));
  }
  assert.ok(worst < 1e-6, `worst relative difference ${worst}`);
});

import { changedRun } from "../utils/sliceUpdate";
test("changedRun: the uploaded run is exactly what stepSlice evaluated, over many frames and a cycle wrap", () => {
  const total = BATCH * 5 + 17, st = newSliceState(), touched = new Uint8Array(total);
  let days = 1;
  for (let frame = 0; frame < 60; frame++) {
    const from = st.cursor, seen: number[] = [];
    const n = stepSlice(st, total, days++, 1e9, () => 0 /* time never runs out: whole pass */, (i) => { seen.push(i); });
    const run = changedRun(from, n, total);
    assert.ok(run, `frame ${frame}`);
    assert.deepEqual(seen, Array.from({ length: n }, (_, k) => run.start + k), `frame ${frame}: run is contiguous from the cursor`);
    seen.forEach((i) => { touched[i] = 1; });
  }
  assert.ok(touched.every((v) => v === 1));
  assert.equal(changedRun(0, 0, 10), null);
  assert.equal(changedRun(8, 5, 10), null);
});
test("changedRun with a short budget: successive runs tile the item list with no gap and no overlap", () => {
  const total = BATCH * 6, st = newSliceState();
  let t = 0, expectedFrom = 0;
  for (let frame = 0; frame < 24; frame++) {
    const from = st.cursor, n = stepSlice(st, total, 5, 1 /* ms */, () => (t += 0.6), () => {});
    if (n === 0) break;
    const run = changedRun(from, n, total)!;
    assert.equal(run.start, expectedFrom % total);
    expectedFrom = (run.start + run.count) % total;
  }
});

// ---- Trig-free incremental path (second-stage performance work) -------------------------------------------------------------------------

import { readFileSync } from "node:fs";
const relErr = (a: Float32Array, b: Float32Array) => { let w = 0; for (let j = 0; j < a.length; j++) w = Math.max(w, Math.abs(a[j] - b[j]) / Math.max(1, Math.abs(b[j]))); return w; };

test("trig-free path: no drift over 30,000 consecutive 100x-sized frames, e from 0 to 0.995, and it is really the path being used", () => {
  const es = [0, 0.1, 0.3, 0.6, 0.9, 0.98, 0.995];
  const bodies = es.map((e, n) => ({ ...mk(n + 40), e, a: 2.6, per: 365.25636 * 2.6 ** 1.5 }) as SmallBody);
  const f = buildPropagator(bodies, toScene);
  const a = new Float32Array(es.length * 3), b = new Float32Array(es.length * 3);
  let worst = 0, days = -20000;
  for (let frame = 0; frame < 30000; frame++) {
    days += 0.4 + (frame % 5) * 0.4; // 0.4 .. 2.0 days per frame (100x at 20-100 fps)
    bodies.forEach((_, i) => f.write(a, i, days));
    if (frame % 97 === 0 || frame > 29990) { // the reference is slow: check every 97th frame and the last ten
      bodies.forEach((bd, i) => toScene(bd, smallBodyPosition(bd, days), b, i * 3));
      worst = Math.max(worst, relErr(a, b));
    }
  }
  assert.ok(worst < 5e-7, `worst relative difference ${worst}`); // float32 output: one ulp is about 6e-8
  const c = f.counters;
  assert.ok(c.trigFree > 0.8 * c.evals, `trig-free path used for ${c.trigFree} of ${c.evals} evaluations`);
  assert.equal(c.fallbacks, es.length, "only the first (cold) evaluation of each body uses the reference solver");
});

test("trig-free path: backward time in small steps, then forward, then a 40-year jump both ways, all equal to the reference", () => {
  const bodies = [0.2, 0.7, 0.95, 0.995].map((e, n) => ({ ...mk(n + 60), e, a: 3.1, per: 365.25636 * 3.1 ** 1.5 }) as SmallBody);
  const f = buildPropagator(bodies, toScene);
  const a = new Float32Array(12), b = new Float32Array(12);
  const days: number[] = [];
  let d = 5000;
  for (let i = 0; i < 4000; i++) days.push((d -= 1.7));       // backwards
  for (let i = 0; i < 4000; i++) days.push((d += 2.1));       // forwards
  days.push((d += 14600), (d -= 29200), (d += 14600.5));      // +40 y, -80 y, +40 y
  for (let i = 0; i < 500; i++) days.push((d += 2.1));
  let worst = 0;
  days.forEach((dd, k) => {
    bodies.forEach((_, i) => f.write(a, i, dd));
    if (k % 41 === 0 || k >= days.length - 3 || k >= 8000 && k < 8004) { bodies.forEach((bd, i) => toScene(bd, smallBodyPosition(bd, dd), b, i * 3)); worst = Math.max(worst, relErr(a, b)); }
  });
  assert.ok(worst < 5e-7, `worst relative difference ${worst}`);
});

test("real shipped small-body data: every body (closed and open orbits) equals the reference over 100x frames, a reverse run and a date jump", (t) => {
  const file = JSON.parse(readFileSync(new URL("../public/smallbodies/bodies.json", import.meta.url), "utf8")) as { bodies: SmallBody[] };
  const bodies = file.bodies;
  // The repository ships an empty placeholder until the JPL data build has been run; no elements are invented here. The test runs as soon as real data is built.
  if (bodies.length === 0) { t.skip("public/smallbodies/bodies.json has 0 bodies (JPL data not built in this checkout)"); return; }
  assert.ok(bodies.length > 100, `shipped file has ${bodies.length} bodies`);
  const f = buildPropagator(bodies, toScene);
  const a = new Float32Array(bodies.length * 3), b = new Float32Array(bodies.length * 3);
  const seq: number[] = [];
  let d = 9000;
  for (let i = 0; i < 400; i++) seq.push((d += 2.1));   // forward at 100x
  for (let i = 0; i < 200; i++) seq.push((d -= 2.1));   // reverse
  seq.push((d += 36525));                                // +100 y jump
  for (let i = 0; i < 100; i++) seq.push((d += 2.1));
  let worst = 0;
  seq.forEach((dd, k) => {
    bodies.forEach((_, i) => f.write(a, i, dd));
    if (k % 50 === 0 || k === seq.length - 1) {
      bodies.forEach((bd, i) => toScene(bd, smallBodyPosition(bd, dd), b, i * 3));
      worst = Math.max(worst, relErr(a, b));
    }
  });
  assert.ok(worst < 5e-7, `worst relative difference over ${bodies.length} shipped bodies: ${worst}`);
});

test("buffer update correctness: copying only the evaluated runs reproduces a full re-evaluation (as the GPU upload does)", () => {
  const bodies = Array.from({ length: 2500 }, (_, k) => mk(k + 100));
  const f = buildPropagator(bodies, toScene), st = newSliceState();
  const cpu = new Float32Array(bodies.length * 3), gpu = new Float32Array(bodies.length * 3), want = new Float32Array(bodies.length * 3);
  let clock = 0, t = 0;
  for (let frame = 0; frame < 120; frame++) {
    clock += 2.1;
    const from = st.cursor;
    // tiny fake time budget (one batch per tick) so each frame evaluates only a part of the bodies: several frames per cycle
    const n = stepSlice(st, bodies.length, clock, 0.5, () => (t += 1), (i, dd) => f.write(cpu, i, dd));
    const run = changedRun(from, n, bodies.length);
    if (run) gpu.set(cpu.subarray(run.start * 3, (run.start + run.count) * 3), run.start * 3); // what updateRanges uploads
  }
  // let the clock stop: the layer settles, then the uploaded copy must equal the evaluated buffer and the reference at that date
  for (let frame = 0; frame < 40; frame++) {
    const from = st.cursor;
    const n = stepSlice(st, bodies.length, clock, 0.5, () => (t += 1), (i, dd) => f.write(cpu, i, dd));
    const run = changedRun(from, n, bodies.length);
    if (run) gpu.set(cpu.subarray(run.start * 3, (run.start + run.count) * 3), run.start * 3);
  }
  assert.equal(st.settledDays, clock, "settled at the final clock value");
  assert.deepEqual(Array.from(gpu), Array.from(cpu), "uploaded copy equals the CPU buffer");
  bodies.forEach((bd, i) => toScene(bd, smallBodyPosition(bd, clock), want, i * 3));
  assert.ok(relErr(gpu, want) < 5e-7, `final positions vs reference ${relErr(gpu, want)}`);
});

test("update-rate cap: with maxItems = ceil(total/2) an item is never more than 2 frames old, a call never exceeds the cap, and the layer still settles", () => {
  const total = 2000, cap = Math.ceil(total / 2), st = newSliceState(), last = new Int32Array(total).fill(-1);
  let days = 0, worstAge = 0, worstCall = 0;
  for (let frame = 0; frame < 300; frame++) {
    days += 2.1;
    const n = stepSlice(st, total, days, 1e9, () => 0, (i) => { last[i] = frame; }, cap);
    worstCall = Math.max(worstCall, n);
    if (frame >= 3) for (let i = 0; i < total; i++) worstAge = Math.max(worstAge, frame - last[i]);
  }
  assert.ok(worstCall <= cap, `a call evaluated ${worstCall} > cap ${cap}`);
  assert.ok(worstAge <= 2, `an item was ${worstAge} frames old`); // age 0 or 1 in practice; 2 is the contract
  // the clock stops: every item must end up evaluated at the final clock value and the layer settles
  const seenAtFinal = new Uint8Array(total);
  for (let frame = 0; frame < 6; frame++) stepSlice(st, total, days, 1e9, () => 0, (i, d) => { if (d === days) seenAtFinal[i] = 1; }, cap);
  assert.equal(st.settledDays, days);
  assert.ok(seenAtFinal.every((v) => v === 1), "every item evaluated at the final clock value");
  // a date jump mid-cycle also reaches every item
  const jumped = new Uint8Array(total), target = days + 36525;
  for (let frame = 0; frame < 6; frame++) stepSlice(st, total, target, 1e9, () => 0, (i, d) => { if (d === target) jumped[i] = 1; }, cap);
  assert.ok(jumped.every((v) => v === 1) && st.settledDays === target);
});
