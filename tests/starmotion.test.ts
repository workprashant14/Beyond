import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTsx } from "./helpers/runtime";
import { buildStarPhys, csvLine } from "../scripts/build-starphys";
import { K_KMS, tangentialVelocityKms, totalProperMotion, motionSourceLabel, type StarPhysFile } from "../utils/starPhys";

const phys = JSON.parse(readFileSync("public/sky/starphys.json", "utf8")) as Required<StarPhysFile>;
const stars = JSON.parse(readFileSync("public/sky/stars.json", "utf8")) as { hip: number[]; bv: number[] };
const root = join(__dirname, "..");
const near = (a: number, b: number, tol: number, m = "") => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

// SYNTHETIC rows (invented numbers on real HIP ids): they test the rules, not astronomy.
const row = (o: Record<string, string>) => ({ dist: "", dist_src: "N", spect: "", spect_src: "N", hd: "", hr: "", gl: "", pm_ra: "", pm_dec: "", pm_src: "N", rv: "", rv_src: "N", ci: "", mag_src: "", ...o });

test("source rules: a value needs a valid source; placeholders and unknown sources never become numbers", () => {
  const m = new Map([
    [1, row({ pm_ra: "10", pm_dec: "-5", pm_src: "G_R3", rv: "20.5", rv_src: "G_R3", ci: "0.5", mag_src: "HIP", hd: "99", hr: "7", gl: "Gl 1", dist: "10", dist_src: "G_R3" })],
    [2, row({ pm_ra: "10", pm_dec: "-5", pm_src: "N", rv: "3", rv_src: "N", ci: "1.1", mag_src: "T", dist: "999999", dist_src: "G_R3" })],
    [3, row({ pm_ra: "10", pm_src: "G_R3", rv: "0", rv_src: "HYG" })],
  ]);
  const { file, stats } = buildStarPhys([1, 2, 3, 4], m);
  assert.deepEqual([file.pmra[0], file.pmdec[0], file.pms[0], file.rv[0], file.rvs[0], file.ci[0], file.hd[0], file.hr[0], file.gl[0]], [10, -5, "G3", 20.5, "G3", 0.5, 99, 7, "Gl 1"]);
  assert.deepEqual([file.pmra[1], file.pms[1], file.rv[1], file.rvs[1], file.ci[1], file.d[1]], [null, "", null, "", null, null], "no-source values, Tycho BT-VT colour and placeholder distance are not stored");
  assert.equal(file.pmra[2], null, "proper motion needs both components");
  assert.equal(file.rv[2], 0, "a radial velocity of exactly 0 with a valid source is a value, not a gap");
  assert.deepEqual([file.pmra[3], file.rv[3], file.hd[3], file.gl[3]], [null, null, null, ""], "a star missing from the catalogue stays unknown");
  assert.equal(stats.found, 3); assert.equal(file.n, 4);
});

test("csvLine honours quotes and empty cells", () => {
  assert.deepEqual(csvLine('1,"B 8 P, HG",,x'), ["1", "B 8 P, HG", "", "x"]);
  assert.deepEqual(csvLine('a,"say ""hi"""'), ["a", 'say "hi"']);
});

test("streaming reader: two gzip parts (header only in the first) and a plain file give the same result", () => {
  const dir = mkdtempSync(join(tmpdir(), "beyond-sp-"));
  const hips = stars.hip.slice(0, 6);
  const H = "id,hip,dist,dist_src,spect,spect_src,hd,hr,gl,pm_ra,pm_dec,pm_src,rv,rv_src,ci,mag_src";
  const line = (k: number, h: number) => `${k},${h},${10 + k},G_R3,"K${k} V",T,${100 + k},${200 + k},,${k}.5,-${k}.25,G_R3,${k}.75,HYG,0.${k},HIP`;
  const rows = hips.map((h, k) => line(k, h));
  const noise = ["900,0,1,G_R3,A0,T,,,,,,N,,N,,T", "901,99999999,1,G_R3,A0,T,,,,,,N,,N,,T"]; // rows that are not in stars.json
  writeFileSync(join(dir, "a.csv.gz"), gzipSync([H, ...rows.slice(0, 3), noise[0]].join("\n") + "\n"));
  writeFileSync(join(dir, "b.csv.gz"), gzipSync([...rows.slice(3), noise[1]].join("\n") + "\n"));
  writeFileSync(join(dir, "all.csv"), [H, ...rows, ...noise].join("\n") + "\n");
  const run = (args: string[], out: string) => { const r = runTsx(["scripts/build-starphys.ts", ...args, "--out", out], root); assert.equal(r.status, 0, r.stderr + r.stdout); return JSON.parse(readFileSync(out, "utf8")) as Required<StarPhysFile>; };
  const two = run(["--file", join(dir, "a.csv.gz"), "--file", join(dir, "b.csv.gz")], join(dir, "o1.json"));
  const one = run(["--file", join(dir, "all.csv")], join(dir, "o2.json"));
  assert.deepEqual(two, one);
  assert.deepEqual(two.pmra.slice(0, 6), [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
  assert.deepEqual(two.rv.slice(0, 3), [0.75, 1.75, 2.75]); assert.equal(two.sp[2], "K2 V");
  assert.equal(two.pmra[6], null, "stars not in the input stay unknown");
  writeFileSync(join(dir, "w.csv"), `${H}\n1,2,3\n`);
  const wrong = runTsx(["scripts/build-starphys.ts", "--file", join(dir, "w.csv"), "--out", join(dir, "y.json")], root);
  assert.notEqual(wrong.status, 0, "a row with the wrong number of fields is refused, not guessed"); assert.match(wrong.stderr, /fields/);
});

test("bundled starphys.json: consistent lengths and ranges; every value has a source", () => {
  for (const k of ["d", "ds", "sp", "ss", "pmra", "pmdec", "pms", "rv", "rvs", "ci", "hd", "hr", "gl"] as const) assert.equal(phys[k].length, phys.n, k);
  assert.deepEqual(phys.hip, stars.hip);
  for (let i = 0; i < phys.n; i++) {
    assert.equal(phys.pmra[i] === null, phys.pmdec[i] === null);
    if (phys.pmra[i] !== null) assert.ok(phys.pms[i] !== "" && Number.isFinite(phys.pmra[i]!) && Math.abs(phys.pmra[i]!) < 20000);
    else assert.equal(phys.pms[i], "");
    if (phys.rv[i] !== null) { assert.ok(phys.rvs[i] !== ""); assert.ok(Math.abs(phys.rv[i]!) < 1000, `rv ${phys.rv[i]}`); } else assert.equal(phys.rvs[i], "");
    if (phys.ci[i] !== null) assert.ok(phys.ci[i]! > -1 && phys.ci[i]! < 5);
  }
  assert.ok(phys.pmra.filter((x) => x !== null).length >= 5000, "proper motion for the bright catalogue");
  assert.ok(phys.rv.filter((x) => x !== null).length >= 5000);
});

test("independent checks: Sirius proper motion (Hipparcos) and its colour index agree with the other bundled file", () => {
  const i = phys.hip.indexOf(32349);
  near(phys.pmra[i]!, -546.0, 0.5, "Sirius pmRA"); near(phys.pmdec[i]!, -1223.1, 0.5, "Sirius pmDec");
  near(totalProperMotion(phys.pmra[i]!, phys.pmdec[i]!), 1339.5, 1, "total");
  let compared = 0;
  for (let k = 0; k < phys.n; k++) if (phys.ci[k] !== null && Number.isFinite(stars.bv[k])) { compared++; near(phys.ci[k]!, stars.bv[k], 0.02, `HIP ${phys.hip[k]} B-V`); }
  assert.ok(compared > 4900, `compared ${compared}`);
});

test("tangential velocity formula", () => {
  near(K_KMS, 4.74047, 1e-5);
  near(tangentialVelocityKms(1339.5, 2.637), 16.7, 0.2, "Sirius ~16.7 km/s");
  near(tangentialVelocityKms(1000, 1), 4.74047, 1e-5);
  assert.equal(motionSourceLabel("G3"), "Gaia DR3"); assert.match(motionSourceLabel("HYG"), /HYG/); assert.match(motionSourceLabel(""), /unknown/);
});

test("reproducible: rebuilding from the bundled extract gives exactly the bundled starphys.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "beyond-sp2-"));
  const out = join(dir, "o.json");
  const r = runTsx(["scripts/build-starphys.ts", "--out", out], root);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8"), readFileSync("public/sky/starphys.json", "utf8"));
});
