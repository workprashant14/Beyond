import { SCENE_OBJECTS } from "@/universe/objects/sceneConfig";
import { SOLAR_BODIES } from "@/data/solarSystem";
import { bodyOrbitRadius, orbitPath, orbitPosition } from "@/universe/objects/orbits";
import { mulberry32 } from "@/utils/random";

/**
 * 2D COSMIC MAP DATA.
 *
 * Catalogued objects (from data/objects.json) are drawn as solid markers.
 * Everything else (dust, spiral arms) is ILLUSTRATIVE and styled differently.
 *
 * Galaxy / universe layouts reuse the schematic 3D scene positions (NOT real
 * coordinates). Solar-system positions are computed from orbital periods on
 * JPL Keplerian orbits for a given date, with compressed semi-major axes.
 */
export type MapLevelId = "universe" | "galaxy" | "solar";

export interface MapLevel {
  id: MapLevelId;
  label: string;
  note: string;
}

export const MAP_LEVELS: MapLevel[] = [
  {
    id: "universe",
    label: "Universe",
    note: "Schematic layout of catalogued galaxies and black holes. Positions are artistic, not real coordinates; real distances are in each object's panel.",
  },
  {
    id: "galaxy",
    label: "Milky Way",
    note: "Schematic Milky Way. Object placement and spiral arms are illustrative, not a real galactic map.",
  },
  {
    id: "solar",
    label: "Solar System",
    note: "Planet positions are computed for the simulated date from JPL Keplerian elements (1800 to 2050 AD). Orbit sizes are compressed, so this is not to scale; orbit shapes are real.",
  },
];

export const getLevel = (id: string | null | undefined): MapLevel =>
  MAP_LEVELS.find((l) => l.id === id) ?? MAP_LEVELS[0];

export const isLevelId = (v: string | null | undefined): v is MapLevelId => MAP_LEVELS.some((l) => l.id === v);

export interface MapItem {
  id: string;
  level: MapLevelId;
  x: number;
  y: number;
  /** Marker radius in screen pixels (before zoom; markers keep constant screen size). */
  r: number;
  color: string;
  /** Hide this marker while it is closer than ~14px to the marker with this id (declutter). */
  declutterAgainst?: string;
  /** Zoom multiple (relative to the fit view) used when this item is selected. Default 2.2. */
  focusZoom?: number;
}

/** Which level each object belongs to (used to jump to the right level from a search). */
const LEVEL_OF = new Map<string, MapLevelId>();
const colorByKind: Record<string, string> = {
  galaxy: "#a78bff",
  nebula: "#ff7ab6",
  "black-hole": "#ffb36b",
  "star-system": "#ffd27a",
};

function galaxyAndUniverseItems(): MapItem[] {
  return SCENE_OBJECTS.map((o) => {
    const level: MapLevelId = o.parent === "milky-way" ? "galaxy" : "universe";
    const r = o.kind === "galaxy" ? 11 : o.kind === "star-system" ? 7 : o.kind === "black-hole" ? 7 : 8;
    return { id: o.id, level, x: o.position[0], y: o.position[2], r, color: colorByKind[o.kind] ?? "#e8ecff" };
  });
}

/** Marker radius in px: bigger bodies look bigger, within a readable range. */
const solarMarkerRadius = (radiusKm: number, isStar: boolean) => (isStar ? 9 : 3.5 + 4.5 * Math.pow(radiusKm / 70000, 0.35));

function solarItems(days: number): MapItem[] {
  const out: MapItem[] = [];
  let earth: [number, number, number] = [0, 0, 0];
  for (const b of SOLAR_BODIES) {
    if (b.parent) continue;
    const p = orbitPosition(b, days);
    if (b.id === "earth") earth = p;
    out.push({
      id: b.id,
      level: "solar",
      x: p[0],
      y: p[2],
      r: solarMarkerRadius(b.radiusKm, b.kind === "star"),
      color: b.glow,
      focusZoom: b.id === "earth" ? 4.2 : undefined,
    });
  }
  const moon = SOLAR_BODIES.find((b) => b.id === "moon");
  if (moon) {
    const m = orbitPosition(moon, days);
    // m is relative to Earth; shift it onto Earth.
    out.push({
      id: "moon",
      level: "solar",
      x: earth[0] + m[0],
      y: earth[2] + m[2],
      r: 3,
      color: moon.glow,
      declutterAgainst: "earth",
      focusZoom: 5,
    });
  }
  return out;
}

for (const i of galaxyAndUniverseItems()) LEVEL_OF.set(i.id, i.level);
for (const b of SOLAR_BODIES) if (!b.parent || b.id === "moon") LEVEL_OF.set(b.id, "solar"); // other moons exist only in the 3D view

export const getObjectLevel = (id: string | null | undefined): MapLevelId | undefined => (id ? LEVEL_OF.get(id) : undefined);

export function getMapItems(level: MapLevelId, days: number): MapItem[] {
  if (level === "solar") return solarItems(days);
  return galaxyAndUniverseItems().filter((i) => i.level === level);
}

/** Object that opens a deeper level when "zoomed into". */
export const DRILL_DOWN: Record<string, MapLevelId> = { "milky-way": "galaxy", "solar-system": "solar" };

/** Planet orbit paths as SVG point strings (top-down: scene x, z). Compressed semi-major axes, real shapes. */
const pathPoints = (id: string): string =>
  orbitPath(SOLAR_BODIES.find((b) => b.id === id)!, 192).map((p) => `${p[0].toFixed(3)},${p[2].toFixed(3)}`).join(" ");
export const SOLAR_ORBIT_PATHS: { id: string; points: string }[] = SOLAR_BODIES.filter((b) => b.kind === "planet").map((b) => ({ id: b.id, points: pathPoints(b.id) }));
export const MOON_ORBIT_POINTS = pathPoints("moon");

/** Largest planet orbit radius (world units), used for framing. */
export const SOLAR_ORBIT_RADII: number[] = SOLAR_BODIES.filter((b) => b.kind === "planet").map((b) => bodyOrbitRadius(b));

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function boundsOf(items: MapItem[], level: MapLevelId): Bounds {
  if (level === "solar") {
    const r = Math.max(...SOLAR_ORBIT_RADII) * 1.05;
    return { minX: -r, maxX: r, minY: -r, maxY: r };
  }
  if (level === "galaxy") return { minX: -38, maxX: 38, minY: -38, maxY: 38 };
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const pad = 30;
  return {
    minX: Math.min(...xs) - pad,
    maxX: Math.max(...xs) + pad,
    minY: Math.min(...ys) - pad,
    maxY: Math.max(...ys) + pad,
  };
}

/** ILLUSTRATIVE background stars in world units, deterministic per level. */
export function dustFor(level: MapLevelId, count = 260): { x: number; y: number; a: number }[] {
  const b = boundsOf(getMapItems(level, 0), level);
  const rand = mulberry32(level === "universe" ? 101 : level === "galaxy" ? 202 : 303);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return Array.from({ length: count }, () => ({
    x: b.minX - w * 0.6 + rand() * w * 2.2,
    y: b.minY - h * 0.6 + rand() * h * 2.2,
    a: 0.15 + rand() * 0.45,
  }));
}

/** ILLUSTRATIVE spiral arms for the galaxy level (same shape family as the 3D galaxy). */
export function spiralArmPaths(arms = 4, radius = 34): string[] {
  const paths: string[] = [];
  for (let a = 0; a < arms; a++) {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = 0.06 + (i / 60) * 0.94;
      const ang = t * 5.2 + (a * Math.PI * 2) / arms;
      pts.push(`${(Math.cos(ang) * t * radius).toFixed(2)},${(-Math.sin(ang) * t * radius).toFixed(2)}`);
    }
    paths.push(`M${pts.join("L")}`);
  }
  return paths;
}

/** Label priority: higher wins when labels collide. */
export const LABEL_WEIGHT: Record<string, number> = {
  galaxy: 6,
  system: 6,
  star: 5,
  "black-hole": 5,
  planet: 4,
  exoplanet: 3,
  nebula: 3,
  moon: 1,
};
