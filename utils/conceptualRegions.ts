import { mulberry32 } from "./random";
import type { DataKind } from "@/types/provenance";

/**
 * Conceptual (schematic) regions of the outer Solar System: the Kuiper belt, the scattered disc and the Oort cloud.
 *
 * WHAT IS REAL: the radial extents (au) below, from NASA and one magazine source (listed in `source`).
 * WHAT IS NOT: every dot. No catalogue is used; dots are placed by a seeded random generator inside those extents, so the pictures show
 * where each region is claimed to be, not where any object is. The spread above and below the ecliptic is an artistic choice, not a
 * measurement. Nothing in here is evidence of how many objects exist or how they are distributed.
 */
export interface RegionSpec {
  id: "kuiper" | "scattered" | "oort";
  name: string;
  /** Provenance of what is drawn. */
  kind: DataKind;
  /** Radial extent in au that is drawn. */
  rMinAu: number;
  rMaxAu: number;
  /** Number of dots (display only, not a count of objects). */
  dots: number;
  /** Standard deviation of the angle above/below the ecliptic, degrees (artistic). null = spherical shell. */
  spreadDeg: number | null;
  /** What the extent means and where it comes from. */
  extent: string;
  source: string;
  /** What is uncertain or not drawn. */
  caveat: string;
}

export const REGIONS: readonly RegionSpec[] = [
  {
    id: "kuiper", name: "Kuiper belt", kind: "artistic", rMinAu: 30, rMaxAu: 55, dots: 6000, spreadDeg: 6,
    extent: "NASA: the belt \"extends from about 30 to 55 au\".",
    source: "NASA Solar System Exploration, Kuiper Belt fact sheet (solarsystem.nasa.gov), read 2026-11-16. Sky at Night Magazine gives the main belt as 30 to 50 au.",
    caveat: "Dots are random and the tilt spread is artistic. The real belt has structure (resonances, a classical belt) that is not drawn.",
  },
  {
    id: "scattered", name: "Scattered disc", kind: "artistic", rMinAu: 30, rMaxAu: 150, dots: 2500, spreadDeg: 15,
    extent: "Sky at Night Magazine: a sparse disc \"stretching out to 1,000 AU\". NASA describes it as a dynamic zone of icy objects with eccentric orbits, created by Neptune's outward motion; no inner or outer distance was found there.",
    source: "NASA Kuiper Belt fact sheet and Sky at Night Magazine (skyatnightmagazine.com), read 2026-11-16.",
    caveat: "Only 30 to 150 au is drawn; sources say it reaches out to about 1,000 au. The inner edge, the dots and the tilt spread are schematic.",
  },
  {
    id: "oort", name: "Oort cloud", kind: "theoretical", rMinAu: 5000, rMaxAu: 100000, dots: 6000, spreadDeg: null,
    extent: "NASA: it \"occupies space at a distance between 5,000 and 100,000 astronomical units\" and is thought to be a giant spherical shell.",
    source: "NASA Solar System Exploration (solarsystem.nasa.gov, science.nasa.gov/solar-system/oort-cloud), read 2026-11-16. Sky at Night Magazine puts the inner edge at 2,000 to 5,000 au and the outer edge possibly at 10,000 to 100,000 au.",
    caveat: "Never directly observed (NASA: no direct images). Edges are uncertain and sources disagree. Distances here are LOG-compressed so the shell fits in the view.",
  },
];

export const getRegion = (id: RegionSpec["id"]): RegionSpec => REGIONS.find((r) => r.id === id)!;

const rad = (d: number) => (d * Math.PI) / 180;

/** Box-Muller normal deviate from a uniform generator. */
function normal(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Deterministic dots for a region, as ecliptic (x, y, z) in au (flat array, 3 numbers per dot). Same id, count and seed always give the same
 * output. Disc regions: radius uniform per unit area in the annulus; Oort cloud: direction uniform on the sphere, radius uniform in log.
 */
export function generateRegionAu(spec: RegionSpec, dots = spec.dots, seed = 1): Float32Array {
  const rnd = mulberry32(seed * 7919 + spec.id.length * 104729 + spec.id.charCodeAt(0));
  const out = new Float32Array(dots * 3);
  for (let i = 0; i < dots; i++) {
    const lon = rnd() * 2 * Math.PI;
    let lat: number, r: number;
    if (spec.spreadDeg === null) {
      lat = Math.asin(2 * rnd() - 1);
      r = Math.exp(Math.log(spec.rMinAu) + rnd() * (Math.log(spec.rMaxAu) - Math.log(spec.rMinAu)));
    } else {
      lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rad(spec.spreadDeg) * normal(rnd)));
      r = Math.sqrt(spec.rMinAu ** 2 + rnd() * (spec.rMaxAu ** 2 - spec.rMinAu ** 2));
    }
    out[i * 3] = r * Math.cos(lat) * Math.cos(lon);
    out[i * 3 + 1] = r * Math.cos(lat) * Math.sin(lon);
    out[i * 3 + 2] = r * Math.sin(lat);
  }
  return out;
}

/** Distance from the Sun at which the sqrt compression used for orbits switches to log compression, au. */
export const LOG_FROM_AU = 100;
const SQRT_AT_SWITCH = 8 + 14 * Math.sqrt(LOG_FROM_AU);

/**
 * Display radius (scene units) of a distance in au. Up to 100 au this is exactly the compression used for planet and small-body orbits
 * (8 + 14 sqrt(au)); beyond that it grows with the logarithm, so 100,000 au lands near 330 units instead of 4,400 and stays inside the
 * camera's range. Continuous and strictly increasing.
 */
export function regionVisualRadius(au: number): number {
  if (!(au >= 0)) throw new RangeError("distance must be a non-negative number");
  return au <= LOG_FROM_AU ? 8 + 14 * Math.sqrt(au) : SQRT_AT_SWITCH + 60 * Math.log10(au / LOG_FROM_AU);
}

/** Region dots in scene axes (ecliptic is the XZ plane, +Y north), distance compressed by regionVisualRadius. */
export function regionScenePositions(au: Float32Array): Float32Array {
  const out = new Float32Array(au.length);
  for (let i = 0; i < au.length; i += 3) {
    const x = au[i], y = au[i + 1], z = au[i + 2], r = Math.hypot(x, y, z);
    const s = r > 0 ? regionVisualRadius(r) / r : 0;
    out[i] = x * s; out[i + 1] = z * s; out[i + 2] = -y * s;
  }
  return out;
}
