import raw from "@/data/galaxyMorphology.json";
import {
  classifyHubble, diskBasis, ellipsoidBasis, inclinationDeg, makeParams, morphologyNote,
  type DiskBasis, type GalaxyClass, type GalaxyParams, type HubbleInfo, type Morph, type Vec3,
} from "@/utils/galaxyMorph";

const DATA = raw as { galaxies: Record<string, Morph> };

export interface ResolvedGalaxy {
  params: GalaxyParams;
  info: HubbleInfo;
  morph: Morph | null;
  inclinationEst: number | null;
  /** Catalogue-based orientation as seen from the scene origin, or null when none can be derived (then the scene tilt is used). */
  basis: DiskBasis | null;
  note: string;
}

export const hasGalaxyMorphology = (id: string) => id in DATA.galaxies;

/**
 * Combines the OpenNGC record for `id` (if any) with the scene position.
 * The scene origin stands in for the viewer (Earth); scene +Y stands in for celestial north (schematic frame).
 */
export function resolveGalaxy(id: string, seed: number, position: Vec3, fallback: GalaxyClass = "spiral"): ResolvedGalaxy {
  const morph = DATA.galaxies[id] ?? null;
  const info = classifyHubble(morph?.hubble, fallback);
  const params = makeParams(info, seed, morph, id === "milky-way"); // objects.json: "barred spiral"
  const incl = inclinationDeg(morph?.majAxArcmin ?? null, morph?.minAxArcmin ?? null);
  const dist = Math.hypot(...position);
  let basis: DiskBasis | null = null;
  if (dist > 1e-6 && morph?.posAngDeg != null) {
    const view: Vec3 = [-position[0], -position[1], -position[2]];
    if (info.cls === "elliptical") basis = ellipsoidBasis(view, morph.posAngDeg);
    else if (incl !== null) basis = diskBasis(view, morph.posAngDeg, incl);
  }
  return { params, info, morph, inclinationEst: basis ? incl : null, basis, note: morphologyNote(morph, info, basis ? incl : null) };
}
