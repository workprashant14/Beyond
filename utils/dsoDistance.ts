import { COSMOLOGY, MPC_LY, comovingDistanceMpc } from "./cosmology";
import type { DsoType } from "./dso";

export type DistanceKind = "observed" | "estimated";
export interface DsoDistance {
  kind: DistanceKind | null;
  /** Distance in light-years, or null when none should be shown. */
  ly: number | null;
  /** Text for the value (e.g. "about 590 light-years"); null when no distance is shown. */
  text: string | null;
  /** Why the value is trustworthy or not, in plain words. */
  note: string;
}

const GALAXY: ReadonlySet<DsoType> = new Set(["g", "e", "s0", "s", "i", "sd", "gg", "gp", "gt"]);
const GALACTIC: ReadonlySet<DsoType> = new Set(["oc", "gc", "cn", "hii", "en", "nb", "rn", "pn", "snr"]);
/** Redshift distances are shown only from here (cz about 3,000 km/s): below it a galaxy's own motion is comparable to the cosmic expansion. */
export const MIN_Z_FOR_DISTANCE = 0.01;
/** Parallax limits in milliarcseconds: the table has no parallax error, so only large parallaxes are trusted. */
export const PAX_OBSERVED_MAS = 2;
export const PAX_ROUGH_MAS = 1;

const PC_LY = 3.26156377716;
const sig = (v: number) => Number(v.toPrecision(v < 100 ? 2 : v < 10000 ? 3 : 3)).toLocaleString("en-US");

/**
 * Distance for a deep-sky object from what the catalogue really has.
 *  - Galactic objects (clusters, nebulae, remnants): from the catalogued parallax, but only when it is large (>= 1 mas).
 *  - Galaxies: from the redshift with a flat LCDM model, only when z >= 0.01, always labelled Estimated.
 * Nothing is invented: otherwise the result has kind null and an explanation.
 */
export function dsoDistance(type: DsoType, z: number | null, parallaxMas: number | null): DsoDistance {
  if (GALACTIC.has(type)) {
    if (parallaxMas === null || !Number.isFinite(parallaxMas) || parallaxMas <= 0) return { kind: null, ly: null, text: null, note: "the catalogue has no parallax for this object" };
    if (parallaxMas < PAX_ROUGH_MAS) return { kind: null, ly: null, text: null, note: `its catalogued parallax (${parallaxMas} mas) is too small to give a reliable distance: the catalogue gives no error, and small parallaxes are easily off by their own size` };
    const ly = (1000 / parallaxMas) * PC_LY;
    const text = `about ${sig(ly)} light-years`;
    return parallaxMas >= PAX_OBSERVED_MAS
      ? { kind: "observed", ly, text, note: `from the catalogued parallax of ${parallaxMas} mas (SIMBAD's main value for the object); the table gives no uncertainty` }
      : { kind: "estimated", ly, text, note: `low precision: parallax of only ${parallaxMas} mas; the table gives no uncertainty, so treat as rough` };
  }
  if (GALAXY.has(type)) {
    if (z === null || !Number.isFinite(z)) return { kind: null, ly: null, text: null, note: "the catalogue has no redshift for this galaxy" };
    if (z < MIN_Z_FOR_DISTANCE) return { kind: null, ly: null, text: null, note: z < 0 ? "its redshift is negative (it is moving toward us), so the cosmic expansion gives no distance" : "too near for a redshift distance: its own motion through space is as large as the expansion" };
    const ly = comovingDistanceMpc(z) * MPC_LY;
    const text = ly >= 1e9 ? `about ${sig(ly / 1e9)} billion light-years` : `about ${sig(ly / 1e6)} million light-years`;
    return { kind: "estimated", ly, text, note: `comoving distance from the redshift using ${COSMOLOGY.label}. Ignores the galaxy's own motion (a few hundred km/s, about 10% at z = 0.01) and depends on H0: 73 instead of 67.4 would give about 8% less` };
  }
  return { kind: null, ly: null, text: null, note: "no distance is available for this kind of object" };
}
