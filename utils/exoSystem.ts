/**
 * Layout for the top-down diagram of one exoplanet system. Only catalogue numbers are used:
 * semi-major axis (log-scaled so a 0.02 au and a 30 au planet fit one picture) and planet radius.
 * NOT known and therefore NOT drawn: orbit shape (eccentricity is not in the bundled data, rings are circles),
 * where each planet is on its orbit (angles are spread out only so dots do not overlap), orbit tilt, and the star's size.
 * Dot size is a display choice, not to scale with the orbits.
 */
import type { Exoplanet } from "./exoplanets";

export const VIEW = 320; // svg viewBox side
export const CENTER = VIEW / 2;
/** Fixed log domain in au so every system uses the same scale (0.01 au is inside Mercury's orbit, 100 au beyond Neptune's). */
export const AU_MIN = 0.01;
export const AU_MAX = 100;
const R_MIN = 22;
const R_MAX = 146;

/** Pixel radius of an orbit with semi-major axis `au` (clamped to the fixed domain). */
export function orbitRadiusPx(au: number): number {
  const c = Math.min(AU_MAX, Math.max(AU_MIN, au));
  return R_MIN + ((Math.log10(c) - Math.log10(AU_MIN)) / (Math.log10(AU_MAX) - Math.log10(AU_MIN))) * (R_MAX - R_MIN);
}

/** Dot radius in px: grows slowly with radius in Earth radii; null size gets a fixed small hollow dot. */
export function dotRadiusPx(rEarth: number | null): number {
  return rEarth === null || rEarth <= 0 ? 3 : Math.min(9, 2.5 + 2.2 * Math.log10(1 + rEarth));
}

export interface PlacedPlanet {
  name: string;
  au: number;
  clamped: boolean;
  r: number; // orbit radius px
  dot: number; // dot radius px
  sizeKnown: boolean;
  x: number;
  y: number;
  selected: boolean;
}

export interface SystemLayout {
  host: string;
  placed: PlacedPlanet[];
  /** Planets of the system with no semi-major axis in the catalogue: listed, not drawn. */
  noOrbit: string[];
  refRings: { au: number; r: number; label: string }[];
}

export function systemLayout(planets: Exoplanet[], selected: string): SystemLayout {
  const host = planets[0]?.h ?? "";
  const withA = planets.filter((p) => p.a !== null && p.a > 0).sort((p, q) => (p.a as number) - (q.a as number));
  const placed = withA.map((p, i) => {
    const au = p.a as number;
    const r = orbitRadiusPx(au);
    const ang = (-90 + (360 * i) / Math.max(1, withA.length)) * (Math.PI / 180);
    return {
      name: p.n, au, clamped: au < AU_MIN || au > AU_MAX, r, dot: dotRadiusPx(p.r), sizeKnown: p.r !== null && p.r > 0,
      x: CENTER + r * Math.cos(ang), y: CENTER + r * Math.sin(ang), selected: p.n === selected,
    };
  });
  return {
    host,
    placed,
    noOrbit: planets.filter((p) => !(p.a !== null && p.a > 0)).map((p) => p.n),
    refRings: [
      { au: 0.1, r: orbitRadiusPx(0.1), label: "0.1 au" },
      { au: 1, r: orbitRadiusPx(1), label: "1 au (Earth's orbit)" },
      { au: 10, r: orbitRadiusPx(10), label: "10 au" },
    ],
  };
}
