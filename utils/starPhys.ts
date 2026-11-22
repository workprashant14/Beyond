/** Parsecs to light-years (IAU). */
export const PC_LY = 3.261564;
/** Absolute visual magnitude of the Sun used for luminosity. */
export const SUN_ABS_V = 4.83;
/** Contents of public/sky/starphys.json (written by scripts/build-starphys.ts), in the same order as stars.json. */
export interface StarPhysFile {
  n: number;
  hip: number[];
  /** Distance in parsecs, null when unknown. */
  d: (number | null)[];
  /** Where the distance comes from: "G3" Gaia DR3, "G2" Gaia DR2, "H" Hipparcos, "GJ" Gliese catalogue, "" unknown. */
  ds: string[];
  /** Catalogued spectral type, null when unknown, and its source code. */
  sp: (string | null)[];
  ss: string[];
  /** Added with the proper-motion enrichment; absent in files built before it (treat as unknown). Same order as hip. */
  /** Proper motion in milliarcseconds per year: pmra already includes the cos(dec) factor (true angular motion on the sky). */
  pmra?: (number | null)[];
  pmdec?: (number | null)[];
  /** Source of the proper motion and of the radial velocity: "G3" Gaia DR3, "G2" Gaia DR2, "HYG" HYG database, "GJ" Gliese, "T" Tycho-2, "H" Hipparcos, "O" other, "" none. */
  pms?: string[];
  /** Radial velocity in km/s; positive = moving away from the Sun. */
  rv?: (number | null)[];
  rvs?: string[];
  /** B-V colour index (only where the catalogue says it is B-V). */
  ci?: (number | null)[];
  /** Harvard/Henry Draper number, Bright Star (Yale) number, Gliese designation text ("" = none). */
  hd?: (number | null)[];
  hr?: (number | null)[];
  gl?: string[];
}

export type DistClass = "observed" | "estimated" | null;

/**
 * How far to trust a distance. The table has no per-star errors, so the class follows the source and the distance:
 * Gaia parallaxes are precise, so up to 1,000 pc counts as measured and up to 3,000 pc as low precision; Hipparcos
 * (and the Gliese catalogue) are about 20 times less precise, so 200 pc counts as measured and 1,000 pc as low precision.
 * Beyond that no distance is shown. These cut-offs are this site's policy, not catalogue values.
 */
export function distanceClass(pc: number | null, src: string): DistClass {
  if (pc === null || !(pc > 0) || !src) return null;
  const gaia = src === "G3" || src === "G2";
  const [solid, rough] = gaia ? [1000, 3000] : [200, 1000];
  return pc <= solid ? "observed" : pc <= rough ? "estimated" : null;
}

export const distanceSourceLabel = (src: string): string =>
  src === "G3" ? "Gaia DR3" : src === "G2" ? "Gaia DR2" : src === "H" ? "Hipparcos" : src === "GJ" ? "the Gliese catalogue" : "an unknown source";

/** Absolute magnitude from apparent magnitude and distance (no dust correction). */
export const absoluteMagnitude = (apparent: number, pc: number) => apparent + 5 - 5 * Math.log10(pc);

/** Visible-light luminosity in solar units. This is NOT bolometric: hot and cool stars emit much of their light outside the visible band. */
export const visualLuminosity = (absMag: number) => 10 ** ((SUN_ABS_V - absMag) / 2.5);

export function formatLuminosity(l: number): string {
  if (l >= 100) return `${Math.round(Number(l.toPrecision(2))).toLocaleString("en-US")} Suns`;
  if (l >= 1) return `${Number(l.toPrecision(2))} Suns`;
  return `${Number(l.toPrecision(2))} of the Sun`;
}

/** km/s per (arcsecond per year x parsec): one astronomical unit per year expressed in km/s (IAU constants). */
export const K_KMS = 4.740470446;

/** Total proper motion in mas/yr from its two components. */
export const totalProperMotion = (pmra: number, pmdec: number) => Math.hypot(pmra, pmdec);

/** Speed across the line of sight in km/s from a proper motion (mas/yr) and a distance (pc). Needs a trustworthy distance. */
export const tangentialVelocityKms = (pmMasYr: number, pc: number) => K_KMS * (pmMasYr / 1000) * pc;

export const motionSourceLabel = (src: string): string =>
  src === "G3" ? "Gaia DR3" : src === "G2" ? "Gaia DR2" : src === "HYG" ? "the HYG database (its original source catalogue is not broken out)" : src === "GJ" ? "the Gliese catalogue" : src === "T" ? "Tycho-2" : src === "H" ? "Hipparcos" : src === "O" ? "another source" : "an unknown source";
