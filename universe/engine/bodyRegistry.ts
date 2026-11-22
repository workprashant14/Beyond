import type * as THREE from "three";

/**
 * Lets the camera find moving bodies (planets) by id so it can follow them.
 * Bodies register their orbit group on mount and unregister on unmount.
 */
const bodies = new Map<string, THREE.Object3D>();

export const registerBody = (id: string, obj: THREE.Object3D) => void bodies.set(id, obj);
export const unregisterBody = (id: string, obj: THREE.Object3D) => {
  if (bodies.get(id) === obj) bodies.delete(id);
};
export const getBody = (id: string): THREE.Object3D | undefined => bodies.get(id);
