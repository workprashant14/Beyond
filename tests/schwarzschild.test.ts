import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareSize, formatLength, horizon, schwarzschildRadiusKm } from "../utils/schwarzschild";
import { BLACK_HOLE_MASSES } from "../data/blackHoles";

const oracle = JSON.parse(readFileSync(new URL("./fixtures/schwarzschild_oracle.json", import.meta.url), "utf8")) as {
  cases: { id: string; mass: number; pm: number; r_km: number; low_km: number; high_km: number; r_codata_km: number }[];
};
const objects = JSON.parse(readFileSync(new URL("../data/objects.json", import.meta.url), "utf8")) as { id: string; category: string; mass: string | null; sources: { url: string }[] }[];
const rel = (a: number, b: number) => Math.abs(a - b) / b;

describe("Schwarzschild radius vs astropy", () => {
  for (const c of oracle.cases) {
    it(c.id, () => {
      assert.ok(rel(schwarzschildRadiusKm(c.mass), c.r_km) < 1e-8, "astropy uses the IAU nominal GM (1.3271244e20), DE440 differs by 3e-10");
      assert.ok(rel(schwarzschildRadiusKm(c.mass), c.r_codata_km) < 1e-4, "agrees with CODATA G*M within G's uncertainty");
      if (c.pm) {
        const h = horizon(c.mass, c.pm);
        assert.ok(rel(h.lowKm, c.low_km) < 1e-8 && rel(h.highKm, c.high_km) < 1e-8);
      }
    });
  }
  it("one solar mass is about 2.95 km", () => assert.ok(Math.abs(schwarzschildRadiusKm(1) - 2.953) < 0.001));
});

describe("formatting", () => {
  it("picks natural units", () => {
    assert.equal(formatLength(63), "63 km");
    assert.equal(formatLength(12.69e6), "13 million km");
    assert.equal(formatLength(19.2e9), "130 au");
  });
  it("compares sizes honestly", () => {
    assert.match(compareSize(62.6), /smaller than the Earth/);
    assert.match(compareSize(12.69e6), /18 times the Sun's radius/);
    assert.match(compareSize(19.2e9), /130 times the Earth-Sun distance/);
  });
});

describe("catalogue data", () => {
  it("every black hole in objects.json has a published mass entry, and the mass text and a source link agree", () => {
    const bhs = objects.filter((o) => o.category === "black-hole");
    assert.equal(bhs.length, 3);
    for (const o of bhs) {
      const m = BLACK_HOLE_MASSES[o.id];
      assert.ok(m, `no mass for ${o.id}`);
      assert.ok(m.plusMinus > 0 && m.plusMinus < m.mass);
      assert.equal(o.mass, m.massText);
      assert.ok(o.sources.some((s) => s.url === m.source.url), `${o.id} lists its mass source`);
    }
  });
});
