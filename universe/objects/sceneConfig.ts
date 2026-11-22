/**
 * ARTISTIC SCENE LAYOUT.
 * Positions, sizes and appearance here are schematic and NOT to scale.
 * Scientific values for each object live in data/objects.json (matched by `id`).
 *
 * Hierarchy: objects with a `parent` only appear once that parent (or a sibling)
 * is selected, so the scene never loads the whole universe at once.
 */
export type SceneKind = "galaxy" | "nebula" | "black-hole" | "star-system";

export interface SceneObject {
  id: string;
  kind: SceneKind;
  position: [number, number, number];
  /** Visual radius in scene units. */
  radius: number;
  /** Camera distance when this object is focused. */
  focusDistance: number;
  parent?: string;
  seed: number;
  /** Euler tilt for galaxies / accretion disks. */
  tilt?: [number, number, number];
  color?: string;
  /** Black holes only: radius of the host galaxy drawn around it (M87* sits in the elliptical galaxy M87). */
  hostRadius?: number;
  /** Id of the galaxy record in data/galaxyMorphology.json used for the host. */
  hostGalaxy?: string;
}

export const SCENE_OBJECTS: SceneObject[] = [
  { id: "milky-way", kind: "galaxy", position: [0, 0, 0], radius: 34, focusDistance: 100, seed: 11, tilt: [0.18, 0, 0.06] },
  { id: "andromeda", kind: "galaxy", position: [150, 28, -110], radius: 30, focusDistance: 85, seed: 23, tilt: [0.9, 0.3, 0.4] },
  { id: "triangulum", kind: "galaxy", position: [190, -10, 40], radius: 18, focusDistance: 55, seed: 29, tilt: [0.5, 0.2, 0.7] },
  { id: "lmc", kind: "galaxy", position: [-60, -22, 50], radius: 9, focusDistance: 30, seed: 53, tilt: [0.7, 0.1, 0.3] },
  { id: "m87", kind: "black-hole", position: [-170, -25, -130], radius: 0.9, focusDistance: 62, seed: 5, tilt: [1.1, 0.2, 0.3], color: "#ffb36b", hostRadius: 22, hostGalaxy: "m87" },

  // Children of the Milky Way (schematic placement, not real galactic coordinates)
  { id: "sgr-a", kind: "black-hole", position: [0, 0, 0], radius: 1.2, focusDistance: 12, parent: "milky-way", seed: 7, tilt: [1.2, 0.1, 0.2], color: "#ffb36b" },
  { id: "solar-system", kind: "star-system", position: [8, 0.3, 4], radius: 1, focusDistance: 8, parent: "milky-way", seed: 3, color: "#ffd27a" },
  { id: "orion-nebula", kind: "nebula", position: [20, 0.6, -10], radius: 3.2, focusDistance: 14, parent: "milky-way", seed: 31, color: "#ff7ab6" },
  { id: "crab-nebula", kind: "nebula", position: [-18, 0.5, -14], radius: 2.6, focusDistance: 12, parent: "milky-way", seed: 37, color: "#7fb2ff" },
  { id: "proxima-b", kind: "star-system", position: [14, 0.8, 14], radius: 1, focusDistance: 8, parent: "milky-way", seed: 41, color: "#ff9d6b" },
  { id: "trappist-1e", kind: "star-system", position: [-8, -0.8, 20], radius: 1, focusDistance: 8, parent: "milky-way", seed: 43, color: "#ffb08a" },
  { id: "eagle-nebula", kind: "nebula", position: [26, 0.4, 12], radius: 2.8, focusDistance: 12, parent: "milky-way", seed: 47, color: "#8fe0b0" },
  { id: "cygnus-x1", kind: "black-hole", position: [-4, 0.6, -22], radius: 0.8, focusDistance: 10, parent: "milky-way", seed: 17, tilt: [1.0, 0.3, 0.1], color: "#ffb36b" },
  { id: "51-pegasi-b", kind: "star-system", position: [-20, -0.4, 6], radius: 1, focusDistance: 8, parent: "milky-way", seed: 59, color: "#ffe0a0" },
  { id: "sirius", kind: "star-system", position: [4, 0.2, -6], radius: 1, focusDistance: 8, parent: "milky-way", seed: 61, color: "#cfe0ff" },
];

const byId = new Map(SCENE_OBJECTS.map((o) => [o.id, o]));

export const getSceneObject = (id: string | null | undefined): SceneObject | undefined =>
  id ? byId.get(id) : undefined;
