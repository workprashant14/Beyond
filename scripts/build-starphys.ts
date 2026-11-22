/**
 * Builds public/sky/starphys.json (distance, spectral type, proper motion, radial velocity, colour index and catalogue
 * identifiers per Hipparcos star) from the AT-HYG "HYGLike" catalogue (https://github.com/astronexus/hyg-database, CC BY-SA 4.0).
 *
 *   npm run build:starphys                         uses the extract in data/raw/athyg/hip-extract.csv
 *   npm run build:starphys -- --file athyg.csv.gz [--file part2.csv.gz] [--write-extract]
 *                                                  streams the full catalogue (about 2.5 million rows, .csv or .csv.gz) one line at a
 *                                                  time, so it needs little memory; the header comes from the first file; a later
 *                                                  file may repeat it or not. --write-extract refreshes the bundled extract.
 *   --out path                                     writes somewhere other than public/sky/starphys.json (used by the tests)
 *
 * Rules: a value is stored only if AT-HYG has it AND its source indicator is not NONE ("N"); nothing is guessed or filled in.
 * The catalogue has no per-value errors, so none are stored. The colour index is kept only where AT-HYG says it is B-V
 * (magnitude source HIP or GJ); the Tycho-2 BT-VT index is a different system and is left out.
 */
import { createGunzip } from "node:zlib";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { StarPhysFile } from "../utils/starPhys";

const SRC_DIST: Record<string, string> = { G_R3: "G3", G_R2: "G2", HIP: "H", GJ: "GJ" };
const SRC_SPECT: Record<string, string> = { T: "T", HYG: "HYG" };
/** Source codes for proper motion and radial velocity (AT-HYG version-info.md). "N"/"NONE" = no valid value. */
const SRC_VEL: Record<string, string> = { G_R3: "G3", G_R2: "G2", HYG: "HYG", GJ: "GJ", T: "T", HIP: "H", OTHER: "O" };
const EXTRACT = "data/raw/athyg/hip-extract.csv";
const COLS = ["hip", "dist", "dist_src", "spect", "spect_src", "hd", "hr", "gl", "pm_ra", "pm_dec", "pm_src", "rv", "rv_src", "ci", "mag_src"];
const NEW_COLS = COLS.slice(5);

/** One CSV line (no line breaks inside fields; AT-HYG has none). Honours double quotes. */
export function csvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cell); cell = ""; }
    else cell += ch;
  }
  out.push(cell);
  return out;
}

async function* lines(file: string): AsyncGenerator<string> {
  const input = file.endsWith(".gz") ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
  for await (const l of createInterface({ input, crlfDelay: Infinity })) if (l !== "") yield l;
}

const num = (s: string | undefined) => { if (s === undefined || s.trim() === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Builds the output arrays from the AT-HYG rows (as column-name -> text) of the wanted stars. Pure, so it is unit-tested. */
export function buildStarPhys(hips: number[], byHip: Map<number, Record<string, string>>): { file: Required<StarPhysFile>; stats: Record<string, number> } {
  const out: Required<StarPhysFile> = { n: hips.length, hip: hips, d: [], ds: [], sp: [], ss: [], hd: [], hr: [], gl: [], pmra: [], pmdec: [], pms: [], rv: [], rvs: [], ci: [] };
  const st = { found: 0, dist: 0, spect: 0, pm: 0, rv: 0, ci: 0, hd: 0, hr: 0, gl: 0 };
  for (const hip of hips) {
    const c = byHip.get(hip);
    if (c) st.found++;
    const dist = num(c?.dist), src = c ? SRC_DIST[c.dist_src] : undefined;
    // Placeholder distances (>= 100000) and rows without a known source are "unknown", never numbers.
    const okD = dist !== null && dist > 0 && dist < 100000 && !!src;
    out.d.push(okD ? round(dist!, 3) : null); out.ds.push(okD ? src! : ""); if (okD) st.dist++;
    const sp = c ? c.spect.trim() : "", ss = c ? SRC_SPECT[c.spect_src] : undefined;
    out.sp.push(sp && ss ? sp : null); out.ss.push(sp && ss ? ss : ""); if (sp && ss) st.spect++;
    const pa = num(c?.pm_ra), pd = num(c?.pm_dec), ps = c ? SRC_VEL[c.pm_src] : undefined;
    const okP = pa !== null && pd !== null && !!ps;
    out.pmra.push(okP ? round(pa!, 3) : null); out.pmdec.push(okP ? round(pd!, 3) : null); out.pms.push(okP ? ps! : ""); if (okP) st.pm++;
    const rv = num(c?.rv), rs = c ? SRC_VEL[c.rv_src] : undefined;
    const okR = rv !== null && !!rs;
    out.rv.push(okR ? round(rv!, 3) : null); out.rvs.push(okR ? rs! : ""); if (okR) st.rv++;
    const ci = num(c?.ci), bv = c && (c.mag_src === "HIP" || c.mag_src === "GJ");
    out.ci.push(ci !== null && bv ? round(ci, 3) : null); if (ci !== null && bv) st.ci++;
    const hd = num(c?.hd), hr = num(c?.hr), gl = c?.gl.trim() ?? "";
    out.hd.push(hd !== null && hd > 0 ? hd : null); if (hd) st.hd++;
    out.hr.push(hr !== null && hr > 0 ? hr : null); if (hr) st.hr++;
    out.gl.push(gl); if (gl) st.gl++;
  }
  return { file: out, stats: st };
}

async function main() {
  const argv = process.argv;
  const files = argv.flatMap((a, i) => (a === "--file" ? [argv[i + 1]] : []));
  const source = files.length ? files : [EXTRACT];
  const stars = JSON.parse(readFileSync("public/sky/stars.json", "utf8")) as { hip: number[] };
  const wanted = new Set(stars.hip);
  let head: string[] | null = null, rows = 0;
  const byHip = new Map<number, Record<string, string>>();
  for (const f of source) {
    let first = true;
    for await (const line of lines(f)) {
      const c = csvLine(line);
      if (first) {
        first = false;
        if (c.includes("hip")) { if (!head) head = c; continue; }   // a header line
        if (!head) throw new Error(`${f}: the first file must start with a header line`);
      }
      rows++;
      if (!head) throw new Error("no header");
      if (c.length !== head.length) throw new Error(`${f}: row ${rows} has ${c.length} fields, expected ${head.length}`);
      const hip = Number(c[head.indexOf("hip")]);
      if (hip && wanted.has(hip) && !byHip.has(hip)) byHip.set(hip, Object.fromEntries(head.map((h, k) => [h, c[k]])));
    }
  }
  if (!head) throw new Error("no data");
  const base = ["hip", "dist", "dist_src", "spect", "spect_src"].filter((k) => !head!.includes(k));
  if (base.length) throw new Error(`columns missing: ${base.join(", ")}`);
  const lacking = NEW_COLS.filter((k) => !head!.includes(k));
  if (lacking.length) console.warn(`WARNING: the input has no ${lacking.join(", ")}; those fields will be empty. Rebuild the extract from the full catalogue (--file ... --write-extract).`);
  for (const m of byHip.values()) for (const k of NEW_COLS) m[k] ??= "";
  const { file, stats } = buildStarPhys(stars.hip, byHip);
  const oi = argv.indexOf("--out");
  writeFileSync(oi >= 0 ? argv[oi + 1] : "public/sky/starphys.json", JSON.stringify(file));

  if (argv.includes("--write-extract")) {
    const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const out = [COLS.join(",")];
    for (const hip of stars.hip) { const m = byHip.get(hip); if (m) out.push(COLS.map((k) => q(m[k] ?? "")).join(",")); }
    writeFileSync(EXTRACT, out.join("\n") + "\n");
  }
  console.log(`starphys: read ${rows} catalogue rows; ${stats.found} of ${stars.hip.length} stars found (${stars.hip.length - stats.found} not in the catalogue); ` +
    `with distance ${stats.dist}, spectral type ${stats.spect}, proper motion ${stats.pm}, radial velocity ${stats.rv}, colour index ${stats.ci}, HD ${stats.hd}, HR ${stats.hr}, Gliese ${stats.gl}`);
}

if (process.argv[1] && /build-starphys\.[tj]s$/.test(process.argv[1])) main().catch((e) => { console.error(`build:starphys failed: ${e instanceof Error ? e.message : e}`); process.exit(1); });
