import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { datasetStatus, formatStatus } from "../scripts/data-status";

// SYNTHETIC fixture directories: they test the reporting logic only.
const dir = () => mkdtempSync(join(tmpdir(), "beyond-ds-"));
const put = (root: string, f: string, v: unknown) => { mkdirSync(join(root, f, ".."), { recursive: true }); writeFileSync(join(root, f), typeof v === "string" ? v : JSON.stringify(v)); };
const get = (root: string, name: string) => datasetStatus(root).find((r) => r.name === name)!;

test("empty directory: every dataset is reported missing, nothing throws", () => {
  const rows = datasetStatus(dir());
  assert.equal(rows.length, 11);
  assert.ok(rows.every((r) => r.state === "missing" && r.count === null && r.fix.length > 0));
});

test("the real bundled data matches the audit: sky catalogues ok, nothing else pretends to be", () => {
  const rows = datasetStatus("public");
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.deepEqual([by["Stars (Hipparcos)"].count, by["Constellations"].count, by["Deep-sky objects"].count, by["Moons"].count], [5044, 88, 12094, 177]);
  assert.equal(by["Star physical data"].state, "ok"); assert.match(by["Star physical data"].detail, /proper motion 5041/);
  // Surface photographs and small bodies are built on the user's own machine (`npm run build:textures`, `npm run build:smallbodies`),
  // so a fresh copy ships placeholders. The shipped placeholder is recognised from the files themselves (not from datasetStatus):
  // with real data installed the exact expectations below are enforced; with placeholders the placeholder state is enforced.
  const textures = JSON.parse(readFileSync("public/textures/index.json", "utf8")) as { textures: unknown[] };
  const bodies = JSON.parse(readFileSync("public/smallbodies/bodies.json", "utf8")) as { meta: { source: string } };
  if (textures.textures.length > 0) {
    assert.deepEqual([by["Surface photographs"].state, by["Surface photographs"].count], ["ok", 2]);
  } else {
    assert.equal(by["Surface photographs"].state, "placeholder");
  }
  if (bodies.meta.source !== "none") {
    assert.deepEqual([by["Asteroids and comets"].state, by["Asteroids and comets"].count], ["ok", 1200]);
  } else {
    assert.equal(by["Asteroids and comets"].state, "placeholder");
  }
});

test("invalid JSON, wrong shape and empty lists are told apart", () => {
  const r = dir();
  put(r, "sky/stars.json", "{not json"); put(r, "sky/constellations.json", { a: 1 }); put(r, "solar/moons.json", []);
  assert.equal(get(r, "Stars (Hipparcos)").state, "invalid");
  assert.equal(get(r, "Constellations").state, "invalid");
  assert.equal(get(r, "Moons").state, "empty");
  put(r, "sky/dsos-bright.json", { n: 3 }); assert.equal(get(r, "Deep-sky objects").state, "missing");
  put(r, "sky/dsos-faint.json", { n: 4 }); assert.deepEqual([get(r, "Deep-sky objects").state, get(r, "Deep-sky objects").count], ["ok", 7]);
});

test("small bodies: placeholder vs real; textures: placeholder vs installed", () => {
  const r = dir();
  put(r, "smallbodies/bodies.json", { meta: { source: "none", asteroids: 0, comets: 0 }, bodies: [] });
  assert.equal(get(r, "Asteroids and comets").state, "placeholder");
  put(r, "smallbodies/bodies.json", { meta: { source: "JPL", built: "2026-01-01", asteroids: 2, comets: 1 }, bodies: [{}, {}, {}] });
  assert.deepEqual([get(r, "Asteroids and comets").state, get(r, "Asteroids and comets").count], ["ok", 3]);
  put(r, "textures/index.json", { textures: [] }); assert.equal(get(r, "Surface photographs").state, "placeholder");
  put(r, "textures/index.json", { textures: [{ id: "moon" }] }); assert.deepEqual([get(r, "Surface photographs").state, get(r, "Surface photographs").count], ["ok", 1]);
});

test("quasars: full chunked build, TEST BUILD, count mismatch, legacy subset", () => {
  const r = dir();
  const chunked = (o: Record<string, unknown>) => ({ format: "chunked", hasDetail: true, input: { file: "DR16Q_v4.fits", test_limit: null }, counts: { input_rows: 750414, output_records: 750414, unplaced_no_valid_ra_dec: 0 }, ...o });
  put(r, "quasars/meta.json", chunked({})); const ok = get(r, "Quasars");
  assert.deepEqual([ok.state, ok.count], ["ok", 750414]); assert.match(ok.detail, /DR16Q_v4\.fits/);
  put(r, "quasars/meta.json", chunked({ input: { file: "x", test_limit: 5000 }, counts: { input_rows: 750414, output_records: 5000 } }));
  assert.equal(get(r, "Quasars").state, "test-build"); assert.match(get(r, "Quasars").detail, /5000 of 750414/);
  put(r, "quasars/meta.json", chunked({ counts: { input_rows: 750414, output_records: 700000 } }));
  assert.equal(get(r, "Quasars").state, "invalid"); assert.match(get(r, "Quasars").detail, /differ/);
  put(r, "quasars/meta.json", { source: "SDSS", band: "i", built: "x", count: 1200 });
  assert.match(get(r, "Quasars").detail, /not the full catalogue/);
  put(r, "quasars/meta.json", { format: "chunked", counts: {} }); assert.equal(get(r, "Quasars").state, "invalid");
});

test("formatStatus lists every dataset and a fix command for anything not ok", () => {
  const text = formatStatus(datasetStatus(dir()));
  assert.equal(text.split("\n").filter((l) => l.includes("fix:")).length, 11);
  assert.match(text, /MISSING\s+Quasars/);
});
