/**
 * Julian Date and the time scales an ephemeris needs. Scientific time only; nothing here knows about the screen.
 *
 *  UTC  civil time (what Date holds).            TAI = UTC + (leap seconds, 10 s in 1972 up to 37 s since 2017-01-01)
 *  TT   Terrestrial Time = TAI + 32.184 s.       TDB = TT + a periodic term of at most 1.7 ms (the time argument of JPL ephemerides).
 *
 * Limits (stated, not hidden):
 *  - Leap seconds are tabulated up to 2017-01-01 (37 s). None has been announced since (as of this build); a future one would
 *    make later dates wrong by 1 s. That is far below the accuracy of any data here.
 *  - Before 1972-01-01 UTC is not defined with leap seconds, so TT - UTC there is a fixed 42.184 s and `exact` is false.
 *    The real value differs by up to about 45 s (Earth's rotation was not yet atomic-time based). Irrelevant for approximate
 *    elements, but not an ephemeris-grade conversion.
 *  - UT1 (Earth rotation) is not modelled: sidereal time elsewhere in the project treats UT = UTC (error under 0.9 s).
 */
export const J2000_JD = 2451545.0;
export const MJD_OFFSET = 2400000.5;
export const SECONDS_PER_DAY = 86400;
export const TT_MINUS_TAI = 32.184;

/** [UTC date of the change (JD at 0h), TAI - UTC in seconds from that moment on]. */
const LEAP_SECONDS: readonly (readonly [jd: number, tai: number])[] = [
  [2441317.5, 10], [2441499.5, 11], [2441683.5, 12], [2442048.5, 13], [2442413.5, 14], [2442778.5, 15], [2443144.5, 16], [2443509.5, 17], [2443874.5, 18],
  [2444239.5, 19], [2444786.5, 20], [2445151.5, 21], [2445516.5, 22], [2446247.5, 23], [2447161.5, 24], [2447892.5, 25], [2448257.5, 26], [2448804.5, 27],
  [2449169.5, 28], [2449534.5, 29], [2450083.5, 30], [2450630.5, 31], [2451179.5, 32], [2453736.5, 33], [2454832.5, 34], [2456109.5, 35], [2457204.5, 36], [2457754.5, 37],
];
export const LAST_LEAP_SECOND_JD = LEAP_SECONDS[LEAP_SECONDS.length - 1][0];

/** Julian Date (UTC days) of a JavaScript Date. */
export const julianDateUtc = (d: Date): number => d.getTime() / 86_400_000 + 2440587.5;
export const dateFromJulianDate = (jd: number): Date => new Date((jd - 2440587.5) * 86_400_000);
export const mjd = (jd: number): number => jd - MJD_OFFSET;
export const daysSinceJ2000FromJd = (jd: number): number => jd - J2000_JD;
export const centuriesSinceJ2000FromJd = (jd: number): number => (jd - J2000_JD) / 36525;

/** TAI - UTC in seconds, and whether it is a tabulated value (true) or the 1972 value reused before UTC existed (false). */
export function taiMinusUtc(jdUtc: number): { seconds: number; exact: boolean } {
  if (jdUtc < LEAP_SECONDS[0][0]) return { seconds: LEAP_SECONDS[0][1], exact: false };
  let s = LEAP_SECONDS[0][1];
  for (const [jd, tai] of LEAP_SECONDS) if (jdUtc >= jd) s = tai; else break;
  return { seconds: s, exact: true };
}

/** TT - UTC in seconds. */
export const ttMinusUtc = (jdUtc: number): { seconds: number; exact: boolean } => {
  const t = taiMinusUtc(jdUtc);
  return { seconds: t.seconds + TT_MINUS_TAI, exact: t.exact };
};

/** Julian Date in TT for a UTC Julian Date. */
export const jdTtFromUtc = (jdUtc: number): number => jdUtc + ttMinusUtc(jdUtc).seconds / SECONDS_PER_DAY;

/**
 * TDB - TT in seconds: the two largest periodic terms (Fairhead and Bretagnon; Astronomical Almanac). Within about 50 microseconds
 * of the full series for the present era.
 */
export function tdbMinusTt(jdTt: number): number {
  const g = ((357.53 + 0.98560028 * (jdTt - J2000_JD)) * Math.PI) / 180;
  return 0.001657 * Math.sin(g) + 0.000014 * Math.sin(2 * g);
}

/** Julian Date in TDB for a UTC Julian Date: the time argument JPL ephemerides and osculating elements use. */
export function jdTdbFromUtc(jdUtc: number): number {
  const tt = jdTtFromUtc(jdUtc);
  return tt + tdbMinusTt(tt) / SECONDS_PER_DAY;
}

/** Years over which the approximate JPL planet elements (data/keplerElements.ts) are stated to be valid. */
export const PLANET_ELEMENTS_VALID_FROM_JD = 2378496.5; // 1800-01-01 (Julian day number of 1800 Jan 1 0h)
export const PLANET_ELEMENTS_VALID_TO_JD = 2469807.5;   // 2050-01-01
export type ElementValidity = "valid" | "outside";
export const planetElementsValidity = (jd: number): ElementValidity => (jd >= PLANET_ELEMENTS_VALID_FROM_JD && jd <= PLANET_ELEMENTS_VALID_TO_JD ? "valid" : "outside");
