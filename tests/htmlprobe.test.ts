import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProbe, probeTables } from "../utils/htmlProbe";

// SYNTHETIC page, written only to exercise the probe. Names and numbers are placeholders, not satellite data.
const PAGE = `<html><head><style>td{}</style></head><body>
<h2>Satellites of Planet X</h2>
<h3>mean orbital elements referred to the local Laplace planes</h3>
<p>Epoch: 2000-01-01.5 TDB<br>Ephemeris: TEST001</p>
<table><tr><th>Satellite</th><th>a (km)</th><th>&omega; (deg)</th><th>i&nbsp;(deg)</th></tr>
<tr><td>Alpha</td><td>1,000</td><td>1.5</td><td>0.1</td></tr>
<tr><td>Beta</td><td>2,000</td><td>2.5</td><td><b>0.2</b></td></tr>
<tr><td>Gamma</td><td>3,000</td><td>3.5</td></tr></table>
<h2>Satellites of Planet Y</h2>
<p>mean ecliptic orbital elements</p>
<table><thead><tr><th>Name</th><th>a</th></tr></thead><tbody><tr><td>Delta</td><td>5</td></tr></tbody></table>
<script>var x = "<table><tr><td>not real</td></tr></table>";</script>
</body></html>`;

test("probe finds each real table with headings, labels, header cells, counts and first rows, and ignores tables inside scripts", () => {
  const t = probeTables(PAGE);
  assert.equal(t.length, 2, "the table-looking string inside <script> is not a table");
  assert.deepEqual(t[0].headerCells, ["Satellite", "a (km)", "ω (deg)", "i (deg)"], "entities decoded, nbsp normalised");
  assert.equal(t[0].rowCount, 3);
  assert.deepEqual(t[0].firstRows, [["Alpha", "1,000", "1.5", "0.1"], ["Beta", "2,000", "2.5", "0.2"]]);
  assert.equal(t[0].ragged, 1, "the Gamma row has 3 cells, not 4");
  assert.deepEqual(t[0].headings, ["Satellites of Planet X", "mean orbital elements referred to the local Laplace planes"]);
  assert.ok(t[0].textBefore.includes("Epoch: 2000-01-01.5 TDB") && t[0].textBefore.includes("Ephemeris: TEST001"), JSON.stringify(t[0].textBefore));
  assert.deepEqual(t[1].headerCells, ["Name", "a"], "thead/tbody tables work");
  assert.deepEqual(t[1].headings, ["Satellites of Planet X", "mean orbital elements referred to the local Laplace planes", "Satellites of Planet Y"].slice(-3));
  assert.ok(t[1].textBefore.includes("mean ecliptic orbital elements"));
});

test("report is plain text with every table's facts and does not interpret the data", () => {
  const r = formatProbe(probeTables(PAGE), "synthetic");
  for (const piece of ["Tables found: 2", "## Table 0", "## Table 1", 'Header cells (4): "Satellite", "a (km)"', "Data rows: 3", '"Alpha", "1,000"', "rows whose cell count differs from the header: 1"]) assert.ok(r.includes(piece), piece);
});

test("empty and table-free pages give no tables (the script then refuses to write a report)", () => {
  assert.deepEqual(probeTables(""), []);
  assert.deepEqual(probeTables("<p>no tables</p><script><table></table></script>"), []);
});
