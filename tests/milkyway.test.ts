import { test } from "node:test";
import assert from "node:assert/strict";
import { FACTS, UNVERIFIED, R0_GRAVITY_PC, parsecsToLy, R0_REID_KPC, R0_GRAVITY_STAT_PC } from "../data/milkyWayStructure";
import { logSpiral } from "../utils/spiral";
import { PC_LY } from "../utils/starPhys";

test("every structure fact has a quote and an http(s) source, and ids are unique", () => {
  assert.equal(new Set(FACTS.map((f) => f.id)).size, FACTS.length);
  for (const f of FACTS) {
    assert.ok(f.quote.length > 10, f.id);
    assert.match(f.source.url, /^https:\/\//, f.id);
    assert.ok(["observed", "estimated"].includes(f.kind), `${f.id}: structure facts here are never artistic or theoretical`);
  }
  assert.ok(UNVERIFIED.length >= 3);
});

test("light-year conversion matches the project's parsec constant and the stated figure", () => {
  assert.ok(Math.abs(parsecsToLy(1) - PC_LY) < 1e-4, `${parsecsToLy(1)} vs ${PC_LY}`);
  const ly = Math.round(parsecsToLy(R0_GRAVITY_PC) / 10) * 10;
  assert.equal(ly, 27000);
  assert.ok(FACTS.find((f) => f.id === "r0-gravity")!.value.includes("27,000"));
});

test("the two independent distances agree within their combined error", () => {
  const gravityKpc = R0_GRAVITY_PC / 1000;
  assert.ok(Math.abs(gravityKpc - R0_REID_KPC) < 0.15 + R0_GRAVITY_STAT_PC / 1000 + 0.03 + 0.001);
});

test("log spiral has the requested pitch angle and starts/ends where expected", () => {
  const pts = logSpiral(1, 10, 0, 1, 2000);
  // angle between the tangent and the local circle: tan(pitch) = (dr/dtheta)/r
  const [x0, y0] = pts[1000], [x1, y1] = pts[1001];
  const r0 = Math.hypot(x0, y0), r1 = Math.hypot(x1, y1);
  const th0 = Math.atan2(y0, x0), th1 = Math.atan2(y1, x1);
  let dth = th1 - th0; if (dth < -Math.PI) dth += 2 * Math.PI;
  const pitch = (Math.atan(((r1 - r0) / dth) / ((r0 + r1) / 2)) * 180) / Math.PI;
  assert.ok(Math.abs(pitch - 10) < 0.05, `pitch ${pitch}`);
  assert.deepEqual(pts[0], [1, 0]);
  assert.ok(Math.abs(Math.hypot(...pts[2000]) - Math.exp(2 * Math.PI * Math.tan((10 * Math.PI) / 180))) < 1e-9);
});
