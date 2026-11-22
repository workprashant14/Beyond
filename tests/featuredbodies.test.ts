import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURED, parseFullName, pickFeatured } from "../utils/featuredBodies";
import type { SmallBody } from "../utils/smallBodies";

// SYNTHETIC records: names are real, but the orbital numbers are placeholders for plumbing tests only. They are never shown to users.
const rec = (n: string, k: "a" | "c" = "a"): SmallBody => ({ id: n, n, k, a: 2.7, e: 0.1, i: 5, om: 10, w: 20, ma: 30, ep: 2460000.5, per: 1600, H: 3, d: 500 });

test("parseFullName handles JPL-style padded names, provisional designations and comets", () => {
  assert.deepEqual(parseFullName("     1 Ceres"), { number: 1, name: "Ceres" });
  assert.deepEqual(parseFullName("134340 Pluto (1930 BA)"), { number: 134340, name: "Pluto" });
  assert.deepEqual(parseFullName("433 Eros (A898 PA)"), { number: 433, name: "Eros" });
  assert.equal(parseFullName("1P/Halley"), null);
  assert.equal(parseFullName("(2020 AB1)"), null);
  assert.equal(parseFullName(""), null);
});

test("the featured list is the five IAU dwarf planets plus Vesta, Pallas, Hygiea, with unique numbers", () => {
  assert.deepEqual(FEATURED.filter((f) => f.kind === "dwarf-planet").map((f) => f.name).sort(), ["Ceres", "Eris", "Haumea", "Makemake", "Pluto"]);
  assert.deepEqual(FEATURED.filter((f) => f.kind === "asteroid").map((f) => f.name).sort(), ["Hygiea", "Pallas", "Vesta"]);
  assert.equal(new Set(FEATURED.map((f) => f.number)).size, FEATURED.length);
});

test("pickFeatured: finds by number and name, reports the rest as missing, ignores comets and mismatches", () => {
  const bodies = [rec("     1 Ceres"), rec("134340 Pluto (1930 BA)"), rec("   433 Eros (A898 PA)"), rec("     4 Notvesta"), rec("2 Pallas", "c")];
  const { found, missing } = pickFeatured(bodies);
  assert.deepEqual(found.map((f) => f.spec.name), ["Pluto", "Ceres"]);
  assert.deepEqual(missing.map((m) => m.name).sort(), ["Eris", "Haumea", "Hygiea", "Makemake", "Pallas", "Vesta"]);
  assert.equal(found[0].body.n, "134340 Pluto (1930 BA)");
  assert.deepEqual(pickFeatured([]).found, []);
  assert.equal(pickFeatured([]).missing.length, FEATURED.length);
});
