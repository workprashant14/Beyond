import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPython, runPython } from "./helpers/runtime";
import {
  QuasarCatalog, designationRaRange, normaliseDesignation, conePruneChunks, sepDeg, sentinelFor, isChunkedMeta, type Fetchers, type CatalogMeta,
} from "../utils/quasarCatalog";

// Everything here uses a SYNTHETIC FITS file (invented values, a few real DR16Q column names) built by tests/helpers/make_synthetic_dr16q.py.
// It tests the pipeline and loader, not the real SDSS catalogue. Needs Python with astropy and numpy (pip install astropy numpy).
// Without them the pipeline tests are SKIPPED and node:test reports them as skipped (they are not counted as passed); the pure helper
// test at the end always runs.
const N = 1500;
const root = join(__dirname, "..");
let dir = "", outA = "", outB = "";
const PYTHON = findPython(["astropy", "numpy"]); // python3, python, or the Windows launcher `py -3`, whichever can import both
const SKIP = PYTHON ? false : "python with astropy and numpy not found (tried python3, python, py -3): pip install astropy numpy";
if (SKIP) console.warn(`WARNING: quasar pipeline tests skipped (${SKIP})`);
const py = (args: string[]) => runPython(PYTHON ?? { cmd: "python3", pre: [] }, args, root);
const build = (out: string, extra: string[] = []) => {
  const r = py(["scripts/build_quasars_fits.py", "--fits", join(dir, "s.fits"), "--out", out, "--chunk", "8", "--detail-chunk", "50", "--list-chunk", "100", "--built", "2000-01-01", ...extra]);
  assert.equal(r.status, 0, `builder failed:\n${r.stderr}`);
  return r.stderr;
};
const files = (out: string): Fetchers => ({
  getJson: async (p) => JSON.parse(readFileSync(join(out, p), "utf8")),
  getBytes: async (p) => { const b = readFileSync(join(out, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; },
});

before(() => {
  if (SKIP) return;
  dir = mkdtempSync(join(tmpdir(), "beyond-q-"));
  outA = join(dir, "a"); outB = join(dir, "b");
  const mk = py(["tests/helpers/make_synthetic_dr16q.py", join(dir, "s.fits"), String(N)]);
  assert.equal(mk.status, 0, mk.stderr);
  build(outA); build(outB);
});

test("record counts: input rows = output records = index rows = detail rows; nothing dropped", { skip: SKIP }, async () => {
  const cat = await QuasarCatalog.open(files(outA));
  const m = cat.meta;
  assert.ok(isChunkedMeta(m));
  assert.equal(m.counts.input_rows, N); assert.equal(m.counts.output_records, N); assert.equal(m.count, N);
  assert.equal(m.input.columns, 8); assert.equal(m.columns.length, 8);
  let idx = 0, unplaced = 0;
  for (let i = 0; i < m.chunks.length; i++) { const c = await cat.chunk(i); idx += c.n.length; unplaced += c.ra.filter((r, k) => r === null || c.dec[k] === null).length; }
  assert.equal(idx, N); assert.equal(unplaced, 1); assert.equal(m.counts.unplaced_no_valid_ra_dec, 1);
  let detail = 0;
  for (const f of readdirSync(join(outA, "detail"))) detail += JSON.parse(readFileSync(join(outA, "detail", f), "utf8")).rows.length;
  assert.equal(detail, N);
  assert.equal(m.counts.duplicate_names, 1, "duplicates are reported, not removed");
});

test("chunk consistency: contiguous positions, size limit, one band per chunk, bounding boxes hold their records", { skip: SKIP }, async () => {
  const cat = await QuasarCatalog.open(files(outA));
  let next = 0;
  for (let i = 0; i < cat.meta.chunks.length; i++) {
    const info = cat.meta.chunks[i], c = await cat.chunk(i);
    assert.equal(info.pos0, next); assert.ok(info.n >= 1 && info.n <= cat.meta.chunkMax); next += info.n;
    c.ra.forEach((r, k) => {
      if (r === null) { assert.equal(info.band, 99); return; }
      assert.ok(r >= info.ra0! && r <= info.ra1!); assert.ok(c.dec[k]! >= info.dec0! && c.dec[k]! <= info.dec1!);
      assert.equal(Math.min(35, Math.floor((c.dec[k]! + 90) / 5)), info.band);
    });
  }
  assert.equal(next, N);
});

test("deterministic: two builds of the same input are byte-identical", { skip: SKIP }, () => {
  const read = (o: string, sub: string) => readdirSync(join(o, sub)).sort().map((f) => readFileSync(join(o, sub, f), "utf8")).join("|");
  assert.equal(read(outA, "index"), read(outB, "index"));
  assert.equal(read(outA, "detail"), read(outB, "detail"));
  assert.equal(readFileSync(join(outA, "meta.json"), "utf8"), readFileSync(join(outB, "meta.json"), "utf8"));
  assert.equal(read(outA, "lists/z"), read(outB, "lists/z")); assert.equal(read(outA, "lists/mag"), read(outB, "lists/mag"));
});

test("index-to-detail consistency; nulls and sentinels follow the documented rules", { skip: SKIP }, async () => {
  const cat = await QuasarCatalog.open(files(outA));
  const col = (n: string) => cat.meta.columns.findIndex((c) => c.name === n);
  const seen = { zNull: 0, zNeg: 0, flagNull: 0, vi999: 0, badMag: 0 };
  for (let pos = 0; pos < N; pos++) {
    const r = await cat.recordAt(pos), d = await cat.detail(pos), v = (n: string) => d[col(n)].value;
    assert.equal(r.name, v("SDSS_NAME")); assert.equal(r.ra, v("RA")); assert.equal(r.dec, v("DEC")); assert.equal(r.z, v("Z")); assert.equal(r.flag, v("IS_QSO_FINAL"));
    assert.equal(r.m, (v("PSFMAG") as (number | null)[])[3]);
    if (r.z === null) seen.zNull++; else if (r.z < 0) seen.zNeg++;
    if (r.flag === null) seen.flagNull++;
    if (v("Z_VI") === -999) seen.vi999++;
    if (r.m !== null && r.m < 0) seen.badMag++;
  }
  assert.deepEqual(seen, { zNull: 1, zNeg: 1, flagNull: 1, vi999: 1, badMag: 1 }, "NaN and TNULL become null; -1, -999 and -9999 are stored unchanged");
  const unit = cat.meta.columns[col("RA")].unit; assert.equal(unit, "deg");
  assert.equal(cat.meta.columns[col("IS_QSO_FINAL")].null, -2147483648);
});

test("redshift and brightness ordering are complete, sorted, and leave nothing out silently", { skip: SKIP }, async () => {
  const cat = await QuasarCatalog.open(files(outA));
  const hi = await cat.page("z-high", 0, N), lo = await cat.page("z-low", 0, N);
  assert.equal(hi.length, N - 1, "the one record without a redshift is not in the redshift ordering");
  assert.ok(hi.every((r, i) => i === 0 || hi[i - 1].z! >= r.z!));
  assert.deepEqual(lo.map((r) => r.pos), hi.map((r) => r.pos).reverse());
  assert.equal(hi.some((r) => r.z === -1), true, "a negative redshift is kept and sorted as a number");
  const br = await cat.page("bright", 0, N);
  assert.equal(br.length, N - 1); assert.equal(cat.meta.counts.magnitude_not_ordered, 1);
  assert.ok(br.every((r, i) => (i === 0 || br[i - 1].m! <= r.m!) && r.m! > 0));
  assert.equal(new Set(hi.map((r) => r.pos)).size, hi.length, "no duplicate positions");
  assert.deepEqual((await cat.page("position", 10, 5)).map((r) => r.pos), [10, 11, 12, 13, 14]);
  assert.deepEqual(await cat.page("z-high", N, 10), [], "past the end");
  const across = await cat.page("z-high", 95, 10);
  assert.deepEqual(across.map((r) => r.pos), hi.slice(95, 105).map((r) => r.pos), "a page that crosses two list files");
  const f2 = files(outA); const seen: string[] = [];
  const c2 = await QuasarCatalog.open({ ...f2, getJson: async (p) => { seen.push(p); return f2.getJson(p); } });
  await c2.page("z-high", 0, 50);
  assert.equal(seen.filter((p) => p.startsWith("index/")).length, 0, "a redshift page needs no index chunks");
  assert.equal(seen.filter((p) => p.startsWith("lists/")).length, 1, "and only one list file");
});

test("designation search finds records by prefix and exact name using only the chunks it needs", { skip: SKIP }, async () => {
  const loaded: string[] = [];
  const f = files(outA);
  const cat = await QuasarCatalog.open({ ...f, getJson: async (p) => { loaded.push(p); return f.getJson(p); } });
  const target = (await cat.recordAt(700));
  const exact = await cat.searchDesignation(`SDSS J${target.name}`);
  assert.ok(exact && exact.some((r) => r.pos === 700), "exact designation, with SDSS J prefix");
  const hourPrefix = target.name.slice(0, 2);
  const byHour = (await cat.searchDesignation(hourPrefix, 5000))!;
  assert.ok(byHour.length > 20 && byHour.every((r) => r.name.startsWith(hourPrefix)));
  assert.ok(byHour.some((r) => r.pos === 700));
  const idxLoads = loaded.filter((p) => p.startsWith("index/")).length;
  assert.ok(idxLoads < cat.meta.chunks.length, `search loaded ${idxLoads} of ${cat.meta.chunks.length} chunks`);
  assert.equal(await cat.searchDesignation("hello world"), null, "text that is not a designation is not guessed");
});

test("cone search equals a brute-force scan and loads fewer chunks than the whole catalogue", { skip: SKIP }, async () => {
  const f = files(outA);
  const loaded = new Set<string>();
  const cat = await QuasarCatalog.open({ ...f, getJson: async (p) => { loaded.add(p); return f.getJson(p); } });
  const all = await cat.page("position", 0, N);
  for (const [ra, dec, r] of [[120, 30, 12], [5, -40, 20], [358, 10, 15], [10, 89, 6], [200, -89, 5]] as const) {
    const brute = all.filter((x) => x.ra !== null && sepDeg(ra, dec, x.ra, x.dec!) <= r).map((x) => x.pos).sort((a, b) => a - b);
    const got = (await cat.cone(ra, dec, r, 100000)).map((x) => x.pos).sort((a, b) => a - b);
    assert.deepEqual(got, brute, `cone ${ra},${dec},${r}`);
  }
  const small = conePruneChunks(cat.meta, 120, 30, 3);
  assert.ok(small.length > 0 && small.length < cat.meta.chunks.length / 4, `pruned to ${small.length} of ${cat.meta.chunks.length}`);
  await assert.rejects(() => cat.cone(10, 95, 1), RangeError);
  await assert.rejects(() => cat.cone(10, 10, 0), RangeError);
});

test("errors: bad positions and missing files are reported, a failed chunk is retried", { skip: SKIP }, async () => {
  const f = files(outA);
  let fail = true;
  const cat = await QuasarCatalog.open({ ...f, getJson: async (p) => { if (p === "index/0000.json" && fail) throw new Error("network"); return f.getJson(p); } });
  await assert.rejects(() => cat.recordAt(0), /network/);
  fail = false;
  assert.equal((await cat.recordAt(0)).pos, 0, "after a failure the chunk is requested again");
  await assert.rejects(() => cat.recordAt(N), RangeError);
  await assert.rejects(() => cat.recordAt(-1), RangeError);
  await assert.rejects(() => QuasarCatalog.open({ ...f, getJson: async () => ({ format: "legacy" }) }), /not a chunked/);
  const noDetail = join(dir, "nd"); build(noDetail, ["--detail", "none"]);
  const nd = await QuasarCatalog.open(files(noDetail));
  assert.equal(nd.meta.hasDetail, false);
  await assert.rejects(() => nd.detail(0), /no detail files/);
});

test("designation helpers need no Python: ranges and normalisation", () => {
  const [a, b] = designationRaRange("0012")!;
  assert.ok(a > 2.99 && a < 3.01 && b > 3.2 && b < 3.3, `${a} ${b}`);
  const [c, d] = designationRaRange("SDSS J001234.5+01")!; assert.ok(c < 3.1438 && d > 3.1438 && d - c < 0.01);
  assert.equal(normaliseDesignation("Sirius"), null);
  assert.equal(designationRaRange("hello"), null);
  assert.equal(sepDeg(10, 20, 10, 20), 0); assert.ok(Math.abs(sepDeg(0, 0, 90, 0) - 90) < 1e-9);
});

test("helpers: sentinel notes and bounded cache", { skip: SKIP }, async () => {
  const cat = await QuasarCatalog.open(files(outA));
  assert.match(sentinelFor(cat.meta, "Z_VI") ?? "", /-999/); assert.equal(sentinelFor(cat.meta, "RA"), null);
  assert.match(sentinelFor(cat.meta, "FIRST_MATCHED") ?? "", /found in that catalogue/i);
  const small = new QuasarCatalog(cat.meta, files(outA), 2);
  for (const pos of [0, 150, 300, 450]) await small.recordAt(pos);
  assert.ok((small as unknown as { chunks: Map<number, unknown> }).chunks.size <= 2);
  const m: CatalogMeta = cat.meta; assert.ok(m.citation.includes("2020ApJS"));
});
