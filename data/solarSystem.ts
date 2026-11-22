import type { PlanetTexture } from "@/universe/objects/planetTextures";

/**
 * Orbital / physical parameters used to drive the 3D solar system.
 *
 * Sources: NASA Planetary Fact Sheets (radius, rotation, tilt, orbital period,
 * semi-major axis) and JPL "Keplerian Elements for Approximate Positions of the
 * Major Planets" (mean longitude at J2000). Orbits use JPL Keplerian elements
 * (data/keplerElements.ts); only semi-major axes are compressed. Everything visual (sizes, spacing) is
 * compressed and not to scale — see universe/objects/solarScale.ts.
 *
 * Planet radii are volumetric mean radii.
 */
export interface SolarBody {
  id: string;
  kind: "star" | "planet" | "moon";
  parent?: string;
  /** Planets: semi-major axis in AU. */
  semiMajorAxisAU?: number;
  /** Orbital period in Earth days. */
  orbitalPeriodDays?: number;
  /** Mean longitude at J2000 (degrees). */
  meanLongitudeJ2000Deg?: number;
  /** Sidereal rotation period, magnitude only, in hours. */
  rotationHours: number;
  /** Tilt of the spin axis (degrees). >90 means retrograde spin. */
  axialTiltDeg: number;
  radiusKm: number;
  texture: PlanetTexture;
  rings?: boolean;
  /** Moons that always show the same face to their parent. */
  tidallyLocked?: boolean;
  /** Marker glow colour (artistic). */
  glow: string;
}

export const SOLAR_BODIES: SolarBody[] = [
  { id: "sun", kind: "star", rotationHours: 601.2, axialTiltDeg: 7.25, radiusKm: 695700, texture: "sun", glow: "#ffcf80" },
  { id: "mercury", kind: "planet", semiMajorAxisAU: 0.387, orbitalPeriodDays: 87.969, meanLongitudeJ2000Deg: 252.25, rotationHours: 1407.6, axialTiltDeg: 0.03, radiusKm: 2439.7, texture: "mercury", glow: "#b8b0a6" },
  { id: "venus", kind: "planet", semiMajorAxisAU: 0.723, orbitalPeriodDays: 224.701, meanLongitudeJ2000Deg: 181.98, rotationHours: 5832.5, axialTiltDeg: 177.36, radiusKm: 6051.8, texture: "venus", glow: "#f0d9a0" },
  { id: "earth", kind: "planet", semiMajorAxisAU: 1.0, orbitalPeriodDays: 365.256, meanLongitudeJ2000Deg: 100.46, rotationHours: 23.934, axialTiltDeg: 23.44, radiusKm: 6371.0, texture: "earth", glow: "#6fa8ff" },
  { id: "moon", kind: "moon", parent: "earth", orbitalPeriodDays: 27.3217, meanLongitudeJ2000Deg: 218.3, rotationHours: 655.7, axialTiltDeg: 1.5, radiusKm: 1737.4, texture: "moon", tidallyLocked: true, glow: "#cfcfd6" },
  { id: "mars", kind: "planet", semiMajorAxisAU: 1.524, orbitalPeriodDays: 686.98, meanLongitudeJ2000Deg: 355.45, rotationHours: 24.623, axialTiltDeg: 25.19, radiusKm: 3389.5, texture: "mars", glow: "#e0704a" },
  { id: "jupiter", kind: "planet", semiMajorAxisAU: 5.203, orbitalPeriodDays: 4332.59, meanLongitudeJ2000Deg: 34.4, rotationHours: 9.925, axialTiltDeg: 3.13, radiusKm: 69911, texture: "jupiter", glow: "#e0bf90" },
  { id: "io", kind: "moon", parent: "jupiter", orbitalPeriodDays: 1.762732, rotationHours: 42.31, axialTiltDeg: 0, radiusKm: 1821.6, texture: "moon", tidallyLocked: true, glow: "#d8c98a" },
  { id: "europa", kind: "moon", parent: "jupiter", orbitalPeriodDays: 3.525463, rotationHours: 84.61, axialTiltDeg: 0, radiusKm: 1560.8, texture: "moon", tidallyLocked: true, glow: "#d9d2c4" },
  { id: "ganymede", kind: "moon", parent: "jupiter", orbitalPeriodDays: 7.155588, rotationHours: 171.73, axialTiltDeg: 0, radiusKm: 2631.2, texture: "moon", tidallyLocked: true, glow: "#bdb6a8" },
  { id: "callisto", kind: "moon", parent: "jupiter", orbitalPeriodDays: 16.69044, rotationHours: 400.57, axialTiltDeg: 0, radiusKm: 2410.3, texture: "moon", tidallyLocked: true, glow: "#9a948a" },
  { id: "saturn", kind: "planet", semiMajorAxisAU: 9.537, orbitalPeriodDays: 10759.22, meanLongitudeJ2000Deg: 49.95, rotationHours: 10.656, axialTiltDeg: 26.73, radiusKm: 58232, texture: "saturn", rings: true, glow: "#f0dca8" },
  { id: "titan", kind: "moon", parent: "saturn", orbitalPeriodDays: 15.945448, rotationHours: 382.69, axialTiltDeg: 0, radiusKm: 2574.73, texture: "moon", tidallyLocked: true, glow: "#d9b46a" },
  { id: "uranus", kind: "planet", semiMajorAxisAU: 19.191, orbitalPeriodDays: 30687, meanLongitudeJ2000Deg: 313.24, rotationHours: 17.24, axialTiltDeg: 97.77, radiusKm: 25362, texture: "uranus", glow: "#8fe8ee" },
  { id: "neptune", kind: "planet", semiMajorAxisAU: 30.069, orbitalPeriodDays: 60190, meanLongitudeJ2000Deg: 304.88, rotationHours: 16.11, axialTiltDeg: 28.32, radiusKm: 24622, texture: "neptune", glow: "#5f7dff" },
];

const byId = new Map(SOLAR_BODIES.map((b) => [b.id, b]));

export const getSolarBody = (id: string | null | undefined): SolarBody | undefined =>
  id ? byId.get(id) : undefined;

/** True for the Solar System overview and every body inside it. */
export const isSolarId = (id: string | null | undefined): boolean =>
  !!id && (id === "solar-system" || byId.has(id));
