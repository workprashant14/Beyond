import { norm } from "./search";

/** Our type codes, mapped from the OpenNGC type and Hubble columns in scripts/build-sky.ts. */
export type DsoType = "g" | "e" | "s0" | "s" | "i" | "sd" | "gg" | "gp" | "gt" | "oc" | "gc" | "cn" | "hii" | "en" | "nb" | "rn" | "pn" | "snr";
export type DsoGroup = "galaxy" | "galaxyCluster" | "open" | "globular" | "nebula" | "reflection" | "planetary" | "remnant";

export const DSO_GROUPS: { key: DsoGroup; label: string; color: string; shape: number }[] = [
  // shape ids match the fragment shader: 0 circle, 1 square, 2 diamond, 3 ellipse, 4 circle + dot, 5 double ring
  { key: "galaxy", label: "Galaxies", color: "#ff7a7a", shape: 3 },
  { key: "galaxyCluster", label: "Galaxy groups & pairs", color: "#ff9f6b", shape: 5 },
  { key: "open", label: "Open clusters", color: "#ffd36b", shape: 0 },
  { key: "globular", label: "Globular clusters", color: "#ffb347", shape: 4 },
  { key: "nebula", label: "Emission & other nebulae", color: "#ff6fd8", shape: 1 },
  { key: "reflection", label: "Reflection nebulae", color: "#6f8cff", shape: 1 },
  { key: "planetary", label: "Planetary nebulae", color: "#4fe3d6", shape: 2 },
  { key: "remnant", label: "Supernova remnants", color: "#c27bff", shape: 2 },
];
const GROUP_INDEX = Object.fromEntries(DSO_GROUPS.map((g, i) => [g.key, i])) as Record<DsoGroup, number>;

export const DSO_TYPE: Record<DsoType, { label: string; group: DsoGroup }> = {
  g: { label: "Galaxy", group: "galaxy" },
  e: { label: "Elliptical galaxy", group: "galaxy" },
  s0: { label: "Lenticular galaxy", group: "galaxy" },
  s: { label: "Spiral galaxy", group: "galaxy" },
  i: { label: "Irregular galaxy", group: "galaxy" },
  sd: { label: "Dwarf spheroidal galaxy", group: "galaxy" },
  gg: { label: "Group of galaxies", group: "galaxyCluster" },
  gp: { label: "Galaxy pair", group: "galaxyCluster" },
  gt: { label: "Galaxy triplet", group: "galaxyCluster" },
  oc: { label: "Open star cluster", group: "open" },
  cn: { label: "Star cluster with nebulosity", group: "open" },
  gc: { label: "Globular star cluster", group: "globular" },
  hii: { label: "H II region (emission nebula)", group: "nebula" },
  en: { label: "Emission nebula", group: "nebula" },
  nb: { label: "Nebula (type not specified)", group: "nebula" },
  rn: { label: "Reflection nebula", group: "reflection" },
  pn: { label: "Planetary nebula", group: "planetary" },
  snr: { label: "Supernova remnant", group: "remnant" },
};

export const isDsoType = (t: string): t is DsoType => t in DSO_TYPE;
export const dsoTypeLabel = (t: string) => (isDsoType(t) ? DSO_TYPE[t].label : null);
export const dsoGroupIndex = (t: string) => (isDsoType(t) ? GROUP_INDEX[DSO_TYPE[t].group] : -1);

/** Faintest object drawn at a given field of view (degrees): zoom in and fainter objects appear (level of detail). */
export function dsoMagLimit(fovDeg: number): number {
  return fovDeg > 60 ? 8 : fovDeg > 35 ? 10 : fovDeg > 18 ? 12 : 14.5;
}

/** Marker size in pixels from the angular size (arcminutes); a drawing choice, not a physical size. */
export function dsoMarkerPx(majorArcmin: number | null): number {
  if (majorArcmin === null || !(majorArcmin > 0)) return 9;
  return Math.min(22, 9 + 5 * Math.log10(1 + majorArcmin));
}

/** Field of view (degrees) that frames an object of this angular size comfortably. */
export function dsoFocusFov(majorArcmin: number | null): number {
  const deg = (majorArcmin ?? 0) / 60;
  return Math.max(6, Math.min(45, deg * 3));
}

/** Search key without spaces, so "m31" and "ngc224" work like "M 31" and "NGC 224". */
export const compactKey = (s: string) => norm(s).replace(/ /g, "");

export function messierName(desig: string): string | null {
  const m = /^M (\d{1,3})$/.exec(desig);
  return m ? `Messier ${m[1]}` : null;
}

export function formatArcmin(a: number | null, b: number | null): string | null {
  if (a === null || !(a > 0)) return null;
  const f = (x: number) => (x >= 10 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, "");
  return b !== null && b > 0 && Math.abs(a - b) > 0.05 ? `${f(a)}′ × ${f(b)}′` : `${f(a)}′`;
}

/** Display title: proper name, else Messier name, else designation. */
export function dsoTitle(name: string | undefined, desig: string, id: string): string {
  return name ?? messierName(desig) ?? (desig || id);
}
