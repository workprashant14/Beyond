/**
 * Physical state vectors (km, km/s) of the Sun and planets, independent of any drawing scale.
 * Nothing in here imports the visual-scale code: the 3D scene compresses distances for display, this module does not.
 *
 * Positions come from JPL's approximate-position elements (data/keplerElements.ts, valid 1800-2050, see utils/timeScales.ts).
 * Velocities are the time derivative of the same formula (central difference over +-STEP_DAYS), so they are exactly as
 * accurate as the positions and no better. Frame: heliocentric, mean ecliptic and equinox of J2000. Time argument: TDB days since J2000.
 */
import { PLANET_ELEMENTS } from "@/data/keplerElements";
import { GM_SUN_KM3_S2, GM_SYSTEM_KM3_S2 } from "@/data/gm";
import { planetPosition, type Vec3 } from "./kepler";

export const KM_PER_AU = 149_597_870.7;
const SECONDS_PER_DAY = 86_400;
/** Half-width of the central difference, days. Truncation error ~ h^2, far below the model error. */
export const STEP_DAYS = 0.01;

export interface StateVector {
  /** km */
  position: Vec3;
  /** km/s */
  velocity: Vec3;
}

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** True if the id has elements (and so a state vector): Mercury to Neptune. "earth" is the Earth-Moon barycentre. */
export const hasStateVector = (id: string): boolean => id in PLANET_ELEMENTS && id in GM_SYSTEM_KM3_S2;

/** Heliocentric state of a planet (or the Earth-Moon barycentre for "earth"). Throws for an id without elements. */
export function heliocentricState(id: string, daysSinceJ2000Tdb: number): StateVector {
  const el = PLANET_ELEMENTS[id];
  if (!el) throw new RangeError(`no orbital elements for "${id}"`);
  const at = (d: number) => scale(planetPosition(el, d / 36525), KM_PER_AU);
  const p = at(daysSinceJ2000Tdb);
  const ahead = at(daysSinceJ2000Tdb + STEP_DAYS), behind = at(daysSinceJ2000Tdb - STEP_DAYS);
  return { position: p, velocity: scale(sub(ahead, behind), 1 / (2 * STEP_DAYS * SECONDS_PER_DAY)) };
}

/**
 * Where the Solar System barycentre is, relative to the Sun's centre (km, km/s, same frame), from the eight planet systems:
 * r_bary = sum(GM_i r_i) / (GM_sun + sum GM_i). Ignores dwarf planets and asteroids (together far below 1e-3 of Jupiter's effect).
 */
export function barycentreFromSun(daysSinceJ2000Tdb: number): StateVector {
  let total = GM_SUN_KM3_S2;
  let p: Vec3 = [0, 0, 0], v: Vec3 = [0, 0, 0];
  for (const id of Object.keys(GM_SYSTEM_KM3_S2)) {
    const s = heliocentricState(id, daysSinceJ2000Tdb), gm = GM_SYSTEM_KM3_S2[id];
    p = add(p, scale(s.position, gm));
    v = add(v, scale(s.velocity, gm));
    total += gm;
  }
  return { position: scale(p, 1 / total), velocity: scale(v, 1 / total) };
}

/** Barycentric state: heliocentric state minus the barycentre's offset from the Sun. */
export function barycentricState(id: string, days: number): StateVector {
  const h = id === "sun" ? { position: [0, 0, 0] as Vec3, velocity: [0, 0, 0] as Vec3 } : heliocentricState(id, days);
  const b = barycentreFromSun(days);
  return { position: sub(h.position, b.position), velocity: sub(h.velocity, b.velocity) };
}

export const speedKmS = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
