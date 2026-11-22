import test from "node:test";
import assert from "node:assert/strict";
import { DPR_HIGH, DPR_LOW, dprBounds } from "../utils/adaptiveDpr";

// Model of a pixel-bound renderer: fps at pixel ratio d is min(refresh, C / d^2). Same decision rule as drei's PerformanceMonitor:
// decline (HIGH -> LOW) when fps < lower, incline (LOW -> HIGH) when fps >= upper. Returns how many times the resolution changed.
function changes(refresh: number, cost: number, bounds: (r: number) => [number, number]): number {
  let d = DPR_HIGH, n = 0;
  for (let i = 0; i < 40; i++) {
    const fps = Math.round(Math.min(refresh, cost / d ** 2));
    const [lower, upper] = bounds(refresh);
    if (d === DPR_HIGH && fps < lower) { d = DPR_LOW; n++; } else if (d === DPR_LOW && fps >= upper) { d = DPR_HIGH; n++; }
  }
  return n;
}
const drei = (r: number): [number, number] => (r > 100 ? [60, 100] : [40, 60]); // drei 10.7.9 defaults

test("dprBounds keeps drei's lower bound and puts the upper bound 2.25x above it", () => {
  assert.deepEqual(dprBounds(60), [40, 90]);
  assert.deepEqual(dprBounds(75), [40, 90]);
  assert.deepEqual(dprBounds(144), [60, 135]);
});

test("the pixel-ratio change costs 2.25x pixels, which is what the bounds are built on", () => {
  assert.equal((DPR_HIGH / DPR_LOW) ** 2, 2.25);
});

test("drei's default bounds make the resolution pump on a 60 fps machine that manages 37 fps at the high resolution (the observed bug)", () => {
  // cost 60: fps 60 at DPR 1, 26.7 at DPR 1.5
  assert.ok(changes(60, 60, drei) >= 10, "expected continuous flipping with the defaults");
});

test("with dprBounds the resolution changes at most once, for any machine speed and refresh rate", () => {
  for (const refresh of [30, 60, 75, 90, 120, 144, 240]) {
    for (let cost = 10; cost <= 1500; cost += 5) {
      const n = changes(refresh, cost, dprBounds);
      assert.ok(n <= 1, `refresh ${refresh}, cost ${cost}: ${n} changes`);
    }
  }
});

test("a machine that holds the lower bound at the high resolution keeps the high resolution", () => {
  assert.equal(changes(60, 40 * 2.25 + 5, dprBounds), 0); // 40+ fps at 1.5 => never declines
});
