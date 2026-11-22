/**
 * Gravitational parameters (GM) used for state vectors and the Solar System barycentre.
 *
 * Source: JPL Solar System Dynamics, "Astrodynamic Parameters" (https://ssd.jpl.nasa.gov/astro_par.html), read 2026-11-16 through a
 * fetch tool that summarises pages. Values there come from the JPL ephemeris DE440 (Park et al. 2021). The page gives no uncertainties.
 * Cross-checks done in tests/statevectors.test.ts: Earth + Moon = 403503.235625 km^3/s^2 (matches the value remembered from DE440),
 * and the Sun/Jupiter-system mass ratio is about 1047.35.
 * The Sun's value is printed in m^3/s^2 (1.32712440041279419e20) and converted to km^3/s^2 here.
 * Planet "systems" include their moons, which is what a barycentre calculation needs.
 */
export const GM_SUN_KM3_S2 = 1.32712440041279419e11;

/** km^3/s^2. Key "earth" is the Earth + Moon system, because the elements for "earth" are the Earth-Moon barycentre row. */
export const GM_SYSTEM_KM3_S2: Record<string, number> = {
  mercury: 22031.868551,
  venus: 324858.592,
  earth: 398600.435507 + 4902.800118,
  mars: 42828.375816,
  jupiter: 126712764.1,
  saturn: 37940584.8418,
  uranus: 5794556.4,
  neptune: 6836527.10058,
};

/** Not used by the barycentre (no elements for Pluto in the approximate-position table). */
export const GM_PLUTO_SYSTEM_KM3_S2 = 975.5;
