import { SOLAR_BODIES, getSolarBody, type SolarBody } from "@/data/solarSystem";
import { MOON_ELEMENTS, PLANET_ELEMENTS } from "@/data/keplerElements";
import { moonOrbitPath, moonPosition, planetOrbitPath, planetPosition, type Vec3 } from "@/utils/kepler";
import { moonVisualOrbit, visualOrbitRadius } from "./solarScale";

/** Ecliptic (x, y, z) to scene axes: the ecliptic is the XZ plane, +Y is north of it. */
const toScene = (v: Vec3, k: number): Vec3 => [v[0] * k, v[2] * k, -v[1] * k];

/** Visual size of a body's orbit (semi-major axis, world units). 0 for the Sun. */
export function bodyOrbitRadius(b: SolarBody): number {
  if (b.kind === "star") return 0;
  if (b.parent) {
    const el = MOON_ELEMENTS[b.id], parent = getSolarBody(b.parent);
    return el && parent ? moonVisualOrbit(parent.radiusKm, el.aKm) : 0;
  }
  return visualOrbitRadius(b.semiMajorAxisAU ?? 0);
}

/**
 * Position relative to the parent (or the Sun), scene axes. Only the semi-major axis is compressed: the shape (eccentricity),
 * tilt and orientation of each orbit are the real JPL values, so distance scales with the real distance / semi-major axis.
 */
export function orbitPosition(b: SolarBody, days: number): Vec3 {
  const pl = PLANET_ELEMENTS[b.id];
  if (pl) return toScene(planetPosition(pl, days / 36525), visualOrbitRadius(pl.a[0]) / pl.a[0]);
  const mo = MOON_ELEMENTS[b.id];
  if (mo) return toScene(moonPosition(mo, days), bodyOrbitRadius(b) / mo.aKm);
  return [0, 0, 0];
}

/** Points of a body's orbit, scene axes, for drawing the path. */
export function orbitPath(b: SolarBody, n = 192): Vec3[] {
  const pl = PLANET_ELEMENTS[b.id];
  if (pl) return planetOrbitPath(pl, 0, n).map((v) => toScene(v, visualOrbitRadius(pl.a[0]) / pl.a[0]));
  const mo = MOON_ELEMENTS[b.id];
  if (mo) return moonOrbitPath(mo, n).map((v) => toScene(v, bodyOrbitRadius(b) / mo.aKm));
  return [];
}

/** Bodies with a real orbit to draw. */
export const ORBITING = SOLAR_BODIES.filter((b) => PLANET_ELEMENTS[b.id] || MOON_ELEMENTS[b.id]);
