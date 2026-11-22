import { test } from "node:test";
import assert from "node:assert/strict";
import { TAIL_ACTIVE_AU, TAIL_MAX_UNITS, antiSunward, selectTails, tailLengthUnits } from "../utils/cometTail";

test("tail length: longest at the Sun, shrinking as the comet moves away (NASA: longer closer to the Sun), none beyond the display limit", () => {
  assert.equal(tailLengthUnits(0), TAIL_MAX_UNITS);
  let prev = Infinity;
  for (const r of [0, 0.1, 0.5, 1, 2, 2.9]) { const l = tailLengthUnits(r); assert.ok(l > 0 && l < prev + 1e-12, `r=${r}`); prev = l; }
  assert.equal(tailLengthUnits(TAIL_ACTIVE_AU), 0);
  assert.equal(tailLengthUnits(10), 0);
  for (const bad of [NaN, -1, Infinity, -Infinity]) assert.equal(tailLengthUnits(bad), 0, String(bad));
});

test("tail direction is exactly away from the Sun, whatever the comet's position or motion", () => {
  assert.deepEqual(antiSunward([3, 0, 0]), [1, 0, 0]);
  const d = antiSunward([-1, 2, 2])!;
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12);
  assert.ok(Math.abs(d[0] * 3 - -1) < 1e-12 && Math.abs(d[1] * 3 - 2) < 1e-12, "parallel to the position vector (|p| = 3)");
  assert.equal(antiSunward([0, 0, 0]), null);
  assert.equal(antiSunward([NaN, 0, 0]), null);
});

test("selection: eligible only, preferred first, then nearest to the Sun, capped, deterministic", () => {
  const items = [{ index: 0, rAu: 5 }, { index: 1, rAu: 2 }, { index: 2, rAu: 0.5 }, { index: 3, rAu: 2 }, { index: 4, rAu: 2.9 }, { index: 5, rAu: NaN }];
  assert.deepEqual(selectTails(items, 10), [2, 1, 3, 4]);
  assert.deepEqual(selectTails(items, 2), [2, 1]);
  assert.deepEqual(selectTails(items, 10, 4), [4, 2, 1, 3], "selected comet first");
  assert.deepEqual(selectTails(items, 10, 0), [2, 1, 3, 4], "a selected comet that is too far gets no tail");
  assert.deepEqual(selectTails(items, 0), []);
  assert.deepEqual(selectTails([], 5), []);
});
