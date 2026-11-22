import type { SmallBody } from "@/utils/smallBodies";
import { visualOrbitRadius } from "./solarScale";

/** Ecliptic AU vector to scene units: eccentricity and tilt true, semi-major axis compressed like the planets'. */
export function toScene(b: SmallBody, v: [number, number, number], out: Float32Array, o: number) {
  // Closed orbits keep their exact shape (one scale for the whole orbit); an open (hyperbolic) orbit has no semi-major axis to
  // scale by, so each point's distance is compressed like a planet's, which keeps direction, tilt and orientation true.
  const r = Math.hypot(v[0], v[1], v[2]);
  const s = b.e > 1 ? (r > 0 ? visualOrbitRadius(r) / r : 1) : visualOrbitRadius(b.a) / b.a;
  out[o] = v[0] * s; out[o + 1] = v[2] * s; out[o + 2] = -v[1] * s;
}
