import raw from "@/data/objects.json";
import type { CelestialObject } from "@/types/celestial";

const objects = raw as CelestialObject[];
const byId = new Map(objects.map((o) => [o.id, o]));

export const getAllObjects = (): CelestialObject[] => objects;
export const getObject = (id: string): CelestialObject | undefined => byId.get(id);
export const getFeatured = (): CelestialObject[] => objects.filter((o) => o.featured);
export const getPopular = (): CelestialObject[] => objects.filter((o) => o.popular);
export const getRelated = (obj: CelestialObject): CelestialObject[] =>
  obj.related.map((id) => byId.get(id)).filter((o): o is CelestialObject => !!o);
