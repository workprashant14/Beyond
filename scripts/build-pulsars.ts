/**
 * Builds public/pulsars/pulsars.json from a CSV you export from the ATNF Pulsar Catalogue web form.
 *
 *   1. Open https://www.atnf.csiro.au/research/pulsar/psrcat/
 *   2. Tick the parameters Name, JName, RAJD, DecJD, P0, DM, DIST
 *   3. Choose the output style "short csv without errors" and download/copy the result into a file, e.g. psrcat.csv
 *   4. npm run build:pulsars -- --file psrcat.csv
 *
 * The parser reads columns by their names, so column order does not matter, and it stops with a clear message if a
 * required column is missing. The existing data file is only replaced after the new data parsed and looks complete.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parsePsrcat } from "../utils/pulsars";

const MIN_ROWS = 1000; // the catalogue holds well over a thousand pulsars; far fewer means a wrong export

function main() {
  const i = process.argv.indexOf("--file");
  const path = i >= 0 ? process.argv[i + 1] : undefined;
  if (!path) throw new Error("pass the exported CSV: npm run build:pulsars -- --file psrcat.csv (steps are at the top of scripts/build-pulsars.ts)");
  const pulsars = parsePsrcat(readFileSync(path, "utf8"));
  if (pulsars.length < MIN_ROWS) throw new Error(`only ${pulsars.length} pulsars parsed (expected at least ${MIN_ROWS}); keeping the existing file`);
  mkdirSync("public/pulsars", { recursive: true });
  writeFileSync("public/pulsars/pulsars.json.tmp", JSON.stringify(pulsars));
  renameSync("public/pulsars/pulsars.json.tmp", "public/pulsars/pulsars.json");
  writeFileSync(
    "public/pulsars/SOURCES.md",
    `# Pulsar data\n\nSource: ATNF Pulsar Catalogue, https://www.atnf.csiro.au/research/pulsar/psrcat/ (local file ${path}).\nBuilt: ${new Date().toISOString()}\nPulsars: ${pulsars.length}\n\nAcknowledgement the catalogue asks for: Manchester, R. N., Hobbs, G. B., Teoh, A. & Hobbs, M., Astron. J., 129, 1993-2006 (2005), and the web address above.\n`,
  );
  console.log(`pulsars: ${pulsars.length} written from ${path}`);
}

try { main(); } catch (e) { console.error(`build:pulsars failed: ${e instanceof Error ? e.message : e}`); process.exit(1); }
