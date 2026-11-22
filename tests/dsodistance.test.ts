import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comovingDistanceMpc, MPC_LY } from "../utils/cosmology";
import { dsoDistance, MIN_Z_FOR_DISTANCE } from "../utils/dsoDistance";

interface Raw { n: number; id: string[]; t: string[]; v: (number | null)[]; z: (number | null)[]; p: (number | null)[]; mag: (number | null)[] }
const load = (f: string) => JSON.parse(readFileSync(`public/sky/${f}`, "utf8")) as Raw;
const bright = load("dsos-bright.json"), faint = load("dsos-faint.json");
const all = [bright, faint].flatMap((s) => s.id.map((id, i) => ({ id, t: s.t[i], v: s.v[i], z: s.z[i], p: s.p[i] })));
const byId = new Map(all.map((x) => [x.id, x]));
const near = (a: number, b: number, rel: number, m = "") => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${m} ${a} vs ${b}`);

test("comoving distance matches astropy FlatLambdaCDM(H0=67.4, Om0=0.315, Tcmb0=0) (values computed with astropy 8.0.2)", () => {
  const expected: [number, number][] = [[0.01, 44.374308862349324], [0.05, 219.74710696602043], [0.1, 434.1109946354975], [0.5, 1951.3869861584071], [1, 3401.262917346902], [2, 5312.075392455687], [3, 6506.062225231807]];
  for (const [z, d] of expected) near(comovingDistanceMpc(z), d, 1e-6, `z=${z}`);
  assert.equal(comovingDistanceMpc(0), 0);
  assert.throws(() => comovingDistanceMpc(-0.1), RangeError); assert.throws(() => comovingDistanceMpc(NaN), RangeError);
  near(MPC_LY, 3.26156377716e6, 1e-9);
});

test("galactic objects: observed from a large parallax, rough from a medium one, nothing from a tiny one or none", () => {
  const bee = dsoDistance("oc", null, 5.371);   // Beehive Cluster, catalogued parallax in OpenNGC
  assert.equal(bee.kind, "observed"); near(bee.ly!, 607, 0.01, "Beehive about 607 ly"); assert.match(bee.text!, /^about 6\d\d light-years$/);
  assert.equal(dsoDistance("oc", null, 1.5).kind, "estimated");
  const tiny = dsoDistance("gc", null, 0.0522);
  assert.deepEqual([tiny.kind, tiny.ly, tiny.text], [null, null, null]); assert.match(tiny.note, /too small/);
  assert.equal(dsoDistance("pn", null, null).kind, null);
  assert.equal(dsoDistance("pn", null, 0).kind, null); assert.equal(dsoDistance("pn", null, -1).kind, null);
  assert.equal(dsoDistance("oc", 0.5, 5).ly, dsoDistance("oc", null, 5).ly, "redshift is ignored for galactic objects");
});

test("galaxies: estimated from redshift only when z >= 0.01; negative, tiny or missing redshifts give nothing", () => {
  const far = dsoDistance("s", 0.022860, 0.0001);   // parallax is ignored for galaxies
  assert.equal(far.kind, "estimated"); near(far.ly!, comovingDistanceMpc(0.02286) * MPC_LY, 1e-12); assert.match(far.text!, /million light-years/); assert.match(far.note, /Planck 2018/);
  assert.match(dsoDistance("g", 0.05, null).text!, /^about 717 million light-years$/); assert.match(dsoDistance("g", 0.15, null).text!, /billion light-years/);
  assert.match(dsoDistance("e", 1.2, null).text!, /billion light-years/);
  for (const z of [0.0099, 0, -0.0016, null]) assert.equal(dsoDistance("s", z, null).kind, null, String(z));
  assert.match(dsoDistance("s", -0.0016, null).note, /toward us/); assert.match(dsoDistance("s", 0.005, null).note, /own motion/); assert.match(dsoDistance("s", null, null).note, /no redshift/);
  assert.equal(dsoDistance("s", MIN_Z_FOR_DISTANCE, null).kind, "estimated");
  assert.equal(dsoDistance("snr" as never, null, null).kind, null);
});

test("bundled data: redshift/parallax arrays are aligned and plausible", () => {
  for (const s of [bright, faint]) { assert.equal(s.z.length, s.n); assert.equal(s.p.length, s.n); }
  const zc = all.filter((x) => x.z !== null).length, pc = all.filter((x) => x.p !== null).length;
  assert.ok(zc > 9000, `redshifts ${zc}`); assert.ok(pc > 1000, `parallaxes ${pc}`);
  for (const x of all) {
    if (x.z !== null) assert.ok(x.z > -0.01 && x.z < 1, `${x.id} z=${x.z}`);
    if (x.p !== null) assert.ok(x.p > 0 && x.p < 30, `${x.id} p=${x.p}`);
    assert.equal(x.z === null, x.v === null, `${x.id}: redshift and radial velocity come from the same SIMBAD value`);
  }
});

test("known objects from the bundled data", () => {
  const m44 = byId.get("NGC 2632")!, pleiades = byId.get("Mel 22")!;
  assert.equal(dsoDistance(m44.t as never, m44.z, m44.p).kind, "observed"); near(dsoDistance(m44.t as never, m44.z, m44.p).ly!, 607, 0.02, "Beehive");
  near(dsoDistance(pleiades.t as never, pleiades.z, pleiades.p).ly!, 443, 0.02, "Pleiades ~443 ly (136 pc)");
  const omega = byId.get("NGC 5139")!; assert.equal(dsoDistance(omega.t as never, omega.z, omega.p).kind, null, "globular cluster parallax is too small");
  const withDistance = all.filter((x) => dsoDistance(x.t as never, x.z, x.p).kind !== null).length;
  assert.ok(withDistance > 7000 && withDistance < all.length, `${withDistance} of ${all.length} objects get a distance`);
  console.log(`objects with a shown distance: ${withDistance} of ${all.length}`);
});
