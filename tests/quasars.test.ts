import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuasarCsv, detectColumns, queryQuasars } from "../utils/quasars";

// SYNTHETIC fixtures (invented names and numbers). They test the parser, not the real catalogue file.
const CSV = `SDSS_NAME,RA,DEC,Z,PSFMAG_i
Q000000.00+000000.0,10.5,0.25,1.5,18.2
Q000001.00-010000.0,11.5,-1.25,3.2,
Q000002.00+020000.0,12.5,2.25,0.4,17.1
`;

test("detects common column names and parses rows", () => {
  const r = parseQuasarCsv(CSV);
  assert.equal(r.columns.z, "Z"); assert.equal(r.columns.mag, "PSFMAG_i");
  assert.equal(r.quasars.length, 3);
  assert.deepEqual(r.quasars[1], { n: "Q000001.00-010000.0", ra: 11.5, dec: -1.25, z: 3.2, m: null });
});

test("explicit column overrides work and unknown overrides fail with the header list", () => {
  const r = parseQuasarCsv("obj;alpha;delta;redshift\nA;1;2;0.5\n", { name: "obj", ra: "alpha", dec: "delta", z: "redshift" });
  assert.equal(r.quasars[0].z, 0.5);
  assert.throws(() => detectColumns(["a", "b"], { ra: "nope" }), /not found; the file has: a, b/);
  assert.throws(() => parseQuasarCsv("a,b,c\n1,2,3\n"), /could not find a column/);
});

test("sexagesimal positions are rejected, bad rows are dropped and counted", () => {
  assert.throws(() => parseQuasarCsv("name,ra,dec,z\nQ,10 20 30,1,1\n"), /decimal degrees/);
  assert.throws(() => parseQuasarCsv("name,ra,dec,z\nQ,10:20:30,1,1\n"), /decimal degrees/);
  const r = parseQuasarCsv("name,ra,dec,z\nA,400,1,1\nB,10,95,1\n,10,1,1\nC,10,1,-1\n");
  assert.equal(r.dropped, 3);
  assert.equal(r.quasars.length, 1);
  assert.equal(r.quasars[0].z, null, "a negative redshift is not shown");
});

test("sorting puts unknown values last", () => {
  const all = parseQuasarCsv(CSV).quasars;
  assert.equal(queryQuasars(all, { text: "", sort: "redshift-high" })[0].z, 3.2);
  assert.equal(queryQuasars(all, { text: "", sort: "redshift-low" })[0].z, 0.4);
  const bright = queryQuasars(all, { text: "", sort: "bright" });
  assert.equal(bright[0].m, 17.1); assert.equal(bright[2].m, null);
  assert.equal(queryQuasars(all, { text: "q000002", sort: "name" }).length, 1);
});
