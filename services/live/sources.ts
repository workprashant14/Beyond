/** Which upstream source(s) can say something about which catalogue object. */

/** Search text for the NASA Image and Video Library (defaults to the object's name). */
export const IMAGE_QUERY: Record<string, string> = {
  sun: "Sun",
  moon: "Moon",
  earth: "Earth from space",
  "milky-way": "Milky Way galaxy",
  "sgr-a": "Sagittarius A* black hole",
  m87: "M87 black hole",
  halley: "Halley's Comet",
  "proxima-b": "Proxima Centauri",
  "trappist-1e": "TRAPPIST-1",
  "solar-system": "Solar System",
  "orion-nebula": "Orion Nebula",
  "crab-nebula": "Crab Nebula",
  andromeda: "Andromeda galaxy",
  triangulum: "Triangulum Galaxy",
  sirius: "Sirius",
  lmc: "Large Magellanic Cloud",
  "eagle-nebula": "Eagle Nebula",
  "cygnus-x1": "Cygnus X-1",
};

/** JPL Small-Body Database lookups (comets and asteroids). */
export const SBDB_TARGET: Record<string, string> = { halley: "1P", ceres: "Ceres", pluto: "Pluto", eris: "Eris", haumea: "Haumea", makemake: "Makemake", vesta: "Vesta", "67p": "67P" };

/** NASA Exoplanet Archive planet names (archive spelling first). */
export const EXOPLANET_NAMES: Record<string, string[]> = {
  "proxima-b": ["Proxima Cen b", "Proxima Centauri b"],
  "trappist-1e": ["TRAPPIST-1 e"],
  "51-pegasi-b": ["51 Peg b"],
};

/** JPL Horizons: current distance. Planet/Earth: from the Sun. Moon: from Earth. Sun: from Earth. */
export interface HorizonsTarget {
  command: string;
  center: string;
  label: string;
}
const FROM_SUN = (command: string): HorizonsTarget => ({ command, center: "500@10", label: "Distance from the Sun" });
export const HORIZONS_TARGET: Record<string, HorizonsTarget> = {
  mercury: FROM_SUN("199"),
  venus: FROM_SUN("299"),
  earth: FROM_SUN("399"),
  mars: FROM_SUN("499"),
  jupiter: FROM_SUN("599"),
  saturn: FROM_SUN("699"),
  uranus: FROM_SUN("799"),
  neptune: FROM_SUN("899"),
  // Spacecraft: JPL Horizons spacecraft ids (negative numbers).
  "voyager-1": FROM_SUN("-31"),
  "voyager-2": FROM_SUN("-32"),
  "new-horizons": FROM_SUN("-98"),
  "parker-solar-probe": FROM_SUN("-96"),
  moon: { command: "301", center: "500@399", label: "Distance from Earth" },
  sun: { command: "10", center: "500@399", label: "Distance from Earth" },
};
