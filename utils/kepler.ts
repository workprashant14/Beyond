import type { MoonElements, PlanetElements, Rated } from "@/data/keplerElements";

export type Vec3 = [number, number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;
/** Obliquity of the ecliptic at J2000 (JPL page: 23.43928 degrees). */
export const OBLIQUITY_DEG = 23.43928;

/**
 * Solve Kepler's equation M = E - e sin E for E (radians), Newton's method, safeguarded: the root always lies in [m - e, m + e]
 * (m = M wrapped to [-pi, pi]) and the function is increasing, so any Newton step that leaves that bracket is replaced by bisection.
 * Plain Newton from E = pi does not converge for some M when e >= 0.8 (the old version failed for 0.1% of M at e = 0.8, 0.7% at e = 0.9 and 9% at e = 0.99,
 * measured over a 20,000-point M sweep); the safeguard gives the same answer wherever plain Newton converged and a correct one where it did not.
 */
export function solveKepler(M: number, e: number): number {
  const m = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
  let lo = m - e, hi = m + e;
  let E = e < 0.8 ? m : Math.PI;
  if (E < lo || E > hi) E = m;
  for (let i = 0; i < 100; i++) {
    const f = E - e * Math.sin(E) - m;
    if (f > 0) hi = E; else lo = E;
    let next = E - f / (1 - e * Math.cos(E));
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    const d = next - E;
    E = next;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Rotate an in-plane position (x', y') by argument of periapsis, inclination, node (all radians). */
export function rotateOrbital(xp: number, yp: number, omega: number, inc: number, node: number): Vec3 {
  const cw = Math.cos(omega), sw = Math.sin(omega), ci = Math.cos(inc), si = Math.sin(inc), cn = Math.cos(node), sn = Math.sin(node);
  return [
    (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

const at = (r: Rated, T: number) => r[0] + r[1] * T;

interface Instant { a: number; e: number; inc: number; omega: number; node: number; M: number }
function planetInstant(el: PlanetElements, T: number): Instant {
  const varpi = at(el.varpi, T), node = at(el.Omega, T);
  return { a: at(el.a, T), e: at(el.e, T), inc: rad(at(el.I, T)), omega: rad(varpi - node), node: rad(node), M: rad(at(el.L, T) - varpi) };
}

/** Heliocentric position in AU, ecliptic and equinox of J2000, T in Julian centuries since J2000 (JPL Table 1 method). */
export function planetPosition(el: PlanetElements, T: number): Vec3 {
  const p = planetInstant(el, T);
  const E = solveKepler(p.M, p.e);
  return rotateOrbital(p.a * (Math.cos(E) - p.e), p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E), p.omega, p.inc, p.node);
}

/** n points around the planet's orbit (elements at T), in AU, evenly spaced in eccentric anomaly. */
export function planetOrbitPath(el: PlanetElements, T: number, n: number): Vec3[] {
  const p = planetInstant(el, T);
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const E = (k / n) * TAU;
    out.push(rotateOrbital(p.a * (Math.cos(E) - p.e), p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E), p.omega, p.inc, p.node));
  }
  return out;
}

/** Equatorial (ICRF) to ecliptic J2000 vector. */
export function equatorialToEcliptic(v: Vec3): Vec3 {
  const c = Math.cos(rad(OBLIQUITY_DEG)), s = Math.sin(rad(OBLIQUITY_DEG));
  return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
}

/**
 * Convert a vector given in the moon's reference frame to the J2000 ecliptic frame.
 * Laplace-plane frame: z = the plane's pole, x = the plane's ascending node on the ICRF equator (R.A. = pole R.A. + 90 deg).
 */
export function toEcliptic(plane: MoonElements["plane"], v: Vec3): Vec3 {
  if (plane === "ecliptic") return v;
  const a = rad(plane.raDeg), d = rad(plane.decDeg);
  const x: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const z: Vec3 = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const eq: Vec3 = [0, 1, 2].map((k) => v[0] * x[k] + v[1] * y[k] + v[2] * z[k]) as Vec3;
  return equatorialToEcliptic(eq);
}

function moonInPlane(el: MoonElements, E: number): Vec3 {
  return rotateOrbital(el.aKm * (Math.cos(E) - el.e), el.aKm * Math.sqrt(1 - el.e * el.e) * Math.sin(E), rad(el.omega), rad(el.i), rad(el.node));
}

/**
 * Moon position relative to its planet in km, ecliptic J2000 axes. The mean anomaly advances at 360 degrees per table period
 * from the epoch; JPL's mean elements are NOT an ephemeris, so where the moon sits on its orbit on a given date is illustrative.
 */
export function moonPosition(el: MoonElements, daysSinceJ2000: number): Vec3 {
  const M = rad(el.M0) + (TAU * daysSinceJ2000) / el.periodDays;
  return toEcliptic(el.plane, moonInPlane(el, solveKepler(M, el.e)));
}

export function moonOrbitPath(el: MoonElements, n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) out.push(toEcliptic(el.plane, moonInPlane(el, (k / n) * TAU)));
  return out;
}

export const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/** Solve the hyperbolic Kepler equation M = e sinh H - H for H (e > 1); M may be any real number. */
export function solveHyperbolicKepler(M: number, e: number): number {
  if (M === 0) return 0;
  let H = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8);
  for (let i = 0; i < 100; i++) {
    const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return H;
}
