import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PC_LY, absoluteMagnitude, visualLuminosity, formatLuminosity, distanceClass, distanceSourceLabel, type StarPhysFile } from "../utils/starPhys";

const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const phys = JSON.parse(readFileSync("public/sky/starphys.json", "utf8")) as StarPhysFile;
const stars = JSON.parse(readFileSync("public/sky/stars.json", "utf8")) as { hip: number[]; mag: number[] };

test("Sirius: absolute magnitude and visible luminosity match textbook values", () => {
  const M = absoluteMagnitude(-1.46, 2.637);
  near(M, 1.45, 0.05, "absMag");
  const L = visualLuminosity(M);
  assert.ok(L > 20 && L < 27, `L=${L}`);
});

test("Sun at 10 pc reference: M = m, L = 1", () => {
  near(absoluteMagnitude(4.83, 10), 4.83, 1e-9);
  near(visualLuminosity(4.83), 1, 1e-9);
});

test("parsec to light-year constant", () => near(PC_LY, 3.2616, 1e-3));

test("distance class depends on source and distance", () => {
  assert.equal(distanceClass(null, "H"), null);
  assert.equal(distanceClass(50, ""), null);
  assert.equal(distanceClass(150, "H"), "observed");
  assert.equal(distanceClass(500, "H"), "estimated");
  assert.equal(distanceClass(1500, "H"), null);
  assert.equal(distanceClass(800, "G3"), "observed");
  assert.equal(distanceClass(1955, "G3"), "estimated");
  assert.equal(distanceClass(4000, "G3"), null);
});

test("source labels", () => {
  assert.equal(distanceSourceLabel("G3"), "Gaia DR3");
  assert.equal(distanceSourceLabel("H"), "Hipparcos");
  assert.equal(distanceSourceLabel("zz"), "an unknown source");
});

test("formatLuminosity returns a string", () => assert.match(formatLuminosity(23), /\d/));

test("starphys.json is aligned with stars.json and well-formed", () => {
  assert.equal(phys.n, stars.hip.length);
  for (const k of ["hip", "d", "ds", "sp", "ss"] as const) assert.equal(phys[k].length, phys.n, k);
  assert.deepEqual(phys.hip, stars.hip);
  for (let i = 0; i < phys.n; i++) {
    const d = phys.d[i];
    if (d !== null) assert.ok(d > 0 && d < 100000, `d[${i}]=${d}`);
    if (d !== null) assert.notEqual(phys.ds[i], "", `distance without source at ${i}`);
  }
});

test("known stars: Sirius, Polaris-like sanity and a Gaia-sourced distant star", () => {
  const sirius = stars.hip.indexOf(32349);
  near(phys.d[sirius]!, 2.64, 0.02);
  const far = stars.hip.indexOf(3504);
  assert.equal(phys.ds[far], "G3");
});
