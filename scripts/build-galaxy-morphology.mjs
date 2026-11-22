// Builds data/galaxyMorphology.json from the local OpenNGC CSVs (data/raw/openngc, not in Git).
// Only the handful of galaxies the 3D scene renders are extracted. Run: node scripts/build-galaxy-morphology.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILES = ["data/raw/openngc/NGC.csv", "data/raw/openngc/addendum.csv"];
const WANT = {
  andromeda: "NGC0224",
  triangulum: "NGC0598",
  m87: "NGC4486",
  lmc: "ESO056-115",
};
const rows = new Map();
for (const f of FILES) {
  const [head, ...lines] = readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = head.split(";");
  for (const l of lines) {
    const v = l.split(";");
    rows.set(v[0], Object.fromEntries(cols.map((c, i) => [c, v[i]])));
  }
}
const num = (s) => (s === undefined || s === "" ? null : Number(s));
const out = {
  _source: "OpenNGC (https://github.com/mattiaverga/OpenNGC), CC-BY-SA-4.0; MajAx/MinAx in arcmin, PosAng in degrees east of north, Hubble as catalogued. Nulls mean the catalogue has no value.",
  galaxies: {},
};
for (const [id, ngc] of Object.entries(WANT)) {
  const r = rows.get(ngc);
  if (!r) throw new Error(`${ngc} not found in OpenNGC`);
  out.galaxies[id] = {
    openngc: ngc,
    hubble: r.Hubble || null,
    majAxArcmin: num(r.MajAx),
    minAxArcmin: num(r.MinAx),
    posAngDeg: num(r.PosAng),
    bMag: num(r["B-Mag"]),
  };
}
// Our own galaxy is not in OpenNGC. objects.json only says "barred spiral"; we have no catalogued inclination or position angle.
out.galaxies["milky-way"] = { openngc: null, hubble: null, majAxArcmin: null, minAxArcmin: null, posAngDeg: null, bMag: null, note: "Not in OpenNGC; the object summary calls it a barred spiral. No inclination (we are inside it)." };
writeFileSync("data/galaxyMorphology.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out.galaxies, null, 1));
