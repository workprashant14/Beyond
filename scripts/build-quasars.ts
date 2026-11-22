/**
 * Builds public/quasars/quasars.json (+ meta.json) from a CSV subset of a quasar catalogue that you export yourself.
 *
 *   npm run build:quasars -- --file q.csv --source "SDSS DR16Q (Lyke et al. 2020)" --band i
 *
 * Export between 100 and 50,000 rows (e.g. the brightest few thousand): one name column, RA and Dec in DECIMAL DEGREES,
 * redshift, optionally one magnitude. The full 750,000-quasar catalogue is deliberately not supported (see ATLAS_ROADMAP.md).
 * Columns are matched by name; the script prints which ones it used. Override with --name-col --ra-col --dec-col --z-col --mag-col.
 * --band names the magnitude's band (e.g. i); without it magnitudes are not shown. --source is shown in the page and must
 * name where the data came from. Check that source's licence yourself: this project does not bundle the data.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseQuasarCsv, type QuasarMeta } from "../utils/quasars";

const MIN = 100, MAX = 50_000;
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

function main() {
  const file = arg("--file"), source = arg("--source"), band = arg("--band") ?? null;
  if (!file || !source) throw new Error('usage: npm run build:quasars -- --file q.csv --source "name of the catalogue" [--band i] (details at the top of scripts/build-quasars.ts)');
  const { quasars, columns, dropped } = parseQuasarCsv(readFileSync(file, "utf8"), { name: arg("--name-col"), ra: arg("--ra-col"), dec: arg("--dec-col"), z: arg("--z-col"), mag: arg("--mag-col") });
  console.log(`columns used: name=${columns.name}, ra=${columns.ra}, dec=${columns.dec}, z=${columns.z}, mag=${columns.mag ?? "none"}${columns.mag && !band ? " (magnitudes hidden: pass --band)" : ""}; ${dropped} unusable rows dropped`);
  if (quasars.length < MIN) throw new Error(`only ${quasars.length} quasars parsed (need at least ${MIN}); keeping the existing file`);
  if (quasars.length > MAX) throw new Error(`${quasars.length} rows is above ${MAX}; export a smaller subset (the full catalogue needs tiling that is not built)`);
  const data = band ? quasars : quasars.map((q) => ({ ...q, m: null }));
  mkdirSync("public/quasars", { recursive: true });
  writeFileSync("public/quasars/quasars.json.tmp", JSON.stringify(data));
  renameSync("public/quasars/quasars.json.tmp", "public/quasars/quasars.json");
  const meta: QuasarMeta = { source, band, built: new Date().toISOString(), count: data.length };
  writeFileSync("public/quasars/meta.json", JSON.stringify(meta));
  console.log(`quasars: ${data.length} written from ${file}`);
}

try { main(); } catch (e) { console.error(`build:quasars failed: ${e instanceof Error ? e.message : e}`); process.exit(1); }
