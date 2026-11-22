/**
 * Builds public/smallbodies/bodies.json from the JPL Small-Body Database query API.
 * Run on your own computer (needs internet):
 *   npm run build:smallbodies                      # 1,000 brightest numbered asteroids + 200 comets
 *   npm run build:smallbodies -- --asteroids 2000 --comets 300
 *   npm run build:smallbodies -- --ast-file a.json --com-file c.json   # use responses you saved yourself
 * Asteroids: numbered, sorted by absolute magnitude H (brightest first).
 * Comets: sorted by perihelion distance q, but only rows with e below 0.999999999 or above 1.000000001 and with i, om, w, tp, q defined
 * (COMET_CONSTRAINT in utils/smallBodies.ts). Reason: the smallest-q comets are mostly SOHO sungrazers with exactly parabolic orbits, which the
 * parser rightly rejects, so an unfiltered query returned almost nothing usable. Elliptical and hyperbolic orbits are both kept.
 * The parser still drops (and counts) any parabolic or incomplete row that gets through. The old file is replaced only after parsing succeeded
 * (written to a .tmp file, then renamed).
 * The JPL pages state no licence; the data are public NASA/JPL products. Please cite the JPL Small-Body Database.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { cometQueryUrl, parseSbdbQuery, type SmallBody, type SmallBodyFile } from "../utils/smallBodies";

const ENDPOINT = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const count = (n: string, d: number) => { const v = arg(n) === undefined ? d : Number(arg(n)); if (!Number.isInteger(v) || v < 1 || v > 10_000) throw new Error(`${n} must be a whole number from 1 to 10000`); return v; };

const A_FIELDS = "full_name,spkid,a,e,i,om,w,ma,epoch,per,H,diameter";
const C_FIELDS = "full_name,spkid,e,i,om,w,epoch,tp,q,H";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const nA = count("--asteroids", 1000), nC = count("--comets", 200);
  const aUrl = `${ENDPOINT}?fields=${A_FIELDS}&sb-kind=a&sb-ns=n&sort=H&limit=${nA}&full-prec=true`;
  const cUrl = cometQueryUrl(ENDPOINT, C_FIELDS, nC);
  const aJson = arg("--ast-file") ? JSON.parse(readFileSync(arg("--ast-file")!, "utf8")) : await getJson(aUrl);
  const cJson = arg("--com-file") ? JSON.parse(readFileSync(arg("--com-file")!, "utf8")) : await getJson(cUrl);
  const a = parseSbdbQuery(aJson, "a"), c = parseSbdbQuery(cJson, "c");
  console.log(`asteroids: ${a.bodies.length} kept, ${a.dropped} dropped; comets: ${c.bodies.length} kept, ${c.dropped} dropped (parabolic or incomplete)`);
  if (a.bodies.length < 10) throw new Error("fewer than 10 asteroids parsed; keeping the existing file");
  const bodies: SmallBody[] = [...a.bodies, ...c.bodies];
  const file: SmallBodyFile = { meta: { source: "JPL Small-Body Database query API (ssd-api.jpl.nasa.gov)", built: new Date().toISOString(), asteroids: a.bodies.length, comets: c.bodies.length, query: `${aUrl} | ${cUrl}` }, bodies };
  mkdirSync("public/smallbodies", { recursive: true });
  writeFileSync("public/smallbodies/bodies.json.tmp", JSON.stringify(file));
  renameSync("public/smallbodies/bodies.json.tmp", "public/smallbodies/bodies.json");
  console.log(`written ${bodies.length} bodies to public/smallbodies/bodies.json`);
}

main().catch((e) => { console.error(`build:smallbodies failed: ${e instanceof Error ? e.message : e}`); process.exit(1); });
