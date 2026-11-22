import { test } from "node:test";
import assert from "node:assert/strict";
import { getAllObjects } from "@/services/catalogue";
import { searchObjects, stem, editDistance } from "@/utils/search";

const all = getAllObjects();
const ids = (q: string, n = 8) => searchObjects(all, q, n).map((o) => o.id);

test("the required universal-search queries land on the right object first", () => {
  const first: Record<string, string> = {
    earth: "earth", mars: "mars", jupiter: "jupiter", sun: "sun", moon: "moon",
    "milky way": "milky-way", andromeda: "andromeda", "andromeda galaxy": "andromeda",
    m31: "andromeda", crab: "crab-nebula", sagittarius: "sgr-a", "sgr a*": "sgr-a", proxima: "proxima-b",
  };
  for (const [q, want] of Object.entries(first)) assert.equal(ids(q)[0], want, `query "${q}" -> ${ids(q).slice(0, 3)}`);
});

test("category queries return every object of that kind (singular, plural, odd plurals)", () => {
  // 3C 273's summary mentions a supermassive black hole, so it may follow as a weak hit; the three black holes come first.
  assert.deepEqual(new Set(ids("black holes").slice(0, 3)), new Set(["sgr-a", "m87", "cygnus-x1"]));
  assert.deepEqual(new Set(ids("black hole").slice(0, 3)), new Set(["sgr-a", "m87", "cygnus-x1"]));
  assert.ok(ids("black holes").slice(3).every((id) => id === "3c-273"), "only the quasar may follow");
  // The Crab Pulsar's text mentions the Crab Nebula, so it may follow as a weak hit; the three nebulae come first.
  for (const q of ["nebulae", "nebula"]) {
    assert.deepEqual(new Set(ids(q).slice(0, 3)), new Set(["orion-nebula", "crab-nebula", "eagle-nebula"]), q);
    assert.ok(ids(q).slice(3).every((id) => id === "crab-pulsar"), `${q}: only the pulsar may follow`);
  }
  // M87* may follow as a weak hit (its summary mentions "galaxy"), but the two galaxies come first.
  assert.deepEqual(new Set(ids("galaxies").slice(0, 4)), new Set(["milky-way", "andromeda", "triangulum", "lmc"]));
  assert.deepEqual(new Set(ids("exoplanets")), new Set(["proxima-b", "trappist-1e", "51-pegasi-b"]));
  assert.deepEqual(ids("planets", 20).slice(0, 8).sort(), ["earth", "jupiter", "mars", "mercury", "neptune", "saturn", "uranus", "venus"]);
  assert.ok(ids("planets", 20).slice(0, 8).every((id) => ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"].includes(id)), "real planets rank before exoplanets");
});

test("typos are forgiven for longer words, not for short ones", () => {
  assert.equal(ids("jupitor")[0], "jupiter");
  assert.equal(ids("andromdea")[0], "andromeda");
  assert.equal(ids("saturnn")[0], "saturn");
  assert.equal(ids("nebulea")[0] !== undefined, true);
  assert.deepEqual(ids("zzzqq"), []);
  assert.deepEqual(ids("mrs"), [], "3-letter typos are not guessed");
});

test("multi-word queries need every word to match", () => {
  assert.deepEqual(ids("red planet")[0], "mars");
  assert.equal(ids("black hole m87")[0], "m87");
  assert.deepEqual(ids("galaxy zzzqq"), []);
});

test("empty / whitespace / punctuation-only queries return nothing and never throw", () => {
  for (const q of ["", "   ", "!!!", "***"]) assert.deepEqual(ids(q), [], JSON.stringify(q));
  assert.doesNotThrow(() => searchObjects(all, "a".repeat(5000)));
});

test("helpers", () => {
  assert.equal(stem("nebulae"), "nebula");
  assert.equal(stem("galaxies"), "galaxy");
  assert.equal(stem("mars"), "mars");
  assert.equal(editDistance("jupitor", "jupiter", 2), 1);
  assert.equal(editDistance("abc", "xyzxyz", 2) > 2, true);
});

test("catalogue honesty: every object has sources, and no verified-looking value is an empty string", () => {
  for (const o of all) {
    assert.ok(o.sources.length > 0, `${o.id} has no source`);
    for (const k of ["diameter", "distance", "mass", "rotationPeriod", "orbitalPeriod", "temperature", "composition", "discovery"] as const) {
      assert.ok(o[k] === null || (typeof o[k] === "string" && o[k]!.trim() !== ""), `${o.id}.${k}`);
    }
    for (const r of o.related) assert.ok(all.some((x) => x.id === r), `${o.id} -> unknown related ${r}`);
  }
});

test("solar-system additions: unique ids, NASA-sourced, regions carry a provenance caveat, Oort Cloud is labelled theoretical", () => {
  const all = getAllObjects();
  assert.equal(new Set(all.map((o) => o.id)).size, all.length);
  for (const id of ["eris", "haumea", "makemake", "vesta", "67p", "asteroid-belt", "kuiper-belt", "oort-cloud"]) {
    const o = all.find((x) => x.id === id);
    assert.ok(o, id);
    assert.ok(o!.sources.length > 0 && o!.sources.every((s) => s.url.startsWith("https://science.nasa.gov/")), id);
    for (const r of o!.related) assert.ok(all.some((x) => x.id === r), `${id} -> ${r}`);
  }
  for (const id of ["asteroid-belt", "kuiper-belt", "oort-cloud"]) assert.ok(all.find((x) => x.id === id)!.caveat, id);
  assert.match(all.find((x) => x.id === "oort-cloud")!.caveat!, /THEORETICAL/);
  assert.equal(all.find((x) => x.id === "oort-cloud")!.category, "region");
});

test("missions: NASA-sourced, every one carries a dated-figures caveat, related ids resolve, live ids are in the Horizons table", async () => {
  const all = getAllObjects();
  const { HORIZONS_TARGET } = await import("../services/live/sources");
  const ids = ["voyager-1", "voyager-2", "jwst", "hubble", "parker-solar-probe", "new-horizons", "iss"];
  for (const id of ids) {
    const o = all.find((x) => x.id === id);
    assert.ok(o, id);
    assert.equal(o!.category, "spacecraft");
    assert.ok(o!.caveat && o!.caveat.length > 20, id);
    assert.ok(o!.sources.length > 0 && o!.sources.every((s) => s.url.startsWith("https://science.nasa.gov/")), id);
    for (const r of o!.related) assert.ok(all.some((x) => x.id === r), `${id} -> ${r}`);
  }
  // known contradictions on NASA's pages are surfaced, not silently resolved
  assert.match(all.find((x) => x.id === "voyager-2")!.caveat!, /25 Nov 2018.*10 Dec 2018/);
  assert.match(all.find((x) => x.id === "new-horizons")!.caveat!, /two different Pluto/);
  for (const id of ["voyager-1", "voyager-2", "new-horizons", "parker-solar-probe"]) assert.ok(HORIZONS_TARGET[id].command.startsWith("-"), id);
  assert.equal(HORIZONS_TARGET.iss, undefined);
});

test("compact objects: NASA-sourced, caveated, nothing stated beyond what the page says", () => {
  const all = getAllObjects();
  for (const id of ["crab-pulsar", "psr-j1748-2446ad", "3c-273"]) {
    const o = all.find((x) => x.id === id)!;
    assert.ok(o, id);
    assert.ok(["pulsar", "quasar"].includes(o.category));
    assert.ok(o.caveat && o.sources.length > 0 && o.sources.every((s) => s.url.startsWith("https://science.nasa.gov/")), id);
    for (const r of o.related) assert.ok(all.some((x) => x.id === r), `${id} -> ${r}`);
  }
  // facts NASA's pages do not give must stay empty
  const psr = all.find((x) => x.id === "psr-j1748-2446ad")!;
  assert.ok(psr.distance === null && psr.mass === null && psr.discovery === null);
  const q = all.find((x) => x.id === "3c-273")!;
  assert.ok(q.mass === null && q.diameter === null);
});
