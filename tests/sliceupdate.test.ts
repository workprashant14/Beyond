import { test } from "node:test";
import assert from "node:assert/strict";
import { BATCH, newSliceState, stepSlice } from "../utils/sliceUpdate";

const make = (total: number) => {
  const seen = new Array<number>(total).fill(0), at = new Array<number>(total).fill(NaN);
  return { seen, at, update: (i: number, d: number) => { seen[i]++; at[i] = d; } };
};

test("with an ample budget one call evaluates everything once, settles, and then costs nothing", () => {
  const { seen, update } = make(1000), st = newSliceState();
  assert.equal(stepSlice(st, 1000, 5, 1e9, () => 0, update), 1000);
  assert.ok(seen.every((c) => c === 1));
  assert.equal(stepSlice(st, 1000, 5, 1e9, () => 0, update), 0, "settled for the same clock value");
  assert.ok(seen.every((c) => c === 1));
  assert.equal(stepSlice(st, 1000, 6, 1e9, () => 0, update), 1000, "a new clock value triggers a new cycle");
});

test("with a tiny budget it still makes progress, covers every item exactly once per cycle, in order, and finishes", () => {
  const total = BATCH * 4 + 17, { seen, at, update } = make(total), st = newSliceState();
  let t = 0;
  const now = () => (t += 10); // every batch "costs" more than the budget
  let calls = 0;
  while (st.settledDays !== 7 && calls < 100) { stepSlice(st, total, 7, 1, now, update); calls++; }
  assert.equal(st.settledDays, 7);
  assert.ok(seen.every((c) => c === 1), "each item evaluated exactly once");
  assert.ok(at.every((d) => d === 7));
  assert.equal(calls, 5, "one batch per call -> ceil(total / BATCH) calls");
});

test("when the clock moves during a cycle, the cycle repeats instead of claiming to be settled", () => {
  const total = BATCH * 3, { at, update } = make(total), st = newSliceState();
  let t = 0; const now = () => (t += 10);
  stepSlice(st, total, 1, 1, now, update);        // batch 1 at day 1
  stepSlice(st, total, 2, 1, now, update);        // batch 2 at day 2 (clock moved)
  stepSlice(st, total, 2, 1, now, update);        // batch 3 at day 2 -> wraps, cycleDays(1) != 2
  assert.ok(Number.isNaN(st.settledDays));
  assert.deepEqual([at[0], at[BATCH], at[BATCH * 2]], [1, 2, 2]);
  for (let k = 0; k < 3; k++) stepSlice(st, total, 2, 1, now, update);
  assert.equal(st.settledDays, 2);
  assert.ok(at.every((d) => d === 2));
});

test("empty set and a changing item count are safe", () => {
  const st = newSliceState();
  assert.equal(stepSlice(st, 0, 1, 5, () => 0, () => { throw new Error("no items"); }), 0);
  const { update } = make(10);
  stepSlice(st, 10, 1, 1e9, () => 0, update);
  assert.equal(st.settledDays, 1);
});
