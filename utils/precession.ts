/**
 * Precession of equatorial coordinates between J2000 and a date (IAU 1976 angles, Meeus, Astronomical Algorithms, ch. 21).
 * T is Julian centuries from J2000 (negative = past). Accurate to arcseconds for a few centuries around J2000 and still good to
 * a fraction of a degree over a few thousand years; the polynomial is not meant for tens of thousands of years.
 * Not included: proper motion (see utils/properMotion.ts), nutation (about 17 arcseconds) and aberration (about 20 arcseconds).
 */
const D2R = Math.PI / 180;
const ARCSEC = D2R / 3600;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

type Vec = [number, number, number];
type Mat = [Vec, Vec, Vec];

const toVec = (ra: number, dec: number): Vec => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const fromVec = (v: Vec): { ra: number; dec: number } => ({ ra: norm360(Math.atan2(v[1], v[0]) / D2R), dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R });
const mul = (m: Mat, v: Vec): Vec => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const mulT = (m: Mat, v: Vec): Vec => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];

/** Rotation taking J2000 equatorial vectors to the mean equator and equinox of date: Rz(z) * tilt(theta) * Rz(zeta). */
export function precessionMatrix(T: number): Mat {
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * ARCSEC;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * ARCSEC;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * ARCSEC;
  const [cz, sz, cs, ss, ct, st] = [Math.cos(z), Math.sin(z), Math.cos(zeta), Math.sin(zeta), Math.cos(th), Math.sin(th)];
  return [
    [cz * ct * cs - sz * ss, -cz * ct * ss - sz * cs, -cz * st],
    [sz * ct * cs + cz * ss, -sz * ct * ss + cz * cs, -sz * st],
    [st * cs, -st * ss, ct],
  ];
}

/** J2000 catalogue position to the mean equator and equinox of date (what a sidereal-time based horizon needs). */
export function precessToDate(raDeg: number, decDeg: number, T: number): { ra: number; dec: number } {
  return fromVec(mul(precessionMatrix(T), toVec(raDeg, decDeg)));
}

/** Position given for the mean equator and equinox of date back to J2000 (the frame the catalogues and the 3D sky use). */
export function precessToJ2000(raDeg: number, decDeg: number, T: number): { ra: number; dec: number } {
  return fromVec(mulT(precessionMatrix(T), toVec(raDeg, decDeg)));
}
