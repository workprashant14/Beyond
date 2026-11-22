/**
 * Builds the compact sky data files in public/sky/ from the open-source
 * d3-celestial dataset (BSD-3-Clause, Olaf Frohn). Run: npm run build:sky
 *
 * Nothing is invented here: every number is copied from the source files.
 * Missing values stay null and the UI shows "Data unavailable".
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "node_modules", "d3-celestial", "data");
const OUT = join(process.cwd(), "public", "sky");
mkdirSync(OUT, { recursive: true });
const read = (f: string) => JSON.parse(readFileSync(join(SRC, f), "utf8"));
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[    ]/g, " ").trim() : "");
/** Source longitudes are -180..180; astronomers use right ascension 0..360 degrees. */
const ra = (lon: number) => Math.round(((lon % 360) + 360) % 360 * 1e4) / 1e4;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

// ---- constellations (88; Serpens is split in two parts in the source) ----
const cons = read("constellations.json").features;
const lines = read("constellations.lines.json").features;
const bounds = read("constellations.bounds.json").features;

interface Con {
  id: string; name: string; gen: string;
  labels: [number, number][]; lines: [number, number][][]; bounds: [number, number][][];
}
const byId = new Map<string, Con>();
for (const f of cons) {
  const p = f.properties;
  const isSer = f.id === "Ser";
  const name = isSer ? "Serpens" : clean(p.name);
  const gen = isSer ? "Serpentis" : clean(p.gen);
  const c: Con = byId.get(f.id) ?? { id: f.id, name, gen, labels: [], lines: [], bounds: [] };
  c.labels.push([ra(f.geometry.coordinates[0]), r4(f.geometry.coordinates[1])]);
  byId.set(f.id, c);
}
for (const f of lines) {
  const c = byId.get(f.id)!;
  for (const seg of f.geometry.coordinates) c.lines.push(seg.map(([lo, la]: number[]) => [ra(lo), r4(la)]));
}
for (const f of bounds) {
  const c = byId.get(f.id)!;
  for (const ring of f.geometry.coordinates) c.bounds.push(ring.map(([lo, la]: number[]) => [ra(lo), r4(la)]));
}
const constellations = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
if (constellations.length !== 88) throw new Error(`expected 88 constellations, got ${constellations.length}`);

// ---- stars (Hipparcos numbers, magnitude <= 6 as packaged) ----
const stars = read("stars.6.json").features as { id: number; properties: { mag: number; bv: string }; geometry: { coordinates: number[] } }[];
const names = read("starnames.json") as Record<string, Record<string, string>>;
const hips: number[] = [], ras: number[] = [], decs: number[] = [], mags: number[] = [], bvs: (number | null)[] = [];
for (const s of stars) {
  hips.push(s.id);
  ras.push(ra(s.geometry.coordinates[0]));
  decs.push(r4(s.geometry.coordinates[1]));
  mags.push(s.properties.mag);
  const bv = parseFloat(s.properties.bv);
  bvs.push(Number.isFinite(bv) ? bv : null);
}

// per-star designations (only for stars present in the star file)
const present = new Set(hips);
const info: Record<string, Record<string, string>> = {};
for (const [k, v] of Object.entries(names)) {
  if (!present.has(Number(k))) continue;
  const rec: Record<string, string> = {};
  if (clean(v.name)) rec.n = clean(v.name);
  // The source has one corrupt designation ("undefined3"); drop anything that is not a letter plus optional digits.
  if (/^\p{L}{1,2}\d?$/u.test(clean(v.bayer))) rec.b = clean(v.bayer);
  if (clean(v.flam)) rec.f = clean(v.flam);
  if (clean(v.var)) rec.v = clean(v.var);
  if (clean(v.hd)) rec.h = clean(v.hd).replace(/^HD\s*/, "");
  if (clean(v.c)) rec.c = clean(v.c);
  if (Object.keys(rec).length) info[k] = rec;
}
writeFileSync(join(OUT, "starinfo.json"), JSON.stringify(info));
writeFileSync(join(OUT, "constellations.json"), JSON.stringify(constellations));

// ---- which constellation is a point in? (IAU boundaries, spherical winding number) ----
const D2R = Math.PI / 180;
const wrap = (d: number) => ((d + 540) % 360) - 180;
type Ring = { id: string; lam: number[]; phi: number[]; cx: number; cy: number; cz: number };
const rings: Ring[] = [];
for (const c of constellations) {
  for (const ring of c.bounds) {
    const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
    const lam: number[] = [], phi: number[] = [];
    for (let i = 0; i < closed.length - 1; i++) {
      const [ra0, d0] = closed[i], [ra1, d1] = closed[i + 1];
      const dra = wrap(ra1 - ra0), ddec = d1 - d0;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dra) * Math.cos(((d0 + d1) / 2) * D2R), Math.abs(ddec)) / 0.5));
      for (let k = 0; k < steps; k++) { lam.push((ra0 + (dra * k) / steps) * D2R); phi.push((d0 + (ddec * k) / steps) * D2R); }
    }
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < lam.length; i++) { cx += Math.cos(phi[i]) * Math.cos(lam[i]); cy += Math.cos(phi[i]) * Math.sin(lam[i]); cz += Math.sin(phi[i]); }
    const n = Math.hypot(cx, cy, cz);
    rings.push({ id: c.id, lam, phi, cx: cx / n, cy: cy / n, cz: cz / n });
  }
}
/** The ring winds around the point once (+-2 pi of bearing change) only if the point is inside it; the 90-degree test rejects the antipodal ambiguity. */
function constellationOf(raDeg: number, decDeg: number): string {
  const l0 = raDeg * D2R, p0 = decDeg * D2R;
  const px = Math.cos(p0) * Math.cos(l0), py = Math.cos(p0) * Math.sin(l0), pz = Math.sin(p0);
  const sp0 = Math.sin(p0), cp0 = Math.cos(p0);
  for (const r of rings) {
    if (px * r.cx + py * r.cy + pz * r.cz <= 0) continue;
    let sum = 0, prev = NaN;
    for (let i = 0; i < r.lam.length; i++) {
      const dl = r.lam[i] - l0;
      const th = Math.atan2(Math.sin(dl) * Math.cos(r.phi[i]), cp0 * Math.sin(r.phi[i]) - sp0 * Math.cos(r.phi[i]) * Math.cos(dl));
      if (i > 0) { let d = th - prev; if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; sum += d; }
      prev = th;
    }
    { const dl = r.lam[0] - l0; const th = Math.atan2(Math.sin(dl) * Math.cos(r.phi[0]), cp0 * Math.sin(r.phi[0]) - sp0 * Math.cos(r.phi[0]) * Math.cos(dl)); let d = th - prev; if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; sum += d; }
    if (Math.abs(sum) > Math.PI) return r.id;
  }
  return "";
}

// stars: keep the source constellation where it exists, compute the rest, and report how often the two methods agree
const starCon: string[] = [];
let agree = 0, disagree = 0, computed = 0;
const disagreeSample: string[] = [];
for (let i = 0; i < hips.length; i++) {
  const mine = constellationOf(ras[i], decs[i]);
  const src = info[String(hips[i])]?.c;
  if (src) { if (src === mine) agree++; else { disagree++; if (disagreeSample.length < 5) disagreeSample.push(`HIP${hips[i]} src=${src} mine=${mine}`); } starCon.push(src); }
  else { computed++; starCon.push(mine); }
}
writeFileSync(join(OUT, "stars.json"), JSON.stringify({ n: hips.length, hip: hips, ra: ras, dec: decs, mag: mags, bv: bvs, con: starCon }));
console.log(`constellation containment check vs source: agree ${agree}, disagree ${disagree} (${((100 * agree) / (agree + disagree)).toFixed(2)}%), computed for ${computed}, unassigned ${starCon.filter((c) => !c).length}`, disagreeSample.join("; "));

const bayerSet = new Set(Object.values(info).map((r) => r.b).filter(Boolean));
console.log("constellations:", constellations.length, "| stars:", hips.length, "| with designations:", Object.keys(info).length,
  "| proper names:", Object.values(info).filter((r) => r.n).length, "| missing B-V:", bvs.filter((b) => b === null).length);
const bad = Object.values(names).filter((v) => clean(v.bayer) && !/^\p{L}{1,2}\d?$/u.test(clean(v.bayer)));
console.log("dropped bad bayer values:", bad.length, bad.slice(0, 3).map((v) => `${v.hip}:${v.bayer}`).join(" "));
console.log("distinct bayer values:", [...bayerSet].join(" "));

// ---- deep-sky objects: OpenNGC (CC-BY-SA-4.0), vendored in data/raw/openngc ----
// Why OpenNGC and not the d3-celestial DSO set: cross-checking the two showed that about 3% of the d3-celestial NGC/IC
// positions are wrong by 1 to 19 degrees (for example M 87 is 7 arcminutes off). OpenNGC is maintained and also gives
// the constellation, magnitude band, size and radial velocity. Dark nebulae, stars, duplicates and non-existent objects are skipped.
import { createHash } from "node:crypto";
const RAW = join(process.cwd(), "data", "raw", "openngc");

function parseCsv(file: string): Record<string, string>[] {
  const lines = readFileSync(join(RAW, file), "utf8").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(";");
  return lines.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""]));
  });
}
const rowsAll = [...parseCsv("NGC.csv"), ...parseCsv("addendum.csv")];

const sexa = (s: string, hours: boolean): number | null => {
  const m = /^([+-]?)(\d+):(\d+):([\d.]+)$/.exec(s.trim());
  if (!m) return null;
  const v = Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  const val = (m[1] === "-" ? -1 : 1) * v;
  return hours ? val * 15 : val;
};
const numOrNull = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

/** OpenNGC type -> our type code (null = not shown in the atlas). */
function typeOf(r: Record<string, string>): string | null {
  switch (r.Type) {
    case "G": {
      const h = r.Hubble.trim();
      if (/^(dE|dSph)/.test(h)) return "sd";
      if (h === "E") return "e";
      if (h === "S0") return "s0";
      if (/^S(AB|A|B)?[a-dm]/.test(h)) return "s";
      if (/^I/.test(h)) return "i";
      return "g"; // includes transitional codes such as E-S0 and S0-a, shown honestly as "Galaxy" with the raw code in the panel
    }
    case "GPair": return "gp";
    case "GTrpl": return "gt";
    case "GGroup": return "gg";
    case "OCl": return "oc";
    case "GCl": return "gc";
    case "Cl+N": return "cn";
    case "PN": return "pn";
    case "HII": return "hii";
    case "EmN": return "en";
    case "RfN": return "rn";
    case "Neb": return "nb";
    case "SNR": return "snr";
    default: return null;
  }
}
const idOf = (name: string) => {
  const m = /^(NGC|IC)(\d+)(\D*)$/.exec(name);
  if (m) return `${m[1]} ${Number(m[2])}${m[3]}`;
  const g = /^([A-Za-z]+)(\d+)$/.exec(name);
  return g ? `${g[1]} ${Number(g[2])}` : name;
};

interface Dso { id: string; d: string; t: string; c: string; ra: number; dec: number; mag: number | null; mb: string; a: number | null; b: number | null; h: string; v: number | null; z: number | null; p: number | null; name: string }
/** OpenNGC splits Serpens into Se1 (Caput) and Se2 (Cauda); the IAU lists one constellation, Serpens. */
const conId = (c: string) => (c === "Se1" || c === "Se2" ? "Ser" : c);
const knownCons = new Set(constellations.map((c) => c.id));
const dsoAll: Dso[] = [];
for (const r of rowsAll) {
  const t = typeOf(r);
  const rra = sexa(r.RA, true), rdec = sexa(r.Dec, false);
  if (!t || rra === null || rdec === null) continue;
  const vMag = numOrNull(r["V-Mag"]), bMag = numOrNull(r["B-Mag"]);
  const id = idOf(r.Name);
  dsoAll.push({
    id,
    d: r.M ? `M ${Number(r.M)}` : id,
    t, c: conId(clean(r.Const)),
    ra: ra(rra), dec: r4(rdec),
    mag: vMag ?? bMag, mb: vMag !== null ? "V" : bMag !== null ? "B" : "",
    a: numOrNull(r.MajAx), b: numOrNull(r.MinAx),
    h: clean(r.Hubble), v: numOrNull(r.RadVel), z: numOrNull(r.Redshift), p: numOrNull(r.Pax),
    name: clean((r["Common names"] || "").split(",")[0]),
  });
}
if (new Set(dsoAll.map((x) => x.id)).size !== dsoAll.length) throw new Error("duplicate deep-sky ids");
const badCons = [...new Set(dsoAll.map((x) => x.c).filter((c) => c && !knownCons.has(c)))];
if (badCons.length) throw new Error(`unknown constellation codes in OpenNGC: ${badCons.join(", ")}`);

function packDso(list: Dso[]) {
  const out = { n: list.length, id: [] as string[], d: [] as string[], t: [] as string[], c: [] as string[], ra: [] as number[], dec: [] as number[],
    mag: [] as (number | null)[], mb: [] as string[], a: [] as (number | null)[], b: [] as (number | null)[], h: [] as string[], v: [] as (number | null)[], z: [] as (number | null)[], p: [] as (number | null)[],
    names: {} as Record<string, string> };
  for (const x of list) {
    out.id.push(x.id); out.d.push(x.d); out.t.push(x.t); out.c.push(x.c); out.ra.push(x.ra); out.dec.push(x.dec);
    out.mag.push(x.mag); out.mb.push(x.mb); out.a.push(x.a); out.b.push(x.b); out.h.push(x.h); out.v.push(x.v); out.z.push(x.z); out.p.push(x.p);
    if (x.name) out.names[x.id] = x.name;
  }
  return out;
}
const isBright = (x: Dso) => /^M \d/.test(x.d) || (x.mag !== null && x.mag <= 10);
const bright = dsoAll.filter(isBright);
const faint = dsoAll.filter((x) => !isBright(x));
writeFileSync(join(OUT, "dsos-bright.json"), JSON.stringify(packDso(bright)));
writeFileSync(join(OUT, "dsos-faint.json"), JSON.stringify(packDso(faint)));
const typeCount: Record<string, number> = {};
for (const x of dsoAll) typeCount[x.t] = (typeCount[x.t] ?? 0) + 1;
console.log("deep-sky (OpenNGC): bright tier", bright.length, "| faint tier", faint.length, "| types:", JSON.stringify(typeCount));

// ---- informational cross-check against the d3-celestial DSO set (not used as a source) ----
try {
  const d3 = (read("dsos.14.json").features as { id: string; geometry: { coordinates: number[] } }[]);
  const mine = new Map(dsoAll.map((x) => [x.id, x]));
  let matched = 0, disagree = 0;
  for (const f of d3) {
    const x = mine.get(f.id);
    if (!x) continue;
    matched++;
    const dr = ((ra(f.geometry.coordinates[0]) - x.ra + 540) % 360 - 180) * Math.cos((x.dec * Math.PI) / 180);
    const sep = Math.hypot(dr, f.geometry.coordinates[1] - x.dec);
    if (sep > Math.max(0.02, 0.25 * ((x.a ?? 0) / 60))) disagree++;
  }
  console.log(`cross-check vs d3-celestial: ${matched} shared ids, ${disagree} positions disagree beyond tolerance (OpenNGC is used)`);
} catch { /* optional */ }

const sha = (f: string) => createHash("sha256").update(readFileSync(join(RAW, f))).digest("hex").slice(0, 12);
writeFileSync(join(OUT, "SOURCES.md"), `# Sky data sources

- Stars (Hipparcos numbers, magnitude <= 6), IAU constellations (figures, boundaries): d3-celestial 0.7.35, BSD-3-Clause, Olaf Frohn.
- Deep-sky objects: OpenNGC, CC-BY-SA-4.0, Mattia Verga and contributors (https://github.com/mattiaverga/OpenNGC).
  public/sky/dsos-bright.json and dsos-faint.json are derived from it and are shared under CC-BY-SA-4.0.
  Input files sha256 (first 12): NGC.csv ${sha("NGC.csv")}, addendum.csv ${sha("addendum.csv")}.
`);
