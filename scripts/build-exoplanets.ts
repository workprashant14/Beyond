/**
 * Builds public/exoplanets/planets.json from the NASA Exoplanet Archive (table pscomppars, confirmed planets).
 *
 *   npm run build:exoplanets                 download from the archive (needs internet; run on your own computer)
 *   npm run build:exoplanets -- --file x.csv use a CSV you already downloaded (same columns)
 *   npm run build:exoplanets -- --out dir    write planets.json and SOURCES.md into dir instead of public/exoplanets (use this for smoke tests,
 *                                            so test data can never end up in the shipped dataset)
 *
 * Besides the basic values, the query asks for each of five parameters' upper and lower uncertainty, limit flag and reference, plus the
 * mass provenance (see EXO_ALL_COLUMNS / PARAM_COLUMNS in utils/exoplanets.ts). If the archive rejects the query (for example a column was
 * renamed) the build stops and prints the archive's answer; nothing is replaced. The existing data file is only replaced after the new data
 * parsed cleanly and looks complete (written to a .tmp file, then renamed).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { EXO_ALL_COLUMNS, EXO_EXTRA_COLUMNS, exoStats, parseCsv, parseExoCsv } from "../utils/exoplanets";

const TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const outFlag = process.argv.indexOf("--out");
const OUT = outFlag >= 0 ? process.argv[outFlag + 1] : "public/exoplanets";
const MIN_ROWS = 1000; // the archive holds several thousand confirmed planets; far fewer means a bad download
const cols = EXO_ALL_COLUMNS.join(",");
const query = `select ${cols} from pscomppars order by pl_name`;

async function load(): Promise<{ csv: string; origin: string }> {
  const i = process.argv.indexOf("--file");
  if (i >= 0) {
    const path = process.argv[i + 1];
    if (!path) throw new Error("--file needs a path");
    return { csv: readFileSync(path, "utf8"), origin: `local file ${path}` };
  }
  const url = `${TAP}?query=${encodeURIComponent(query).replace(/%20/g, "+")}&format=csv`;
  const res = await fetch(url, { headers: { "User-Agent": "BEYOND-build-script/1.0" }, signal: AbortSignal.timeout(120_000) }).catch((e) => {
    throw new Error(`could not reach the NASA Exoplanet Archive (${e instanceof Error && e.cause instanceof Error ? e.cause.message : "network error"}). Check your internet connection, or download the CSV yourself and run with --file`);
  });
  if (!res.ok) throw new Error(`archive answered HTTP ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 400)}`);
  return { csv: await res.text(), origin: "NASA Exoplanet Archive TAP service" };
}

const FIELD_DOC = `
## Fields

Basic fields keep their short names (see \`utils/exoplanets.ts\`). Measurement detail is stored per parameter in the optional object \`u\`:

| Parameter (short key) | Value column | \`e1\` upper error | \`e2\` lower error | \`l\` limit flag | \`r\` reference |
|---|---|---|---|---|---|
| Orbital period (\`p\`) | pl_orbper | pl_orbpererr1 | pl_orbpererr2 | pl_orbperlim | pl_orbper_reflink |
| Semi-major axis (\`a\`) | pl_orbsmax | pl_orbsmaxerr1 | pl_orbsmaxerr2 | pl_orbsmaxlim | pl_orbsmax_reflink |
| Radius (\`r\`) | pl_rade | pl_radeerr1 | pl_radeerr2 | pl_radelim | pl_rade_reflink |
| Mass (\`ms\`) | pl_bmasse | pl_bmasseerr1 | pl_bmasseerr2 | pl_bmasselim | pl_bmasse_reflink |
| Equilibrium temperature (\`t\`) | pl_eqt | pl_eqterr1 | pl_eqterr2 | pl_eqtlim | pl_eqt_reflink |

- \`mp\`: mass provenance (\`pl_bmassprov\`), e.g. Mass or M*sin(i).
- \`c\`: \`pl_controv_flag\` (1 = the confirmation status has been questioned in the published literature).
- A key inside \`u\` exists only when the archive supplied that piece. Missing uncertainty is absent, never 0. \`e2\` keeps the archive's sign (normally negative).
- \`l\` is the raw limit flag. \`1\` is shown as an upper limit; any other non-zero flag is shown raw and uninterpreted, because the archive documentation read for this project does not define the values.
- \`r\` is reduced to plain text (\`l\`), an optional validated http(s) link (\`u\`) and, for the archive's CALCULATED_VALUE marker, \`k: "calc"\`. HTML from the archive is never kept.
`;

async function main() {
  if (!OUT) throw new Error("--out needs a directory");
  const { csv, origin } = await load();
  const head = (parseCsv(csv)[0] ?? []).map((h) => h.trim());
  const missingExtra = EXO_EXTRA_COLUMNS.filter((c) => !head.includes(c));
  const planets = parseExoCsv(csv);
  if (planets.length < MIN_ROWS) throw new Error(`only ${planets.length} planets parsed (expected at least ${MIN_ROWS}); keeping the existing file`);
  if (missingExtra.length === EXO_EXTRA_COLUMNS.length && !process.argv.includes("--file")) throw new Error("the archive answer has none of the uncertainty/limit/reference columns; keeping the existing file");
  if (missingExtra.length) console.warn(`warning: ${missingExtra.length} optional column(s) missing from the data, so that detail will not be available: ${missingExtra.join(", ")}`);
  const stats = exoStats(planets);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/planets.json.tmp`, JSON.stringify(planets));
  renameSync(`${OUT}/planets.json.tmp`, `${OUT}/planets.json`);
  writeFileSync(
    `${OUT}/SOURCES.md`,
    `# Exoplanet data\n\nSource: NASA Exoplanet Archive, table pscomppars (${origin}).\nBuilt: ${new Date().toISOString()}\nPlanets: ${planets.length}\nQuery: \`${query}\`\n\nThe composite table picks each parameter independently, so one row can mix values from different publications; each parameter's own reference is kept in \`u\`.\n${FIELD_DOC}\nThe archive asks users to acknowledge it: https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html\n\n## Build statistics\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\n`,
  );
  console.log(`exoplanets: ${planets.length} written (${origin})`);
  console.log(JSON.stringify(stats, null, 2));
  if (stats.duplicates) console.warn(`warning: ${stats.duplicates} duplicate planet name(s) in the data`);
}

main().catch((e) => { console.error(`build:exoplanets failed: ${e instanceof Error ? e.message : e}`); process.exit(1); });
