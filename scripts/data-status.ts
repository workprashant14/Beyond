/**
 * Reports which generated datasets exist in public/, how many records each holds, and which are placeholders, test builds or missing.
 *   npm run data:status            prints the table
 *   npm run data:status -- --strict  exit code 1 if any dataset is missing, empty, a placeholder, a test build or unreadable
 * It only reads files; it never downloads or rewrites anything.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DataState = "ok" | "missing" | "empty" | "placeholder" | "test-build" | "invalid";
export interface DataRow { name: string; state: DataState; count: number | null; detail: string; fix: string }

const readJson = (p: string): { ok: true; v: unknown } | { ok: false; why: "missing" | "invalid" } => {
  if (!existsSync(p)) return { ok: false, why: "missing" };
  try { return { ok: true, v: JSON.parse(readFileSync(p, "utf8")) }; } catch { return { ok: false, why: "invalid" }; }
};
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function simple(root: string, name: string, file: string, fix: string, count: (v: unknown) => number | null, detail?: (v: unknown) => string): DataRow {
  const r = readJson(join(root, file));
  if (!r.ok) return { name, state: r.why, count: null, detail: r.why === "missing" ? `${file} not found` : `${file} is not valid JSON`, fix };
  const n = count(r.v);
  if (n === null) return { name, state: "invalid", count: null, detail: `${file} does not have the expected shape`, fix };
  return { name, state: n === 0 ? "empty" : "ok", count: n, detail: detail ? detail(r.v) : file, fix };
}

export function datasetStatus(root = "public"): DataRow[] {
  const rows: DataRow[] = [];
  rows.push(simple(root, "Stars (Hipparcos)", "sky/stars.json", "npm run build:sky", (v) => (isObj(v) ? num(v.n) : null)));
  rows.push(simple(root, "Star names", "sky/starinfo.json", "npm run build:sky", (v) => (isObj(v) ? Object.keys(v).length : null)));
  rows.push(simple(root, "Star physical data", "sky/starphys.json", "npm run build:starphys", (v) => (isObj(v) ? num(v.n) : null), (v) => {
    const o = v as Record<string, unknown>, c = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x) => x !== null && x !== "").length : null);
    return `distance ${c("d")}, spectral type ${c("sp")}, proper motion ${c("pmra") ?? "not built"}, radial velocity ${c("rv") ?? "not built"}`;
  }));
  rows.push(simple(root, "Constellations", "sky/constellations.json", "npm run build:sky", (v) => (Array.isArray(v) ? v.length : null)));
  const d = ["bright", "faint"].map((t) => readJson(join(root, `sky/dsos-${t}.json`)));
  if (d.some((x) => !x.ok)) rows.push({ name: "Deep-sky objects", state: d.some((x) => !x.ok && x.why === "invalid") ? "invalid" : "missing", count: null, detail: "dsos-bright.json / dsos-faint.json missing or unreadable", fix: "npm run build:sky" });
  else { const n = d.map((x) => (x.ok && isObj(x.v) ? num(x.v.n) : null)); rows.push(n.includes(null) ? { name: "Deep-sky objects", state: "invalid", count: null, detail: "unexpected shape", fix: "npm run build:sky" } : { name: "Deep-sky objects", state: "ok", count: (n[0] as number) + (n[1] as number), detail: `bright ${n[0]}, faint ${n[1]}`, fix: "" }); }
  rows.push(simple(root, "Moons", "solar/moons.json", "npm run build:moons", (v) => (Array.isArray(v) ? v.length : null)));

  const tex = simple(root, "Surface photographs", "textures/index.json", "npm run build:textures", (v) => (isObj(v) && Array.isArray(v.textures) ? v.textures.length : null));
  rows.push(tex.state === "empty" ? { ...tex, state: "placeholder", detail: "no photographs installed; every surface is procedural/artistic" } : tex);

  rows.push(simple(root, "Exoplanets", "exoplanets/planets.json", "npm run build:exoplanets (needs internet)", (v) => (Array.isArray(v) ? v.length : null)));
  rows.push(simple(root, "Pulsars", "pulsars/pulsars.json", "npm run build:pulsars -- --file psrcat.csv", (v) => (Array.isArray(v) ? v.length : null)));

  const sb = readJson(join(root, "smallbodies/bodies.json"));
  const sbFix = "npm run build:smallbodies (needs internet)";
  if (!sb.ok) rows.push({ name: "Asteroids and comets", state: sb.why, count: null, detail: "bodies.json " + sb.why, fix: sbFix });
  else if (!isObj(sb.v) || !isObj(sb.v.meta) || !Array.isArray(sb.v.bodies)) rows.push({ name: "Asteroids and comets", state: "invalid", count: null, detail: "unexpected shape", fix: sbFix });
  else rows.push(sb.v.meta.source === "none" || sb.v.bodies.length === 0
    ? { name: "Asteroids and comets", state: "placeholder", count: 0, detail: "placeholder file, no JPL data built yet", fix: sbFix }
    : { name: "Asteroids and comets", state: "ok", count: sb.v.bodies.length, detail: `${sb.v.meta.asteroids} asteroids, ${sb.v.meta.comets} comets, built ${sb.v.meta.built}`, fix: "" });

  const qFix = "npm run build:quasars:fits -- --fits <DR16Q_v4.fits>";
  const q = readJson(join(root, "quasars/meta.json"));
  if (!q.ok) rows.push({ name: "Quasars", state: q.why, count: null, detail: "quasars/meta.json " + q.why, fix: qFix });
  else if (!isObj(q.v)) rows.push({ name: "Quasars", state: "invalid", count: null, detail: "unexpected shape", fix: qFix });
  else if (q.v.format === "chunked") {
    const inp = isObj(q.v.input) ? q.v.input : {}, cnt = isObj(q.v.counts) ? q.v.counts : {};
    const out = num(cnt.output_records), rowsIn = num(cnt.input_rows), limit = num(inp.test_limit);
    if (out === null || rowsIn === null) rows.push({ name: "Quasars", state: "invalid", count: null, detail: "meta.json has no counts", fix: qFix });
    else if (limit !== null) rows.push({ name: "Quasars", state: "test-build", count: out, detail: `chunked, TEST BUILD: ${out} of ${rowsIn} rows (--limit-rows ${limit})`, fix: qFix });
    else if (out !== rowsIn) rows.push({ name: "Quasars", state: "invalid", count: out, detail: `output records (${out}) differ from input rows (${rowsIn})`, fix: qFix });
    else rows.push({ name: "Quasars", state: "ok", count: out, detail: `chunked from ${String(inp.file)}; ${cnt.unplaced_no_valid_ra_dec ?? "?"} without valid RA/Dec; detail files ${q.v.hasDetail ? "built" : "not built"}`, fix: "" });
  } else {
    const n = num(q.v.count);
    rows.push(n === null ? { name: "Quasars", state: "invalid", count: null, detail: "unexpected shape", fix: qFix } : { name: "Quasars", state: n === 0 ? "empty" : "ok", count: n, detail: `older single-file CSV subset (${String(q.v.source)}), not the full catalogue`, fix: "" });
  }
  return rows;
}

export function formatStatus(rows: DataRow[]): string {
  const w = Math.max(...rows.map((r) => r.name.length));
  const icon: Record<DataState, string> = { ok: "OK         ", missing: "MISSING    ", empty: "EMPTY      ", placeholder: "PLACEHOLDER", "test-build": "TEST BUILD ", invalid: "INVALID    " };
  return rows.map((r) => `${icon[r.state]} ${r.name.padEnd(w)}  ${r.count === null ? "-" : r.count.toLocaleString("en-US")}  ${r.detail}${r.state !== "ok" && r.fix ? `\n${" ".repeat(13 + w)}  fix: ${r.fix}` : ""}`).join("\n");
}

if (process.argv[1] && /data-status\.[tj]s$/.test(process.argv[1])) {
  const rows = datasetStatus();
  console.log(formatStatus(rows));
  const bad = rows.filter((r) => r.state !== "ok");
  console.log(`\n${rows.length - bad.length} of ${rows.length} datasets are real and complete; ${bad.length} need attention.`);
  if (process.argv.includes("--strict") && bad.length) process.exit(1);
}
