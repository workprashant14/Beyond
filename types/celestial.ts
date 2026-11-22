export type ObjectCategory =
  | "star"
  | "planet"
  | "moon"
  | "dwarf-planet"
  | "asteroid"
  | "region"
  | "spacecraft"
  | "pulsar"
  | "quasar"
  | "comet"
  | "galaxy"
  | "nebula"
  | "black-hole"
  | "exoplanet"
  | "system";

export interface DataSource {
  label: string;
  url: string;
}

/**
 * Every scientific value is nullable. `null` means "we do not have a verified
 * value yet" and the UI must render "Data unavailable" — never a guess.
 */
export interface CelestialObject {
  id: string;
  name: string;
  category: ObjectCategory;
  /** Short, factual one-liner used in cards and search results. */
  summary: string;
  /** Mean diameter, human readable (e.g. "12,742 km"). */
  diameter: string | null;
  /** Distance from the Sun / Earth, human readable. */
  distance: string | null;
  /** Mass, human readable (e.g. "5.972 × 10²⁴ kg"). */
  mass: string | null;
  /** Sidereal rotation period, human readable. */
  rotationPeriod: string | null;
  /** Typical temperature, human readable (only where a verified figure exists). */
  temperature: string | null;
  /** What it is made of, in one line. */
  composition: string | null;
  /** Who discovered it / when, in one line. */
  discovery: string | null;
  /** Orbital period, human readable. */
  orbitalPeriod: string | null;
  /** Featured on the homepage discovery section. */
  featured?: boolean;
  /** Shown in "Popular objects". */
  popular?: boolean;
  keywords: string[];
  related: string[];
  sources: DataSource[];
  /** Shown instead of the default note when an entry needs a specific provenance statement (regions, theoretical objects). */
  caveat?: string;
}

export const CATEGORY_LABEL: Record<ObjectCategory, string> = {
  star: "Star",
  planet: "Planet",
  moon: "Moon",
  "dwarf-planet": "Dwarf planet",
  asteroid: "Asteroid",
  region: "Region",
  spacecraft: "Spacecraft",
  pulsar: "Pulsar",
  quasar: "Quasar",
  comet: "Comet",
  galaxy: "Galaxy",
  nebula: "Nebula",
  "black-hole": "Black hole",
  exoplanet: "Exoplanet",
  system: "Planetary system",
};
