import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MISSIONS } from "../data/missions";
import { elapsedSince, formatDuration, formatElapsed, lightTimeHours } from "../utils/missions";

const objects = JSON.parse(readFileSync(new URL("../data/objects.json", import.meta.url), "utf8")) as { id: string; category: string; discovery: string | null; distance: string | null }[];
const oracle = JSON.parse(readFileSync(new URL("./fixtures/lighttime_oracle.json", import.meta.url), "utf8")) as { au: number; hours: number }[];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

describe("light travel time vs astropy", () => {
  for (const c of oracle) it(`${c.au} au`, () => assert.ok(Math.abs(lightTimeHours(c.au) - c.hours) / c.hours < 1e-12));
  it("formats", () => {
    assert.equal(formatDuration(22.829), "22.8 hours");
    assert.equal(formatDuration(0.5), "30 minutes");
  });
});

describe("elapsed time", () => {
  const v1 = { launch: "1977-09-05", precision: "day" as const };
  it("before and on the anniversary", () => {
    assert.deepEqual(elapsedSince(v1, new Date("2026-09-04T12:00:00Z")), { years: 48, days: 364, approx: false });
    assert.deepEqual(elapsedSince(v1, new Date("2026-09-05T00:00:00Z")), { years: 49, days: 0, approx: false });
  });
  it("leap-day anniversary arithmetic is whole days from the last anniversary", () => {
    const e = elapsedSince({ launch: "2020-02-29", precision: "day" }, new Date("2023-03-01T00:00:00Z"));
    assert.equal(e.years, 3);
    assert.ok(e.days !== null && e.days >= 0 && e.days <= 1);
  });
  it("month and year precision give whole years, marked approximate", () => {
    assert.deepEqual(elapsedSince({ launch: "1998-11", precision: "month" }, new Date("2026-11-17T00:00:00Z")), { years: 28, days: null, approx: true });
    assert.deepEqual(elapsedSince({ launch: "1998-11", precision: "month" }, new Date("2026-10-31T00:00:00Z")).years, 27);
    assert.deepEqual(elapsedSince({ launch: "1990", precision: "year" }, new Date("2026-11-17T00:00:00Z")), { years: 36, days: null, approx: true });
  });
  it("formats", () => {
    assert.equal(formatElapsed({ years: 1, days: 1, approx: false }), "1 year and 1 day");
    assert.equal(formatElapsed({ years: 36, days: null, approx: true }), "about 36 years");
  });
});

describe("mission facts agree with the catalogue text they were copied from", () => {
  for (const m of MISSIONS) {
    const o = objects.find((x) => x.id === m.id);
    it(m.id, () => {
      assert.ok(o && o.category === "spacecraft");
      const [y, mo, d] = m.launch.split("-");
      const text = o!.discovery ?? "";
      assert.ok(text.includes(y), `year ${y} in "${text}"`);
      if (m.precision === "day") assert.ok(text.includes(`${+d} ${MONTHS[+mo - 1]} ${y}`) || text.includes(`${+d} ${MONTHS[+mo - 1]} ${y}`), `date in "${text}"`);
      if (m.precision === "month") assert.ok(text.includes("November") || text.includes(MONTHS[+mo - 1]));
      if (m.distance) {
        const dist = o!.distance ?? "";
        assert.ok(dist.includes(String(m.distance.au)), `${m.distance.au} in "${dist}"`);
        const [ay, am, ad] = m.distance.asOf.split("-");
        assert.ok(dist.includes(`${+ad} ${MONTHS[+am - 1]} ${ay}`), `as-of date in "${dist}"`);
      }
    });
  }
  it("covers every spacecraft in the catalogue", () => {
    assert.deepEqual(objects.filter((o) => o.category === "spacecraft").map((o) => o.id).sort(), MISSIONS.map((m) => m.id).sort());
  });
});
