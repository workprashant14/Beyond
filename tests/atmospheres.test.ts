import { test } from "node:test";
import assert from "node:assert/strict";
import { ATMOSPHERES, glowIntensity } from "../data/atmospheres";
import { SOLAR_BODIES, getSolarBody } from "../data/solarSystem";

test("only bodies with a substantial atmosphere get a glow; Mercury, the Sun, the Moon and the other moons do not", () => {
  assert.deepEqual(Object.keys(ATMOSPHERES).sort(), ["earth", "jupiter", "mars", "neptune", "saturn", "titan", "uranus", "venus"]);
  for (const id of Object.keys(ATMOSPHERES)) assert.ok(getSolarBody(id), id);
  for (const id of ["sun", "mercury", "moon", "io", "europa", "ganymede", "callisto"]) assert.equal(ATMOSPHERES[id], undefined, id);
  assert.ok(SOLAR_BODIES.filter((b) => b.id in ATMOSPHERES).length === 8);
});

test("looks are valid: hex colours, small positive thickness, strength in (0,1]", () => {
  for (const [id, a] of Object.entries(ATMOSPHERES)) {
    assert.match(a.color, /^#[0-9a-f]{6}$/i, id);
    assert.ok(a.thickness > 0 && a.thickness <= 0.12, id);
    assert.ok(a.strength > 0 && a.strength <= 1, id);
  }
  assert.ok(ATMOSPHERES.mars.strength < ATMOSPHERES.earth.strength, "thin Mars is dimmer than Earth (visual cue only)");
});

test("glow formula: brightest at the limb, zero face-on, dimmer on the night side, never negative or above strength", () => {
  const s = 0.9;
  assert.equal(glowIntensity(1, 1, s), 0, "face-on shows nothing");
  assert.equal(glowIntensity(-1, 1, s), 0);
  assert.ok(glowIntensity(0, 1, s) > glowIntensity(0.4, 1, s), "limb brighter than inside");
  assert.ok(Math.abs(glowIntensity(0, 1, s) - s) < 1e-9, "full strength at the lit limb");
  assert.ok(glowIntensity(0, -1, s) < glowIntensity(0, 1, s) * 0.2, "night limb is dim");
  assert.ok(glowIntensity(0, -1, s) > 0, "but not invisible");
  for (let c = -1; c <= 1; c += 0.1) for (let q = -1; q <= 1; q += 0.1) { const g = glowIntensity(c, q, s); assert.ok(g >= 0 && g <= s + 1e-12); }
  assert.equal(glowIntensity(0, 1, 0), 0);
});

import { readFileSync } from "node:fs";
test("drift guard: the GLSL in AtmosphereGlow.tsx uses the same constants as glowIntensity()", () => {
  const glsl = readFileSync(new URL("../universe/objects/AtmosphereGlow.tsx", import.meta.url), "utf8");
  for (const piece of ["0.75 - abs(cosView)) / 0.75, 3.0", "0.15 + 0.85 * smoothstep(-0.25, 0.35, cosSun)", "uStrength * limb * lit"]) assert.ok(glsl.includes(piece), piece);
  const ts = readFileSync(new URL("../data/atmospheres.ts", import.meta.url), "utf8");
  for (const piece of ["0.75 - Math.abs(cosView)) / 0.75, 3", "0.15 + 0.85 * smoothstep(-0.25, 0.35, cosSun)"]) assert.ok(ts.includes(piece), piece);
});
