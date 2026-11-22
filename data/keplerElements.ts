/**
 * Real orbital elements, transcribed from two JPL Solar System Dynamics pages on 2026-11-11
 * (read through a fetch tool that summarises pages, so every number is also checked by tests/orbits.test.ts).
 *
 * PLANETS — "Keplerian Elements for Approximate Positions of the Major Planets", Table 1
 * (E.M. Standish and J.G. Williams), https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *   Valid 1800 AD to 2050 AD. Heliocentric, mean ecliptic and equinox of J2000.
 *   Each element is [value at J2000, rate per Julian century]: a (au), e, I (deg), L mean longitude (deg),
 *   varpi longitude of perihelion (deg), Omega longitude of ascending node (deg).
 *   The page's stated nominal errors for 1800-2050: Mercury 15 arcsec in longitude, Jupiter 400, Saturn 600.
 *   "earth" uses the page's Earth-Moon barycentre row, which differs from Earth's centre by under 5,000 km.
 *
 * MOONS — "Planetary Satellite Mean Elements", https://ssd.jpl.nasa.gov/sats/elem/sep.html, epoch 2000-01-01.5 TDB.
 *   The page says: "These mean orbital parameters are not intended for ephemeris computation" and that they
 *   describe "the general shape and orientation of a planetary satellite's orbit".
 *   Node is "measured from the node of the reference plane on the ICRF equator". The Moon's elements are
 *   ecliptic; the others are Laplace-plane elements with the pole (R.A., Dec. w.r.t. ICRF) given per moon.
 *   Mars's moons were left out: their pole columns were not in the text this build could read.
 */
export type Rated = readonly [value: number, ratePerCentury: number];

export interface PlanetElements {
  a: Rated;
  e: Rated;
  I: Rated;
  L: Rated;
  varpi: Rated;
  Omega: Rated;
}

export const PLANET_ELEMENTS: Record<string, PlanetElements> = {
  mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], varpi: [77.45779628, 0.16047689], Omega: [48.33076593, -0.12534081] },
  venus: { a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889], L: [181.9790995, 58517.81538729], varpi: [131.60246718, 0.00268329], Omega: [76.67984255, -0.27769418] },
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], varpi: [102.93768193, 0.32327364], Omega: [0.0, 0.0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], varpi: [-23.94362959, 0.44441088], Omega: [49.55953891, -0.29257343] },
  jupiter: { a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], varpi: [14.72847983, 0.21252668], Omega: [100.47390909, 0.20469106] },
  saturn: { a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], varpi: [92.59887831, -0.41897216], Omega: [113.66242448, -0.28867794] },
  uranus: { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], varpi: [170.9542763, 0.40805281], Omega: [74.01692503, 0.04240589] },
  neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], varpi: [44.96476227, -0.32241464], Omega: [131.78422574, -0.00508664] },
};

export interface MoonElements {
  parent: string;
  /** Semi-major axis in km. */
  aKm: number;
  e: number;
  /** Argument of periapsis, mean anomaly at the epoch, inclination, node: degrees. */
  omega: number;
  M0: number;
  i: number;
  node: number;
  /** Period in days, as printed in the table. */
  periodDays: number;
  /** Reference plane: the ecliptic, or the Laplace plane with this pole (R.A., Dec. in degrees, ICRF). */
  plane: "ecliptic" | { raDeg: number; decDeg: number };
}

export const MOON_ELEMENTS: Record<string, MoonElements> = {
  moon: { parent: "earth", aKm: 384400, e: 0.0554, omega: 318.15, M0: 135.27, i: 5.16, node: 125.08, periodDays: 27.322, plane: "ecliptic" },
  io: { parent: "jupiter", aKm: 421800, e: 0.004, omega: 49.1, M0: 330.9, i: 0.0, node: 0.0, periodDays: 1.762732, plane: { raDeg: 268.1, decDeg: 64.5 } },
  europa: { parent: "jupiter", aKm: 671100, e: 0.009, omega: 45.0, M0: 345.4, i: 0.5, node: 184.0, periodDays: 3.525463, plane: { raDeg: 268.1, decDeg: 64.5 } },
  ganymede: { parent: "jupiter", aKm: 1070400, e: 0.001, omega: 198.3, M0: 324.8, i: 0.2, node: 58.5, periodDays: 7.155588, plane: { raDeg: 268.2, decDeg: 64.6 } },
  callisto: { parent: "jupiter", aKm: 1882700, e: 0.007, omega: 43.8, M0: 87.4, i: 0.3, node: 309.1, periodDays: 16.69044, plane: { raDeg: 268.7, decDeg: 64.8 } },
  titan: { parent: "saturn", aKm: 1221900, e: 0.029, omega: 78.3, M0: 11.7, i: 0.3, node: 78.6, periodDays: 15.945448, plane: { raDeg: 36.4, decDeg: 84.0 } },
};
