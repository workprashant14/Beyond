/**
 * Area of a constellation on the sky, computed from the bundled IAU boundary polygon.
 *
 * Method: each boundary ring is a spherical polygon whose vertices are joined by great-circle arcs; the area is the sum of signed
 * spherical-triangle areas of a fan from the first vertex (Van Oosterom and Strackee 1983, solid angle of a triangle), converted to square degrees.
 * Caveat that makes this an ESTIMATE, not the official figure: the official IAU boundaries run along lines of constant right ascension and
 * declination (for the B1875 equinox), which are not great circles, while this dataset joins its vertices with great-circle arcs. The two
 * differ by up to about 2% per constellation (tests/constellationarea.test.ts measures it against the published areas); the 88 areas still sum
 * exactly to the whole sphere (41,252.96 square degrees).
 */
export type RaDec = readonly [number, number];

const RAD = Math.PI / 180;
export const SPHERE_SQ_DEG = 4 * Math.PI * (180 / Math.PI) ** 2;

function toVec([ra, dec]: RaDec): [number, number, number] {
  const r = ra * RAD, d = dec * RAD;
  return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
}

/** Area (square degrees) of one closed ring of (RA, Dec) degrees; the last vertex may repeat the first. Fewer than 3 distinct vertices give 0. */
export function ringAreaSqDeg(ring: readonly RaDec[]): number {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  if (pts.length < 3) return 0;
  const v = pts.map(toVec), a = v[0];
  let total = 0;
  for (let i = 1; i < v.length - 1; i++) {
    const b = v[i], c = v[i + 1];
    const triple = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    const den = 1 + (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) + (b[0] * c[0] + b[1] * c[1] + b[2] * c[2]) + (c[0] * a[0] + c[1] * a[1] + c[2] * a[2]);
    total += 2 * Math.atan2(triple, den);
  }
  return Math.abs(total) / (RAD * RAD);
}

/** Area (square degrees) of a constellation: the sum of its boundary rings (some constellations, such as Serpens, have two). */
export function constellationAreaSqDeg(bounds: readonly (readonly RaDec[])[]): number {
  return bounds.reduce((s, r) => s + ringAreaSqDeg(r), 0);
}

/** Rank by area among all regions in the table (1 = largest) and how many there are; null if the id is not in the table. Ties share the better rank. */
export function areaRank(areas: Readonly<Record<string, number>>, id: string): { rank: number; of: number } | null {
  const a = areas[id];
  if (typeof a !== "number" || !Number.isFinite(a)) return null;
  const all = Object.values(areas).filter((v) => Number.isFinite(v));
  return { rank: 1 + all.filter((v) => v > a).length, of: all.length };
}

/** "1,302.8 square degrees" (one decimal), with the share of the whole sky: "3.16% of the sky". */
export function formatArea(sqDeg: number): string {
  return `${sqDeg.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} square degrees (${((sqDeg / SPHERE_SQ_DEG) * 100).toFixed(2)}% of the sky)`;
}
