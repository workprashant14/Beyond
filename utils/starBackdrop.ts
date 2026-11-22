import { mulberry32 } from "./random";
import { raDecToVec, starColor } from "./sky";

/**
 * Star backdrop for the 3D universe scene.
 *
 * SOURCED   : the first `nCatalogue` entries are Hipparcos stars from public/sky/stars.json. Direction (RA/Dec),
 *             apparent magnitude and B-V colour are catalogue values.
 * PROCEDURAL: the remaining entries are a seeded fill of stars fainter than the catalogue limit. They are NOT real stars.
 *             Their count per magnitude follows the observed ~x3.2 growth per magnitude and they are concentrated toward the
 *             real galactic plane (J2000 pole), so the band of the Milky Way appears. Positions, magnitudes and colours are invented.
 * Depth: the backdrop is treated as infinitely distant (no per-star distance is stored), so it carries no parallax.
 */
export interface Backdrop {
  /** Unit-sphere directions, xyz interleaved. */
  dir: Float32Array;
  mag: Float32Array;
  color: Float32Array;
  n: number;
  nCatalogue: number;
}

export interface CatalogueLike {
  n: number;
  ra: ArrayLike<number>;
  dec: ArrayLike<number>;
  mag: ArrayLike<number>;
  bv: ArrayLike<number>;
}

/** J2000 north galactic pole (IAU 1958 / Hipparcos definition). */
export const GAL_POLE = { raDeg: 192.85948, decDeg: 27.12825 };

/** Magnitude range of the procedural fill: just beyond the catalogue limit down to what a dense field shows. */
export const FILL_MAG_MIN = 6.5;
export const FILL_MAG_MAX = 10.5;

const D2R = Math.PI / 180;

/** Unit vector (scene axes, as raDecToVec) of the galactic pole. */
function poleVec(): [number, number, number] {
  return raDecToVec(GAL_POLE.raDeg, GAL_POLE.decDeg, 1);
}

/** Draw a magnitude with cumulative counts N(<m) proportional to 10^(0.5 m), restricted to [lo, hi]. */
export function sampleFillMag(u: number, lo = FILL_MAG_MIN, hi = FILL_MAG_MAX): number {
  const k = 0.5;
  const span = Math.pow(10, k * (hi - lo)) - 1;
  return lo + Math.log10(1 + u * span) / k;
}

/** Galactic latitude (deg) with most stars within ~10 degrees of the plane and a uniform halo. */
export function sampleLatitudeDeg(u1: number, u2: number): number {
  if (u1 < 0.25) return Math.asin(2 * u2 - 1) / D2R; // isotropic part
  const sign = u2 < 0.5 ? -1 : 1;
  const w = Math.min(0.999999, Math.max(1e-6, 1 - Math.abs(2 * u2 - 1)));
  return sign * -Math.log(w) * 9; // Laplace, scale 9 deg
}

export function buildBackdrop(cat: CatalogueLike | null, fillCount: number, seed = 20260101): Backdrop {
  const nCat = cat?.n ?? 0;
  const n = nCat + Math.max(0, fillCount);
  const dir = new Float32Array(n * 3);
  const mag = new Float32Array(n);
  const color = new Float32Array(n * 3);

  for (let i = 0; i < nCat; i++) {
    const [x, y, z] = raDecToVec(cat!.ra[i], cat!.dec[i], 1);
    dir.set([x, y, z], i * 3);
    mag[i] = cat!.mag[i];
    const bv = cat!.bv[i];
    color.set(starColor(Number.isNaN(bv) ? null : bv), i * 3);
  }

  // Orthonormal basis (e1, e2, pole) in scene axes for the galactic frame.
  const p = poleVec();
  const ref: [number, number, number] = Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: number[]): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const e1 = norm(cross(p, ref));
  const e2 = cross(p, e1);

  const rand = mulberry32(seed);
  for (let k = 0; k < fillCount; k++) {
    const i = nCat + k;
    const b = sampleLatitudeDeg(rand(), rand()) * D2R;
    const l = rand() * Math.PI * 2;
    const cb = Math.cos(b), sb = Math.sin(b);
    const cl = Math.cos(l) * cb, sl = Math.sin(l) * cb;
    dir[i * 3] = e1[0] * cl + e2[0] * sl + p[0] * sb;
    dir[i * 3 + 1] = e1[1] * cl + e2[1] * sl + p[1] * sb;
    dir[i * 3 + 2] = e1[2] * cl + e2[2] * sl + p[2] * sb;
    mag[i] = sampleFillMag(rand());
    // Mostly white-to-orange field stars; a few blue-white. B-V in roughly [-0.05, 1.5].
    const bv = rand() < 0.15 ? -0.05 + rand() * 0.35 : 0.3 + rand() * rand() * 1.2;
    color.set(starColor(bv), i * 3);
  }
  return { dir, mag, color, n, nCatalogue: nCat };
}

/** Procedural fill size for a device profile (catalogue stars are always all drawn). */
export function fillCountFor(profile: "desktop" | "mobile" | "low"): number {
  return profile === "desktop" ? 30000 : profile === "mobile" ? 9000 : 4000;
}
