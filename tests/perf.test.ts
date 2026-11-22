import { test } from "node:test";
import assert from "node:assert/strict";
import { galaxyStars } from "../utils/galaxyStars";
import { SCENE_OBJECTS } from "../universe/objects/sceneConfig";

test("galaxy point counts scale with size and stay in bounds", () => {
  assert.equal(galaxyStars(34), 7000);
  assert.equal(galaxyStars(9), 2200);
  assert.ok(galaxyStars(18) > galaxyStars(9) && galaxyStars(18) < galaxyStars(34));
});

test("universe view point budget stays under 20k galaxy points", () => {
  const total = SCENE_OBJECTS.filter((o) => o.kind === "galaxy" && !o.parent).reduce((n, o) => n + galaxyStars(o.radius), 0);
  assert.ok(total <= 20000, `galaxy points at universe level: ${total}`);
});

// ---------- Sky Atlas picking budget (real catalogue data) ----------
import { readFileSync as readSky } from "node:fs";
import { raDecToVec as toVec } from "../utils/sky";
import { SkyGrid as Grid } from "../utils/skyGrid";
test("sky picking scans only a small neighbourhood of the 17,000-object catalogue", () => {
  const L = (f: string) => JSON.parse(readSky(`public/sky/${f}`, "utf8"));
  const st = L("stars.json"), br = L("dsos-bright.json"), fa = L("dsos-faint.json");
  const ra = [...st.ra, ...br.ra, ...fa.ra], dec = [...st.dec, ...br.dec, ...fa.dec];
  const pos = new Float32Array(ra.length * 3);
  ra.forEach((r: number, i: number) => pos.set(toVec(r, dec[i]), i * 3));
  const grid = new Grid(pos, ra.length);
  const radius = 18 * ((2 * Math.tan((75 * Math.PI) / 360)) / 800) * 1.1; // 18 px at the widest field of view
  const out: number[] = [];
  let worst = 0;
  for (let k = 0; k < 500; k++) {
    const z = Math.sin(((k * 137.5) % 180 - 90) * Math.PI / 180), t = (k * 2.399963) % (2 * Math.PI), r = Math.sqrt(1 - z * z);
    grid.query(r * Math.cos(t), z, r * Math.sin(t), radius, out);
    worst = Math.max(worst, out.length);
  }
  assert.ok(ra.length > 17000);
  assert.ok(worst < 400, `worst-case candidates ${worst} of ${ra.length}`);
});
