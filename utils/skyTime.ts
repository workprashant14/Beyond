/**
 * Local-sky geometry for the night-sky mode. All angles in degrees unless noted.
 * Accuracy (Estimated): sidereal time follows the standard GMST polynomial (Meeus, Astronomical Algorithms, ch. 12),
 * time is treated as UT = UTC, and J2000 catalogue positions are precessed to the date (utils/precession.ts; proper motion is applied separately in utils/properMotion.ts,
 * nutation or aberration). No atmospheric refraction. Good for "where do I look", not for pointing a telescope.
 */
const D2R = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

export function julianDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Greenwich mean sidereal time in degrees. */
export function gmstDeg(d: Date): number {
  const jd = julianDate(d);
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Local mean sidereal time in degrees; east longitude positive. */
export const lstDeg = (d: Date, lonDeg: number) => norm360(gmstDeg(d) + lonDeg);

/** Altitude and azimuth (azimuth from north through east) of an equatorial position. */
export function equatorialToHorizon(raDeg: number, decDeg: number, latDeg: number, lst: number): { alt: number; az: number } {
  const H = (lst - raDeg) * D2R, dec = decDeg * D2R, lat = latDeg * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  // Meeus azimuth is measured from the south towards the west; add 180 degrees for north-based.
  const A = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  return { alt: alt / D2R, az: norm360(A / D2R + 180) };
}

/** Inverse of equatorialToHorizon: the RA/Dec lying at a given altitude and azimuth. */
export function horizonToEquatorial(altDeg: number, azDeg: number, latDeg: number, lst: number): { ra: number; dec: number } {
  const a = altDeg * D2R, z = azDeg * D2R, f = latDeg * D2R, s = lst * D2R;
  const Z = [Math.cos(f) * Math.cos(s), Math.cos(f) * Math.sin(s), Math.sin(f)];
  const N = [-Math.sin(f) * Math.cos(s), -Math.sin(f) * Math.sin(s), Math.cos(f)];
  const E = [-Math.sin(s), Math.cos(s), 0];
  const v = [0, 1, 2].map((i) => Math.cos(a) * Math.cos(z) * N[i] + Math.cos(a) * Math.sin(z) * E[i] + Math.sin(a) * Z[i]);
  return { ra: norm360(Math.atan2(v[1], v[0]) / D2R), dec: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassPoint = (az: number) => POINTS[Math.round(norm360(az) / 22.5) % 16];

export const validLat = (x: number) => Number.isFinite(x) && x >= -90 && x <= 90;
export const validLon = (x: number) => Number.isFinite(x) && x >= -180 && x <= 180;

/** Julian centuries from J2000 for a moment. */
export const centuriesSinceJ2000 = (d: Date) => (julianDate(d) - 2451545.0) / 36525;

/** Years the time-travel model is offered for: precession is good over a few thousand years, not beyond. */
export const MIN_YEAR = -3000;
export const MAX_YEAR = 3000;

export interface UtParts { year: number; month: number; day: number; hour: number; minute: number }

const daysIn = (y: number, m: number) => [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** Moment from UT parts in the proleptic Gregorian calendar (astronomical year numbering: year 0 is 1 BCE). Null when invalid. */
export function utcFromParts(p: UtParts): Date | null {
  const { year, month, day, hour, minute } = p;
  if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > daysIn(year, month) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const d = new Date(Date.UTC(2000, month - 1, day, hour, minute));
  d.setUTCFullYear(year); // Date.UTC would map years 0 to 99 onto 1900 to 1999
  return d;
}

export const partsFromDate = (d: Date): UtParts => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() });

/** "2026-11-12 14:07", or "-0044-03-15 12:00" for years before year 0 (astronomical numbering). */
export function formatUt(d: Date): string {
  const y = d.getUTCFullYear();
  const yy = `${y < 0 ? "−" : ""}${String(Math.abs(y)).padStart(4, "0")}`;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${yy}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
