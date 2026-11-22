import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePsrcat, queryPulsars, MSP_SECONDS } from "../utils/pulsars";

// SYNTHETIC fixtures (invented names and numbers) that follow the documented parameter names. They test the parser, not the real file.
const SEMI = `# ATNF test export
NUMBER;NAME;JNAME;RAJD;DECJD;P0;DM;DIST
1;B0000+00;J0000+0000;10.5;20.25;0.5;30.1;1.2
2;*;J0001+0001;11.5;-21.25;0.0015;*;*
3;*;J0002+0002;12.5;22.25;1.5;40;0.4
`;

test("parses a semicolon-separated export: names, numbers, missing values", () => {
  const p = parsePsrcat(SEMI);
  assert.equal(p.length, 3);
  assert.deepEqual(p[0], { n: "J0000+0000", b: "B0000+00", ra: 10.5, dec: 20.25, p: 0.5, dm: 30.1, d: 1.2 });
  assert.equal(p[1].b, null); assert.equal(p[1].dm, null); assert.equal(p[1].d, null);
  assert.equal(p[1].dec, -21.25);
});

test("column order does not matter and a comma export works too", () => {
  const p = parsePsrcat("P0,JName,RAJD,DecJD\n0.1,J1,1,2\n0.2,J2,3,4\n");
  assert.equal(p.length, 2);
  assert.equal(p[1].p, 0.2); assert.equal(p[1].n, "J2");
});

test("a missing required column or header fails loudly", () => {
  assert.throws(() => parsePsrcat("JNAME;RAJD;DECJD\nJ1;1;2\n"), /P0/);
  assert.throws(() => parsePsrcat("nothing useful here\n1;2;3"), /JName/);
});

test("rows without a name are dropped; junk numbers become null", () => {
  const p = parsePsrcat("JNAME;RAJD;DECJD;P0\n;1;2;3\nJ9;x;2;0.3\n");
  assert.equal(p.length, 1);
  assert.equal(p[0].ra, null);
});

test("filter, class split and sorting", () => {
  const all = parsePsrcat(SEMI);
  assert.deepEqual(queryPulsars(all, { text: "", kind: "msp", sort: "name" }).map((x) => x.n), ["J0001+0001"]);
  assert.equal(queryPulsars(all, { text: "", kind: "slow", sort: "name" }).length, 2);
  assert.deepEqual(queryPulsars(all, { text: "", kind: "", sort: "period" }).map((x) => x.n)[0], "J0001+0001");
  assert.deepEqual(queryPulsars(all, { text: "", kind: "", sort: "distance" }).map((x) => x.n), ["J0002+0002", "J0000+0000", "J0001+0001"]);
  assert.deepEqual(queryPulsars(all, { text: "b0000", kind: "", sort: "name" }).map((x) => x.n), ["J0000+0000"]);
  assert.ok(MSP_SECONDS === 0.03);
});
