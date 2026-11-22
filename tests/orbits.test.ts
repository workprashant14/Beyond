import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANET_ELEMENTS, MOON_ELEMENTS } from "../data/keplerElements";
import { solveKepler, planetPosition, planetOrbitPath, moonPosition, moonOrbitPath, norm, toEcliptic } from "../utils/kepler";
import { SOLAR_BODIES } from "../data/solarSystem";

const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);

test("Kepler solver satisfies M = E - e sin E", () => {
  for (const e of [0, 0.0167, 0.2056, 0.6, 0.9]) for (let m = -3; m <= 3; m += 0.37) {
    const E = solveKepler(m, e);
    near(E - e * Math.sin(E), m, 1e-9, `e=${e}`);
  }
});

test("table values agree with independent facts: orbital periods from a (Kepler's third law) and L rate", () => {
  const known: Record<string, number> = { mercury: 87.969, venus: 224.701, earth: 365.256, mars: 686.98, jupiter: 4332.59, saturn: 10759.22, uranus: 30687, neptune: 60190 };
  for (const [id, el] of Object.entries(PLANET_ELEMENTS)) {
    const fromA = 365.25636 * el.a[0] ** 1.5;
    near(fromA / known[id], 1, 0.001, `${id} period from a`);
    const fromL = (36525 * 360) / el.L[1];
    near(fromL / known[id], 1, 0.001, `${id} period from L rate`);
  }
});

test("perihelion distances and inclinations match widely published values", () => {
  const peri: Record<string, number> = { mercury: 0.307, venus: 0.718, earth: 0.983, mars: 1.381, jupiter: 4.95, saturn: 9.02, uranus: 18.3, neptune: 29.8 };
  const incl: Record<string, number> = { mercury: 7.0, venus: 3.39, earth: 0, mars: 1.85, jupiter: 1.3, saturn: 2.49, uranus: 0.77, neptune: 1.77 };
  for (const [id, el] of Object.entries(PLANET_ELEMENTS)) {
    near(el.a[0] * (1 - el.e[0]), peri[id], peri[id] * 0.005, `${id} perihelion`);
    near(el.I[0], incl[id], 0.02, `${id} inclination`);
  }
});

test("Earth is 0.98 AU from the Sun at J2000 (near perihelion) and about 1.017 AU in early July", () => {
  near(norm(planetPosition(PLANET_ELEMENTS.earth, 0)), 0.9833, 0.001);
  const july = (Date.UTC(2026, 6, 6) - Date.UTC(2000, 0, 1, 12)) / 86_400_000 / 36525;
  near(norm(planetPosition(PLANET_ELEMENTS.earth, july)), 1.0167, 0.002);
});

test("distance always lies between perihelion and aphelion; orbit path points match the position formula", () => {
  for (const el of Object.values(PLANET_ELEMENTS)) for (const T of [0, 0.13, 0.27, -0.5]) {
    const r = norm(planetPosition(el, T)), a = el.a[0] + el.a[1] * T, e = el.e[0] + el.e[1] * T;
    assert.ok(r >= a * (1 - e) - 1e-6 && r <= a * (1 + e) + 1e-6);
  }
  const path = planetOrbitPath(PLANET_ELEMENTS.mars, 0, 360);
  const rs = path.map(norm);
  near(Math.min(...rs), 1.5237 * (1 - 0.0934), 1e-3);
  near(Math.max(...rs), 1.5237 * (1 + 0.0934), 1e-3);
});

test("Mars at J2000 sits near ecliptic longitude 359 degrees (mean longitude -4.55 plus equation of centre)", () => {
  const p = planetPosition(PLANET_ELEMENTS.mars, 0);
  const lon = ((Math.atan2(p[1], p[0]) * 180) / Math.PI + 360) % 360;
  assert.ok(lon > 352 && lon < 360 || lon < 4, `lon=${lon}`);
});

test("moons: distance stays between a(1-e) and a(1+e); the Moon's orbit is tilted about 5 degrees to the ecliptic", () => {
  for (const [id, el] of Object.entries(MOON_ELEMENTS)) {
    for (const d of [0, 3.3, 100.7, 9500]) {
      const r = norm(moonPosition(el, d));
      assert.ok(r >= el.aKm * (1 - el.e) - 1 && r <= el.aKm * (1 + el.e) + 1, `${id} r=${r}`);
    }
  }
  const zMax = Math.max(...moonOrbitPath(MOON_ELEMENTS.moon, 720).map((p) => Math.abs(p[2]) / norm(p)));
  near((Math.asin(zMax) * 180) / Math.PI, 5.16, 0.05);
});

test("Jupiter's Laplace plane is tilted about 2.2 degrees to the ecliptic's pole direction check: pole vector length 1", () => {
  const pole = toEcliptic({ raDeg: 268.1, decDeg: 64.5 }, [0, 0, 1]);
  near(norm(pole), 1, 1e-12);
  // Jupiter's orbit pole is close to the Laplace pole (both within a few degrees of each other).
  const el = PLANET_ELEMENTS.jupiter;
  const I = (el.I[0] * Math.PI) / 180, N = (el.Omega[0] * Math.PI) / 180;
  const orbitPole = [Math.sin(I) * Math.sin(N), -Math.sin(I) * Math.cos(N), Math.cos(I)];
  const dot = pole[0] * orbitPole[0] + pole[1] * orbitPole[1] + pole[2] * orbitPole[2];
  assert.ok((Math.acos(dot) * 180) / Math.PI < 5, `angle ${(Math.acos(dot) * 180) / Math.PI}`);
});

test("every moon with elements has a body, and its parent matches", () => {
  for (const [id, el] of Object.entries(MOON_ELEMENTS)) {
    const b = SOLAR_BODIES.find((x) => x.id === id);
    assert.ok(b, `${id} missing from SOLAR_BODIES`);
    assert.equal(b!.parent, el.parent);
  }
});
