import { test } from "node:test";
import assert from "node:assert/strict";
import { heliocentricState, barycentreFromSun, barycentricState, hasStateVector, speedKmS, KM_PER_AU } from "../utils/stateVectors";
import { GM_SUN_KM3_S2, GM_SYSTEM_KM3_S2 } from "../data/gm";
import { PLANET_ELEMENTS } from "../data/keplerElements";
import { utcMsToClockDays } from "../utils/simClock";

const IDS = Object.keys(GM_SYSTEM_KM3_S2);
const R_SUN_KM = 695_700;
const days = (y: number) => utcMsToClockDays(Date.UTC(y, 0, 1));
const norm = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test("GM data: DE440 values and sanity ratios", () => {
  assert.equal(GM_SYSTEM_KM3_S2.earth, 398600.435507 + 4902.800118);
  assert.ok(Math.abs(GM_SUN_KM3_S2 / GM_SYSTEM_KM3_S2.jupiter - 1047.35) < 0.01);
  assert.ok(Math.abs(GM_SUN_KM3_S2 - 1.32712440041279419e11) < 1);
  assert.equal(IDS.length, 8);
  assert.ok(IDS.every(hasStateVector));
  assert.equal(hasStateVector("sun"), false); assert.equal(hasStateVector("moon"), false);
});

test("velocity agrees with two-body vis-viva (km/s) within 0.5% for every planet, several dates", () => {
  for (const y of [1850, 1950, 2000, 2026, 2045]) for (const id of IDS) {
    const s = heliocentricState(id, days(y)), a = PLANET_ELEMENTS[id].a[0] * KM_PER_AU;
    const r = norm(s.position), vVis = Math.sqrt(GM_SUN_KM3_S2 * (2 / r - 1 / a));
    // The planet's own GM is ignored here, so the Sun-only value is the right comparison; element drift is far below 0.5%.
    assert.ok(Math.abs(speedKmS(s.velocity) / vVis - 1) < 0.005, `${id} ${y}: ${speedKmS(s.velocity)} vs ${vVis}`);
  }
});

test("known magnitudes: Earth-Moon barycentre ~29.3 to 30.3 km/s and 0.983 to 1.017 au; Neptune ~5.4 km/s", () => {
  for (const y of [2000, 2010, 2020, 2026]) {
    const e = heliocentricState("earth", days(y));
    assert.ok(speedKmS(e.velocity) > 29.2 && speedKmS(e.velocity) < 30.4, String(speedKmS(e.velocity)));
    assert.ok(norm(e.position) / KM_PER_AU > 0.982 && norm(e.position) / KM_PER_AU < 1.018);
  }
  const n = speedKmS(heliocentricState("neptune", days(2026)).velocity);
  assert.ok(n > 5.2 && n < 5.6, String(n));
});

test("velocity is the derivative of position (independent step size), and angular momentum is conserved around the orbit", () => {
  const t = days(2026), h = 0.5;
  for (const id of ["mercury", "earth", "jupiter"]) {
    const v = heliocentricState(id, t).velocity;
    const a = heliocentricState(id, t + h).position, b = heliocentricState(id, t - h).position;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs((a[k] - b[k]) / (2 * h * 86400) - v[k]) < 2e-4 * speedKmS(v), `${id} axis ${k}`);
  }
  const L = (id: string, d: number) => { const s = heliocentricState(id, d), c = [s.position[1] * s.velocity[2] - s.position[2] * s.velocity[1], s.position[2] * s.velocity[0] - s.position[0] * s.velocity[2], s.position[0] * s.velocity[1] - s.position[1] * s.velocity[0]]; return norm(c); };
  const l0 = L("mercury", t);
  for (let k = 1; k < 8; k++) assert.ok(Math.abs(L("mercury", t + k * 11) / l0 - 1) < 2e-3, "Mercury angular momentum");
});

test("barycentre stays within ~2.3 solar radii of the Sun's centre and is momentum-consistent", () => {
  let max = 0, min = Infinity;
  for (let y = 1800; y <= 2050; y += 1) {
    const d = norm(barycentreFromSun(days(y)).position);
    max = Math.max(max, d); min = Math.min(min, d);
  }
  assert.ok(max < 2.3 * R_SUN_KM && max > 1.0 * R_SUN_KM, `max ${max / R_SUN_KM} Rsun`);
  assert.ok(min < 0.9 * R_SUN_KM, `min ${min / R_SUN_KM} Rsun`);
  const t = days(2026);
  // The Sun's barycentric velocity is minus the barycentre's velocity relative to the Sun; total momentum about the barycentre is zero.
  let p = [0, 0, 0], tot = GM_SUN_KM3_S2;
  const sun = barycentricState("sun", t);
  p = [GM_SUN_KM3_S2 * sun.velocity[0], GM_SUN_KM3_S2 * sun.velocity[1], GM_SUN_KM3_S2 * sun.velocity[2]];
  for (const id of IDS) { const v = barycentricState(id, t).velocity; for (let k = 0; k < 3; k++) p[k] += GM_SYSTEM_KM3_S2[id] * v[k]; tot += GM_SYSTEM_KM3_S2[id]; }
  assert.ok(norm(p) / tot < 1e-9 * 30, `net momentum ${norm(p) / tot} km/s`);
  const sunSpeed = speedKmS(sun.velocity);
  assert.ok(sunSpeed > 0.001 && sunSpeed < 0.02, `Sun wobble speed ${sunSpeed} km/s (about 12 m/s from Jupiter alone)`);
});

test("Jupiter alone sets the barycentre direction: offset points near Jupiter's heliocentric direction (cos > 0.5) on a date", () => {
  const t = days(2026);
  const b = barycentreFromSun(t).position, j = heliocentricState("jupiter", t).position;
  assert.ok(dot(b, j) / (norm(b) * norm(j)) > 0.5);
  assert.throws(() => heliocentricState("moon", t), RangeError);
});

import oracle from "./fixtures/barycentre-oracle.json";
import { J2000_JD } from "../utils/timeScales";

test("independent oracle (astropy/ERFA epv00, 1900-2100): Sun offset from the barycentre and Earth-Moon barycentre velocity", () => {
  let worstSunKm = 0, worstEarthVel = 0, worstEarthPosAu = 0;
  for (const row of oracle.rows) {
    const d = row.jd_tdb - J2000_JD;
    const sun = barycentricState("sun", d);
    const sunErr = Math.hypot(sun.position[0] - row.sun.pos_km[0], sun.position[1] - row.sun.pos_km[1], sun.position[2] - row.sun.pos_km[2]);
    const e = barycentricState("earth", d);
    const velErr = Math.hypot(e.velocity[0] - row["earth-moon-barycenter"].vel_km_s[0], e.velocity[1] - row["earth-moon-barycenter"].vel_km_s[1], e.velocity[2] - row["earth-moon-barycenter"].vel_km_s[2]);
    const posErr = Math.hypot(e.position[0] - row["earth-moon-barycenter"].pos_km[0], e.position[1] - row["earth-moon-barycenter"].pos_km[1], e.position[2] - row["earth-moon-barycenter"].pos_km[2]) / KM_PER_AU;
    worstSunKm = Math.max(worstSunKm, sunErr); worstEarthVel = Math.max(worstEarthVel, velErr); worstEarthPosAu = Math.max(worstEarthPosAu, posErr);
  }
  console.log(`oracle worst: Sun offset ${worstSunKm.toFixed(0)} km, Earth velocity ${worstEarthVel.toFixed(4)} km/s, Earth position ${worstEarthPosAu.toFixed(5)} au`);
  // Tolerances follow the stated accuracy of the approximate elements (Jupiter 400 arcsec ~ 1.5e3 km on the Sun offset); observed worst case is printed above and the limits sit about 2x over it.
  assert.ok(worstSunKm < 5e3, `Sun offset error ${worstSunKm} km`);
  assert.ok(worstEarthVel < 0.005, `Earth velocity error ${worstEarthVel} km/s`);
  assert.ok(worstEarthPosAu < 0.0005, `Earth position error ${worstEarthPosAu} au`);
});
