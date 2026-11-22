import type { SolarBody } from "@/data/solarSystem";
import { MOON_ELEMENTS, PLANET_ELEMENTS } from "@/data/keplerElements";
import { moonPosition, norm, planetPosition } from "@/utils/kepler";
import { orbitPosition } from "./orbits";
import { barycentreFromSun, hasStateVector, heliocentricState, speedKmS } from "@/utils/stateVectors";
import { visualRadius } from "./solarScale";
import { SUN_VISUAL_RADIUS } from "./solarScale";

export const KM_PER_AU = 149_597_870.7;

export interface ScaleReadout {
  /** What the real distance is measured from ("the Sun" or the parent body id). */
  from: string;
  realDistanceKm: number | null;
  /** Distance as drawn, in scene units (null for the Sun). */
  drawnDistance: number | null;
  realRadiusKm: number;
  drawnRadius: number;
  /** Real radius divided by the drawn radius is not a constant: radius is compressed with a power law, so also report the exaggeration factor of the drawn size against a true-scale body drawn at the same orbit scale. */
  radiusExaggeration: number | null;
  /** Heliocentric orbital speed in km/s (planets only; the Earth row is the Earth-Moon barycentre). */
  speedKmS: number | null;
  /** Sun only: distance of the Sun's centre from the Solar System barycentre, km. */
  barycentreOffsetKm: number | null;
}

/**
 * Real versus drawn numbers for one body at a clock time, so the exaggeration is visible instead of silent.
 * Real distances come from the same elements as the drawing (planets: JPL approximate method, valid 1800-2050;
 * moons: mean elements, illustrative position). Nothing here is invented: a body without elements returns null distances.
 */
export function scaleReadout(b: SolarBody, days: number): ScaleReadout {
  const drawnRadius = b.kind === "star" ? SUN_VISUAL_RADIUS : visualRadius(b.radiusKm);
  const pl = PLANET_ELEMENTS[b.id], mo = MOON_ELEMENTS[b.id];
  let realDistanceKm: number | null = null;
  let drawnDistance: number | null = null;
  let from = b.parent ?? "sun";
  if (pl) realDistanceKm = norm(planetPosition(pl, days / 36525)) * KM_PER_AU;
  else if (mo) realDistanceKm = norm(moonPosition(mo, days));
  if (pl || mo) { const p = orbitPosition(b, days); drawnDistance = Math.hypot(p[0], p[1], p[2]); }
  if (b.kind === "star") from = "";
  // Scene units per km along this body's orbit (distance compression), so the size can be compared at one scale.
  let radiusExaggeration: number | null = null;
  if (realDistanceKm && drawnDistance) radiusExaggeration = drawnRadius / ((b.radiusKm * drawnDistance) / realDistanceKm);
  const speed = hasStateVector(b.id) ? speedKmS(heliocentricState(b.id, days).velocity) : null;
  const bary = b.kind === "star" ? Math.hypot(...barycentreFromSun(days).position) : null;
  return { from, realDistanceKm, drawnDistance, realRadiusKm: b.radiusKm, drawnRadius, radiusExaggeration, speedKmS: speed, barycentreOffsetKm: bary };
}

export function formatReadout(b: SolarBody, r: ScaleReadout): string {
  const km = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} million km` : `${Math.round(v).toLocaleString("en-US")} km`);
  const dist = r.realDistanceKm === null ? "distance: Data unavailable" : `real distance from ${r.from === "sun" ? "the Sun" : r.from} ${km(r.realDistanceKm)}`;
  const size = `real radius ${Math.round(r.realRadiusKm).toLocaleString("en-US")} km`;
  const ex = r.radiusExaggeration === null ? "" : ` · drawn about ${r.radiusExaggeration >= 10 ? Math.round(r.radiusExaggeration).toLocaleString("en-US") : r.radiusExaggeration.toFixed(1)}× larger than true scale at this orbit scale`;
  const spd = r.speedKmS === null ? "" : ` · orbital speed ${r.speedKmS.toFixed(2)} km/s`;
  const bc = r.barycentreOffsetKm === null ? "" : ` · centre is ${km(r.barycentreOffsetKm)} (${(r.barycentreOffsetKm / b.radiusKm).toFixed(2)} Sun radii) from the Solar System barycentre`;
  return `${b.id[0].toUpperCase()}${b.id.slice(1)}: ${dist} · ${size}${ex}${spd}${bc}`;
}
