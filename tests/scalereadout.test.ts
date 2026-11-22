import { test } from "node:test";
import assert from "node:assert/strict";
import { getSolarBody } from "../data/solarSystem";
import { scaleReadout, formatReadout, KM_PER_AU } from "../universe/objects/scaleReadout";

const earth = getSolarBody("earth")!;

test("Earth: real distance is about 1 au and drawn size is exaggerated", () => {
  const r = scaleReadout(earth, 9000);
  assert.ok(r.realDistanceKm! > 0.98 * KM_PER_AU && r.realDistanceKm! < 1.02 * KM_PER_AU);
  assert.ok(r.drawnDistance! > 20, "compressed orbit radius is in scene units");
  const trueRadius = (r.drawnDistance! * 6371) / r.realDistanceKm!;
  assert.ok(Math.abs(r.radiusExaggeration! - r.drawnRadius / trueRadius) < 1e-9, "exaggeration = drawn radius / radius at true scale");
  assert.ok(r.radiusExaggeration! > 100, "Earth is drawn far larger than true scale");
  assert.equal(r.realRadiusKm, 6371);
});

test("Moon reads from its parent and Sun has no distance (never invented)", () => {
  const moon = getSolarBody("moon")!;
  const r = scaleReadout(moon, 0);
  assert.equal(r.from, "earth");
  assert.ok(r.realDistanceKm! > 350_000 && r.realDistanceKm! < 410_000);
  const sun = scaleReadout(getSolarBody("sun")!, 0);
  assert.equal(sun.realDistanceKm, null);
  assert.equal(sun.radiusExaggeration, null);
  assert.match(formatReadout(getSolarBody("sun")!, sun), /Data unavailable/);
  assert.match(formatReadout(earth, scaleReadout(earth, 0)), /larger than true scale/);
  assert.match(formatReadout(earth, scaleReadout(earth, 0)), /orbital speed 2\d\.\d\d km\/s|orbital speed 30\.\d\d km\/s/);
  assert.ok(sun.barycentreOffsetKm! > 0 && sun.barycentreOffsetKm! < 2.3 * 695_700);
  assert.match(formatReadout(getSolarBody("sun")!, sun), /Sun radii\) from the Solar System barycentre/);
  assert.equal(scaleReadout(moon, 0).speedKmS, null, "no moon state vectors yet");
});
