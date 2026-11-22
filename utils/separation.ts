/**
 * Distance between two Solar System bodies on a chosen date, from JPL's approximate planet positions
 * (Standish & Williams, valid 1800-2050). Only the Sun and the eight planets are supported: moon positions along their
 * orbits are illustrative in this project, so a date-specific moon distance would be invented precision.
 * Earth uses JPL's Earth-Moon barycentre row, so Earth positions can be off by up to about 4,700 km.
 */
import { PLANET_ELEMENTS } from "@/data/keplerElements";
import { norm, planetPosition, type Vec3 } from "@/utils/kepler";

export const AU_KM = 149_597_870.7; // IAU 2012 definition, exact
export const C_KM_S = 299_792.458; // speed of light, exact
export const MIN_YEAR = 1800;
export const MAX_YEAR = 2050;
const JD_J2000 = 2451545.0;

export const SEP_BODIES = ["sun", ...Object.keys(PLANET_ELEMENTS)] as const;
export type SepBody = (typeof SEP_BODIES)[number];
export const isSepBody = (id: string): id is SepBody => (SEP_BODIES as readonly string[]).includes(id);

const jd = (d: Date) => d.getTime() / 86_400_000 + 2440587.5;
export const inRange = (d: Date) => Number.isFinite(d.getTime()) && d.getUTCFullYear() >= MIN_YEAR && d.getUTCFullYear() <= MAX_YEAR;

/** Heliocentric ecliptic-J2000 position in AU, or null outside 1800-2050. */
export function bodyPosition(id: SepBody, d: Date): Vec3 | null {
  if (!inRange(d)) return null;
  if (id === "sun") return [0, 0, 0];
  return planetPosition(PLANET_ELEMENTS[id], (jd(d) - JD_J2000) / 36525);
}

export interface Separation { au: number; km: number; lightSeconds: number }

export function separation(a: SepBody, b: SepBody, d: Date): Separation | null {
  const pa = bodyPosition(a, d), pb = bodyPosition(b, d);
  if (!pa || !pb) return null;
  const au = norm([pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]]);
  const km = au * AU_KM;
  return { au, km, lightSeconds: km / C_KM_S };
}

/** Distance sampled daily from `start` for `days` days; stops at the end of the valid range. */
export function distanceSeries(a: SepBody, b: SepBody, start: Date, days: number): { t: Date; au: number }[] {
  const out: { t: Date; au: number }[] = [];
  for (let k = 0; k <= days; k++) {
    const t = new Date(start.getTime() + k * 86_400_000);
    const s = separation(a, b, t);
    if (!s) break;
    out.push({ t, au: s.au });
  }
  return out;
}

export function formatLightTime(sec: number): string {
  if (sec < 120) return `${sec.toFixed(1)} seconds`;
  if (sec < 7200) return `${(sec / 60).toFixed(1)} minutes`;
  return `${(sec / 3600).toFixed(2)} hours`;
}
