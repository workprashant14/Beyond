/**
 * Illustrative comet tails.
 *
 * WHAT IS REAL: a comet's ion tail points directly away from the Sun, and both the dust and ion tails get longer the closer the comet is to
 * the Sun (NASA Space Place, "What Is a Comet?", read 2026-11-16). The direction used here is exactly that.
 * WHAT IS NOT: everything else. NASA gives no distance at which tails form, so the 3 au limit below is a DISPLAY choice, not a fact. The length is a
 * straight, linear function of heliocentric distance in scene units, not a physical length. Dust-tail curvature, brightness, composition,
 * outbursts and the real (often millions of kilometres) lengths are not modelled. Tails are labelled Artistic in the interface.
 */
export type V3 = readonly [number, number, number];

/** Display choice: tails are drawn only for comets closer to the Sun than this (au). */
export const TAIL_ACTIVE_AU = 3;
/** Display length (scene units) of a tail at the Sun; shrinks linearly to 0 at TAIL_ACTIVE_AU. */
export const TAIL_MAX_UNITS = 18;
/** At most this many tails are drawn at once (nearest to the Sun first; the selected comet always counts first). */
export const TAIL_CAP = 80;

/** Display length in scene units for a comet at heliocentric distance rAu; 0 when the comet is too far or the distance is not usable. */
export function tailLengthUnits(rAu: number): number {
  if (!Number.isFinite(rAu) || rAu < 0 || rAu >= TAIL_ACTIVE_AU) return 0;
  return TAIL_MAX_UNITS * (1 - rAu / TAIL_ACTIVE_AU);
}

/** Unit vector pointing away from the Sun (the Sun is at the origin) from a heliocentric position; null at the origin. */
export function antiSunward(p: V3): [number, number, number] | null {
  const r = Math.hypot(p[0], p[1], p[2]);
  return r > 0 && Number.isFinite(r) ? [p[0] / r, p[1] / r, p[2] / r] : null;
}

/**
 * Which comets get a tail. `items` carry the comet's index and heliocentric distance. Only comets with a positive tail length are
 * eligible; the preferred index (the selected comet) comes first if eligible, then the rest nearest-to-the-Sun first (ties by index), up to `cap`.
 */
export function selectTails(items: readonly { index: number; rAu: number }[], cap = TAIL_CAP, preferIndex: number | null = null): number[] {
  const ok = items.filter((x) => tailLengthUnits(x.rAu) > 0);
  ok.sort((a, b) => (a.index === preferIndex ? -1 : b.index === preferIndex ? 1 : a.rAu - b.rAu || a.index - b.index));
  return ok.slice(0, Math.max(0, cap)).map((x) => x.index);
}
