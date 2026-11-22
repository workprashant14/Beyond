import type { SmallBody } from "./smallBodies";

/**
 * Named small bodies that get their own always-visible marker, label and orbit in the Solar System scene.
 * The five dwarf planets are the ones the IAU recognises (Ceres, Pluto, Haumea, Makemake, Eris); the three asteroids are the
 * other largest main-belt bodies named in the brief. Nothing here holds orbital data: the elements come from the JPL Small-Body
 * Database file built by `npm run build:smallbodies`, and a body that is not in that file is reported as missing, never invented.
 * The JPL names are matched by minor-planet number (the leading number of the SBDB full name), not by SPK-ID.
 */
export interface FeaturedSpec { number: number; name: string; kind: "dwarf-planet" | "asteroid" }

export const FEATURED: readonly FeaturedSpec[] = [
  { number: 134340, name: "Pluto", kind: "dwarf-planet" },
  { number: 1, name: "Ceres", kind: "dwarf-planet" },
  { number: 136199, name: "Eris", kind: "dwarf-planet" },
  { number: 136108, name: "Haumea", kind: "dwarf-planet" },
  { number: 136472, name: "Makemake", kind: "dwarf-planet" },
  { number: 4, name: "Vesta", kind: "asteroid" },
  { number: 2, name: "Pallas", kind: "asteroid" },
  { number: 10, name: "Hygiea", kind: "asteroid" },
];

/** "     1 Ceres", "134340 Pluto (1930 BA)" or "433 Eros (A898 PA)" to {number, name}; null for provisional or comet designations. */
export function parseFullName(full: string): { number: number; name: string } | null {
  const m = /^\s*(\d+)\s+([^()]+?)\s*(?:\(.*\))?\s*$/.exec(full);
  return m ? { number: Number(m[1]), name: m[2] } : null;
}

export interface FeaturedBody { spec: FeaturedSpec; body: SmallBody }

/**
 * Finds the featured bodies in a built file. A record counts only if its number AND its name match the spec, so a wrong
 * number can never silently label some other asteroid. Returns found bodies (in FEATURED order) and the specs that were not found.
 */
export function pickFeatured(bodies: readonly SmallBody[]): { found: FeaturedBody[]; missing: FeaturedSpec[] } {
  const byNumber = new Map<number, SmallBody>();
  for (const b of bodies) {
    if (b.k !== "a") continue;
    const p = parseFullName(b.n);
    if (p) byNumber.set(p.number, b);
  }
  const found: FeaturedBody[] = [], missing: FeaturedSpec[] = [];
  for (const spec of FEATURED) {
    const b = byNumber.get(spec.number);
    const p = b ? parseFullName(b.n) : null;
    if (b && p && p.name.toLowerCase() === spec.name.toLowerCase()) found.push({ spec, body: b });
    else missing.push(spec);
  }
  return { found, missing };
}
