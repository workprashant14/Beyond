import { test } from "node:test";
import assert from "node:assert/strict";
import { TOURS, getTour } from "../data/tours";
import { getObject } from "../services/catalogue";
import { getSceneObject } from "../universe/objects/sceneConfig";
import { isSolarId } from "../data/solarSystem";

test("every tour stop is a real catalogue object that exists in the 3D scene", () => {
  for (const t of TOURS) {
    assert.ok(t.steps.length >= 3, t.id);
    for (const s of t.steps) {
      assert.ok(getObject(s.id), `${t.id}: ${s.id} not in catalogue`);
      assert.ok(isSolarId(s.id) || getSceneObject(s.id), `${t.id}: ${s.id} has no 3D scene`);
    }
  }
});

test("tour ids are unique, stops are not repeated, lookup works", () => {
  assert.equal(new Set(TOURS.map((t) => t.id)).size, TOURS.length);
  for (const t of TOURS) assert.equal(new Set(t.steps.map((s) => s.id)).size, t.steps.length, t.id);
  assert.equal(getTour("black-holes")?.id, "black-holes");
  assert.equal(getTour("nope"), undefined);
});

test("tour text states no numbers (measured values must come from the catalogue panel)", () => {
  for (const t of TOURS) for (const s of t.steps) assert.ok(!/\d/.test(s.look), `${t.id}/${s.id}: "${s.look}"`);
});
