import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { riseSet } from "../utils/riseSet";
import { precessToDate } from "../utils/precession";
import { centuriesSinceJ2000 } from "../utils/skyTime";

type Case = { name: string; ra: number; dec: number; lat: number; lon: number; from_: string; rise: string | null; set: string | null; transit: string; minalt: number; maxalt: number };
const oracle = JSON.parse(readFileSync(new URL("./fixtures/riseset_oracle.json", import.meta.url), "utf8")) as Case[];
const utc = (s: string) => new Date(s.endsWith("Z") ? s : s + "Z");
const secs = (a: Date, b: string) => Math.abs(a.getTime() - utc(b).getTime()) / 1000;

describe("rise / transit / set vs astropy AltAz (no refraction)", () => {
  for (const c of oracle) {
    it(`${c.name} at ${c.lat},${c.lon} from ${c.from_}`, () => {
      const from = utc(c.from_);
      const p = precessToDate(c.ra, c.dec, centuriesSinceJ2000(from));
      const r = riseSet(p.ra, p.dec, c.lat, c.lon, from);
      if (c.rise === null) {
        assert.equal(r.kind, "circumpolar"); // oracle: altitude never below 0 in 28 h
        assert.ok(c.minalt >= 0);
        if (r.kind === "circumpolar") assert.ok(secs(r.transit, c.transit) < 45, `transit off by ${secs(r.transit, c.transit)} s`);
      } else {
        assert.equal(r.kind, "normal");
        if (r.kind === "normal") {
          // the oracle window is 28.8 h, ours is "next event after from"; compare the event the oracle found
          assert.ok(secs(r.rise, c.rise) < 45, `rise off by ${secs(r.rise, c.rise)} s`);
          assert.ok(secs(r.set, c.set!) < 45, `set off by ${secs(r.set, c.set!)} s`);
          assert.ok(secs(r.transit, c.transit) < 45, `transit off by ${secs(r.transit, c.transit)} s`);
        }
      }
    });
  }
  it("never-rises: a far-south star seen from the far north", () => {
    assert.equal(riseSet(100, -80, 60, 0, new Date("2026-01-01T00:00:00Z")).kind, "never-rises");
  });
  it("events come after `from` and within one sidereal day", () => {
    const from = new Date("2026-03-03T10:00:00Z");
    const r = riseSet(50, 10, 20, 30, from);
    assert.equal(r.kind, "normal");
    if (r.kind === "normal") for (const d of [r.rise, r.transit, r.set]) {
      assert.ok(d.getTime() >= from.getTime() && d.getTime() - from.getTime() <= 86164100);
    }
  });
});
