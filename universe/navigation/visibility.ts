import { SCENE_OBJECTS, getSceneObject, type SceneObject } from "@/universe/objects/sceneConfig";

export interface VisibleSet {
  objects: SceneObject[];
  /** The parent whose children are currently revealed (its own hit target is disabled so children can be clicked). */
  activeParent: string | null;
}

/**
 * Hierarchical disclosure: top-level objects are always shown; children appear
 * only when their parent (or one of its children) is selected.
 */
export function getVisibleSet(selectedId: string | null): VisibleSet {
  const sel = getSceneObject(selectedId);
  let activeParent: string | null = null;
  if (sel) {
    const hasChildren = SCENE_OBJECTS.some((o) => o.parent === sel.id);
    activeParent = hasChildren ? sel.id : (sel.parent ?? null);
  }
  return {
    activeParent,
    objects: SCENE_OBJECTS.filter((o) => !o.parent || o.parent === activeParent),
  };
}
