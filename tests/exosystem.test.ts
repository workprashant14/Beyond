import { test } from "node:test";
import assert from "node:assert/strict";
import { AU_MAX, AU_MIN, CENTER, dotRadiusPx, orbitRadiusPx, systemLayout } from "../utils/exoSystem";
import type { Exoplanet } from "../utils/exoplanets";

// SYNTHETIC fixtures (not archive data): only the fields the layout reads.
const P = (n: string, a: number | null, r: number | null): Exoplanet => ({ n, h: "Test star", m: null, y: null, p: null, a, r, ms: null, t: null, ns: null, np: null, d: null, v: null, sp: null, te: null, ra: null, dec: null, c: null });

test("orbit radius grows with au, is log-spaced and clamped to the fixed domain", () => {
  assert.ok(orbitRadiusPx(0.1) < orbitRadiusPx(1) && orbitRadiusPx(1) < orbitRadiusPx(10));
  // equal ratios give equal pixel steps
  assert.ok(Math.abs(orbitRadiusPx(1) - orbitRadiusPx(0.1) - (orbitRadiusPx(10) - orbitRadiusPx(1))) < 1e-9);
  assert.equal(orbitRadiusPx(0.0001), orbitRadiusPx(AU_MIN));
  assert.equal(orbitRadiusPx(5000), orbitRadiusPx(AU_MAX));
});

test("dot size: unknown radius is a fixed small dot, known radius grows but is capped", () => {
  assert.equal(dotRadiusPx(null), 3);
  assert.ok(dotRadiusPx(1) < dotRadiusPx(11));
  assert.ok(dotRadiusPx(1e6) <= 9);
});

test("layout sorts by distance, drops planets with no orbit size into noOrbit, flags clamped and marks the selected one", () => {
  const L = systemLayout([P("c", 1.5, 2), P("b", 0.05, null), P("d", null, 3), P("e", 400, 10)], "c");
  assert.deepEqual(L.placed.map((p) => p.name), ["b", "c", "e"]);
  assert.deepEqual(L.noOrbit, ["d"]);
  assert.equal(L.placed.find((p) => p.name === "e")?.clamped, true);
  assert.equal(L.placed.find((p) => p.name === "c")?.clamped, false);
  assert.equal(L.placed.filter((p) => p.selected).length, 1);
  assert.equal(L.placed.find((p) => p.name === "b")?.sizeKnown, false);
});

test("every dot sits exactly on its orbit ring around the centre", () => {
  const L = systemLayout([P("a", 0.03, 1), P("b", 0.4, 2), P("c", 3, 5), P("d", 20, 11)], "a");
  for (const p of L.placed) assert.ok(Math.abs(Math.hypot(p.x - CENTER, p.y - CENTER) - p.r) < 1e-9);
});

test("zero or negative au counts as no orbit; empty input is safe; Earth's 1 au ring is present", () => {
  const L = systemLayout([P("z", 0, 1), P("n", -1, 1)], "z");
  assert.equal(L.placed.length, 0);
  assert.deepEqual(L.noOrbit, ["z", "n"]);
  assert.equal(systemLayout([], "").placed.length, 0);
  assert.ok(L.refRings.some((r) => r.au === 1 && /Earth/.test(r.label)));
});
