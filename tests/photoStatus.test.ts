import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolvePhoto, loadingState, type IndexResult } from "../universe/objects/photoStatus";
import type { TextureIndexEntry } from "../data/textureManifest";
import { toAsciiJson } from "../scripts/build-textures";

const entry = (id: string): TextureIndexEntry => ({ id, file: `${id}.jpg`, title: `T ${id}`, credit: "NASA/JPL", page: "https://www.nasa.gov/x", nature: "Not calibrated." } as TextureIndexEntry);
const index = (...ids: string[]): IndexResult => ({ generated: "t", textures: ids.map(entry) } as IndexResult);
const okImg = async () => "TEX";

test("loaded: image decoded -> attribution metadata present and tied to the id", async () => {
  const s = await resolvePhoto("jupiter", async () => index("jupiter"), okImg);
  assert.equal(s.status, "loaded"); assert.equal(s.id, "jupiter");
  assert.equal(s.meta?.credit, "NASA/JPL"); assert.equal(s.texture, "TEX");
});

test("missing: no index file or no entry -> procedural fallback, no credit", async () => {
  for (const idx of [null, index("moon")] as IndexResult[]) {
    const s = await resolvePhoto("jupiter", async () => idx, okImg);
    assert.equal(s.status, "missing"); assert.equal(s.meta, null); assert.equal(s.texture, null);
  }
});

test("error: image fails (null or throws) -> no false attribution", async () => {
  for (const load of [async () => null, async () => { throw new Error("boom"); }]) {
    const s = await resolvePhoto("jupiter", async () => index("jupiter"), load);
    assert.equal(s.status, "error"); assert.equal(s.meta, null); assert.equal(s.texture, null);
  }
});

test("error: index request fails, throws, or entry is malformed -> no credit, no crash", async () => {
  assert.equal((await resolvePhoto("moon", async () => "error", okImg)).status, "error");
  assert.equal((await resolvePhoto("moon", async () => { throw new Error("net"); }, okImg)).status, "error");
  const bad = { generated: "t", textures: [{ id: "moon", file: "moon.jpg" }] } as unknown as IndexResult;
  const s = await resolvePhoto("moon", async () => bad, okImg);
  assert.equal(s.status, "error"); assert.equal(s.meta, null);
  const notArray = { generated: "t", textures: "x" } as unknown as IndexResult;
  assert.equal((await resolvePhoto("moon", async () => notArray, okImg)).status, "missing");
});

test("state and metadata always belong to the requested body id", async () => {
  const idx = async () => index("moon", "jupiter");
  const [a, b] = await Promise.all([resolvePhoto("moon", idx, okImg), resolvePhoto("jupiter", idx, okImg)]);
  assert.equal(a.id, "moon"); assert.equal(a.meta?.id, "moon");
  assert.equal(b.id, "jupiter"); assert.equal(b.meta?.id, "jupiter");
  const l = loadingState("mars"); assert.equal(l.id, "mars"); assert.equal(l.status, "loading"); assert.equal(l.meta, null);
});

test("toAsciiJson: ASCII only, round-trips exactly, keeps ° ± —", () => {
  const v = { a: "360° ±90° — x" };
  const out = toAsciiJson(v);
  assert.ok(/^[\x00-\x7f]*$/.test(out)); assert.ok(out.includes("\\u00b0"));
  assert.deepEqual(JSON.parse(out), v);
});

function walk(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "raw"].includes(n)) continue;
    const p = join(dir, n); const st = statSync(p);
    if (st.isDirectory()) walk(p, acc); else if (/\.(ts|tsx|json|md|css|mjs)$/.test(n) && st.size < 2_000_000) acc.push(p);
  }
  return acc;
}

test("source text is valid UTF-8, has no BOM, and the affected strings are correct", () => {
  const root = join(__dirname, "..");
  const moji = /â€|Â[°±·]|Ã[©¨¡]/;
  for (const f of walk(root)) {
    if (/tests[\\/]photoStatus\.test\.ts$|ATLAS_ROADMAP\.md$|build-textures\.ts$/.test(f)) continue; // these mention the patterns on purpose
    const buf = readFileSync(f);
    assert.ok(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), `${f} has a BOM`);
    const txt = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    assert.ok(!moji.test(txt), `${f} contains mojibake`);
  }
  const manifest = readFileSync(join(root, "data/textureManifest.ts"), "utf8");
  assert.ok(manifest.includes("360°") && manifest.includes("±90°"));
  assert.ok(readFileSync(join(root, "components/ObjectInfoPanel.tsx"), "utf8").includes("yet — it arrives"));
  const idx = join(root, "public/textures/index.json");
  if (existsSync(idx)) assert.ok(/^[\x00-\x7f]*$/.test(readFileSync(idx, "utf8")), "generated index.json must be ASCII-escaped");
});
