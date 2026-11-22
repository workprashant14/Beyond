/**
 * Describes the layout of JPL's "Planetary Satellite Mean Elements" page so the moon pipeline can be written against the REAL layout.
 * It reads nothing into the data: for every table it reports the headings and text lines above it (epoch, ephemeris, frame), the column
 * headers, the number of rows and the first two rows, and writes that to a text file you can paste back.
 *
 * Run on your own computer (needs internet):
 *   npm run probe:satellites                          # downloads https://ssd.jpl.nasa.gov/sats/elem/sep.html
 *   npm run probe:satellites -- --file sep.html       # use a copy of the page you saved from your browser (Save page as, HTML only)
 *   npm run probe:satellites -- --out report.txt      # default: satellite-page-probe.txt in the project folder
 * Nothing is written into public/ or data/, and no dataset is changed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { formatProbe, probeTables } from "../utils/htmlProbe";

const URL_DEFAULT = "https://ssd.jpl.nasa.gov/sats/elem/sep.html";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const file = arg("--file"), out = arg("--out") ?? "satellite-page-probe.txt";
  let html: string, source: string;
  if (file) { html = readFileSync(file, "utf8"); source = `file ${file}`; }
  else {
    const url = arg("--url") ?? URL_DEFAULT;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    html = await res.text(); source = `${url} (downloaded ${new Date().toISOString()})`;
  }
  const tables = probeTables(html);
  if (tables.length === 0) throw new Error("No <table> found in that page: is it the satellite mean-elements page saved as HTML?");
  const report = formatProbe(tables, source);
  writeFileSync(out, report + "\n", "utf8");
  console.log(`${tables.length} tables, ${tables.reduce((s, t) => s + t.rowCount, 0)} data rows. Report written to ${out} (${report.length} characters).`);
  console.log("Open it and paste its content back into the chat.");
}

main().catch((e) => { console.error(String(e instanceof Error ? e.message : e)); process.exit(1); });
