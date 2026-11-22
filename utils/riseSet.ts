/**
 * Rise, transit and set of a fixed sky position (a star or deep-sky object) for an observer.
 * Geometry only (Estimated): the geometric horizon (altitude 0°, no refraction, flat local horizon), RA/Dec of date held fixed
 * over the next day (the caller precesses/moves them first), time = UT, mean sidereal time (utils/skyTime.ts).
 * Hour angle at the horizon: cos H0 = -tan(lat) tan(dec). |value| > 1 means the object never rises or never sets.
 * Checked against astropy AltAz (no refraction) in tests/fixtures/riseset_oracle.json.
 */
import { gmstDeg } from "./skyTime";

const D2R = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;
/** Degrees of sidereal rotation per UT day (GMST rate). */
export const SIDEREAL_DEG_PER_DAY = 360.98564736629;
const DAY_MS = 86400000;

export type RiseSet =
  | { kind: "normal"; rise: Date; transit: Date; set: Date }
  | { kind: "circumpolar"; transit: Date }
  | { kind: "never-rises" };

/** First time at or after `from` when the hour angle equals `ha` degrees. */
function nextAtHourAngle(from: Date, raDeg: number, lonDeg: number, ha: number): Date {
  const lst = norm360(gmstDeg(from) + lonDeg);
  const delta = norm360(raDeg + ha - lst); // sidereal degrees still to turn
  return new Date(from.getTime() + (delta / SIDEREAL_DEG_PER_DAY) * DAY_MS);
}

export function riseSet(raDeg: number, decDeg: number, latDeg: number, lonDeg: number, from: Date): RiseSet {
  const c = -Math.tan(latDeg * D2R) * Math.tan(decDeg * D2R);
  if (c > 1) return { kind: "never-rises" };
  const transit = nextAtHourAngle(from, raDeg, lonDeg, 0);
  if (c < -1) return { kind: "circumpolar", transit };
  const h0 = Math.acos(c) / D2R;
  return {
    kind: "normal",
    rise: nextAtHourAngle(from, raDeg, lonDeg, -h0),
    transit,
    set: nextAtHourAngle(from, raDeg, lonDeg, h0),
  };
}
