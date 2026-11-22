"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { TextureIndexEntry } from "@/data/textureManifest";
import { loadingState, resolvePhoto, type IndexResult, type PhotoState } from "./photoStatus";

/**
 * Optional NASA surface images from public/textures/ (written by `npm run build:textures`). When the index or an image
 * is missing or fails, the hooks report it and the scene keeps its procedural, artistic textures.
 *
 * Sharing: one index request and one image per body id are cached for the life of the page, and the SAME resolved state (texture and
 * credit together) is handed to every consumer, so the mesh and the credit line can never disagree. Nothing here disposes a texture:
 * it may be used by another mesh at any time, and react-three-fiber only disposes objects it creates (a material's dispose() does not
 * dispose the textures it references). A 404 for the index is cached; a failed request is not, so a later mount can retry.
 */
let indexPending: Promise<IndexResult> | null = null;
const loadIndex = (): Promise<IndexResult> => {
  indexPending ??= fetch("/textures/index.json")
    .then(async (r): Promise<IndexResult> => {
      if (r.status === 404) return null;
      if (!r.ok) { indexPending = null; return "error"; }
      try { return (await r.json()) as IndexResult; } catch { return "error"; }
    })
    .catch((): IndexResult => { indexPending = null; return "error"; });
  return indexPending;
};

const images = new Map<string, Promise<THREE.Texture | null>>();
function loadImage(entry: TextureIndexEntry): Promise<THREE.Texture | null> {
  let p = images.get(entry.id);
  if (!p) {
    p = new Promise((resolve) => {
      new THREE.TextureLoader().load(
        `/textures/${entry.file}`,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); },
        undefined,
        () => resolve(null),
      );
    });
    images.set(entry.id, p);
  }
  return p;
}

const states = new Map<string, Promise<PhotoState<THREE.Texture>>>();
const resolveCached = (id: string) => {
  let p = states.get(id);
  if (!p) { p = resolvePhoto(id, loadIndex, loadImage); states.set(id, p); }
  return p;
};

/** Status, credit metadata and texture for one body. The returned state always belongs to `id` (loading while the answer for `id` is pending). */
export function usePhoto(id: string): PhotoState<THREE.Texture> {
  const [state, setState] = useState<PhotoState<THREE.Texture> | null>(null);
  useEffect(() => {
    let alive = true;
    resolveCached(id).then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [id]);
  return state && state.id === id ? state : loadingState<THREE.Texture>(id);
}

/** Index entry (credit, honest description) for a body, only once its image has loaded; otherwise null. */
export function usePhotoMeta(id: string): TextureIndexEntry | null {
  return usePhoto(id).meta;
}

/** The photographic texture for a body once loaded, otherwise null. */
export function usePhotoTexture(id: string): THREE.Texture | null {
  return usePhoto(id).texture;
}
