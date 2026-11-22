/**
 * Saturn ring shadows, as analytic ray tests (no shadow maps, so no extra render passes).
 * Everything is in world space with the Sun at the origin. A "ring plane" has a centre C (the planet), a unit normal N, and an annulus
 * [inner, outer] around C. The Sun is treated as a point (no penumbra from its size), and the ring's own thickness is zero.
 *
 * These are the reference implementations; the fragment shaders in universe/objects/ringShadowShader.ts repeat them line for line
 * (tests/ringshadow.test.ts checks the constants and checks these functions against a brute-force ray march).
 */
export type V3 = readonly [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** Direction from a world point toward the Sun (at the origin). */
export const sunDirection = (p: V3): V3 => unit([-p[0], -p[1], -p[2]]);

/**
 * Where the ray from `p` toward the Sun crosses the ring plane, as the distance from the planet's centre; null if it does not cross
 * (moving away from the plane, parallel to it, or the crossing is behind p).
 */
export function ringCrossingRadius(p: V3, C: V3, N: V3): number | null {
  const s = sunDirection(p);
  const denom = dot(s, N);
  if (Math.abs(denom) <= 1e-4) return null;
  const t = -dot(sub(p, C), N) / denom;
  if (!(t > 0)) return null;
  const H: V3 = [p[0] + s[0] * t, p[1] + s[1] * t, p[2] + s[2] * t];
  return len(sub(H, C));
}

/** True if the ray from a globe-surface point toward the Sun passes through the ring annulus (so the ring is between the point and the Sun). */
export function ringCoversPoint(p: V3, C: V3, N: V3, inner: number, outer: number): boolean {
  const rho = ringCrossingRadius(p, C, N);
  return rho !== null && rho > inner && rho < outer;
}

/** Fraction (0..1) of the way the ray from `p` toward the Sun is blocked by a sphere of radius `r` at `C`: 1 inside the shadow, smooth over +-1.5% of the radius at its edge. */
export function sphereShadowOnPoint(p: V3, C: V3, r: number): number {
  const s = sunDirection(p);
  const oc = sub(C, p);
  const tca = dot(oc, s);
  if (!(tca > 0)) return 0;
  const d = len([oc[0] - s[0] * tca, oc[1] - s[1] * tca, oc[2] - s[2] * tca]);
  const a = r * 0.985, b = r * 1.015;
  const x = Math.min(1, Math.max(0, (d - a) / (b - a)));
  return 1 - x * x * (3 - 2 * x);
}

/** How much direct light a globe point loses to the ring at the given ring opacity (0..1): up to 85%. Mirrors the globe shader. */
export const GLOBE_SHADOW_STRENGTH = 0.85;
/** How much direct light a ring point loses inside the planet's shadow: up to 90%. Mirrors the ring shader. */
export const RING_SHADOW_STRENGTH = 0.9;
