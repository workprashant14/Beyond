import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPHERE_SQ_DEG, areaRank, constellationAreaSqDeg, formatArea, ringAreaSqDeg } from "../utils/constellationArea";

const cons = JSON.parse(readFileSync(new URL("../public/sky/constellations.json", import.meta.url), "utf8")) as { id: string; bounds: [number, number][][] }[];
const pub = JSON.parse(readFileSync(new URL("../public/sky/constellation-areas.json", import.meta.url), "utf8")) as { areas: Record<string, number> };

test("polygon area maths: known shapes", () => {
  // An octant of the sphere (RA 0 to 90, Dec 0 to 90) is 1/8 of the sphere.
  assert.ok(Math.abs(ringAreaSqDeg([[0, 0], [90, 0], [0, 90]]) - SPHERE_SQ_DEG / 8) < 1e-6);
  assert.ok(Math.abs(ringAreaSqDeg([[0, 0], [90, 0], [0, 90], [0, 0]]) - SPHERE_SQ_DEG / 8) < 1e-6, "closing vertex repeated");
  // Orientation does not matter, rotation of the start vertex does not matter.
  assert.ok(Math.abs(ringAreaSqDeg([[0, 90], [90, 0], [0, 0]]) - SPHERE_SQ_DEG / 8) < 1e-6);
  assert.ok(Math.abs(ringAreaSqDeg([[90, 0], [0, 90], [0, 0]]) - SPHERE_SQ_DEG / 8) < 1e-6);
  // A 1 deg x 1 deg patch at the equator is about 1 square degree.
  assert.ok(Math.abs(ringAreaSqDeg([[10, 0], [11, 0], [11, 1], [10, 1]]) - 1) < 1e-3);
  assert.equal(ringAreaSqDeg([[0, 0], [1, 1]]), 0);
  assert.equal(ringAreaSqDeg([]), 0);
});

test("the 88 bundled boundaries tile the whole sphere exactly (independent of any published table)", () => {
  assert.equal(cons.length, 88);
  const sum = cons.reduce((s, c) => s + constellationAreaSqDeg(c.bounds), 0);
  assert.ok(Math.abs(sum - SPHERE_SQ_DEG) < 0.01, `sum ${sum} vs ${SPHERE_SQ_DEG}`);
});

test("published table: same 88 ids, sums to the sphere within rounding, and Serpens has two boundary rings", () => {
  assert.deepEqual(Object.keys(pub.areas).sort(), cons.map((c) => c.id).sort());
  const sum = Object.values(pub.areas).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - SPHERE_SQ_DEG) < 0.05, `published sum ${sum}`);
  assert.equal(cons.filter((c) => c.bounds.length > 1).map((c) => c.id).join(), "Ser");
});

test("computed areas agree with the published table: median error under 1%, all under 15%, worst cases are polar (great-circle edges vs constant-Dec edges)", () => {
  const errs = cons.map((c) => ({ id: c.id, e: (constellationAreaSqDeg(c.bounds) - pub.areas[c.id]) / pub.areas[c.id] }));
  const abs = errs.map((x) => Math.abs(x.e)).sort((a, b) => a - b);
  assert.ok(abs[44] < 0.01, `median ${abs[44]}`);
  assert.ok(abs[87] < 0.15, `worst ${abs[87]}`);
  const worst = errs.sort((a, b) => Math.abs(b.e) - Math.abs(a.e))[0];
  assert.equal(worst.id, "Oct", "the south-polar constellation Octans is the worst case (about -14.5%)");
  // Ranking: the three largest and three smallest agree between the two methods.
  const byPub = Object.entries(pub.areas).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const byCalc = cons.map((c) => [c.id, constellationAreaSqDeg(c.bounds)] as const).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  assert.deepEqual(byCalc.slice(0, 3), byPub.slice(0, 3));
  assert.deepEqual(byCalc.slice(-3), byPub.slice(-3));
  assert.deepEqual(byPub.slice(0, 3), ["Hya", "Vir", "UMa"]);
  assert.deepEqual(byPub.slice(-3), ["Sge", "Equ", "Cru"]);
});

test("rank and formatting", () => {
  assert.deepEqual(areaRank(pub.areas, "Hya"), { rank: 1, of: 88 });
  assert.deepEqual(areaRank(pub.areas, "Cru"), { rank: 88, of: 88 });
  assert.equal(areaRank(pub.areas, "XXX"), null);
  assert.deepEqual(areaRank({ a: 5, b: 5, c: 1 }, "b"), { rank: 1, of: 3 }, "ties share the better rank");
  assert.equal(formatArea(pub.areas.Hya), "1,302.8 square degrees (3.16% of the sky)");
});
