import type { TextureIndex, TextureIndexEntry } from "@/data/textureManifest";

/**
 * Loading state of one body's optional NASA surface image. Pure (no React, no three.js) so it can be tested without a browser.
 *  loading  the index or image is still being fetched
 *  loaded   an index entry exists AND its image decoded: the only state in which a photographic credit may be shown
 *  missing  nothing is installed for this body (no index file, or no entry for it): the scene keeps its procedural texture
 *  error    something was installed or requested but unusable (image failed, malformed entry, index request failed)
 * `meta` is null unless status is "loaded", so credit text cannot appear for an image that is not on screen.
 */
export type PhotoStatus = "loading" | "loaded" | "missing" | "error";

export interface PhotoState<T> {
  /** Body this state belongs to. Consumers compare it with the body they asked about, so a late answer for another body is never used. */
  id: string;
  status: PhotoStatus;
  meta: TextureIndexEntry | null;
  texture: T | null;
}

/** null = no index installed (404); "error" = the request failed or returned something unusable. */
export type IndexResult = TextureIndex | null | "error";

export const loadingState = <T>(id: string): PhotoState<T> => ({ id, status: "loading", meta: null, texture: null });
const done = <T>(id: string, status: "missing" | "error"): PhotoState<T> => ({ id, status, meta: null, texture: null });

const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const validEntry = (e: unknown): e is TextureIndexEntry =>
  !!e && typeof e === "object" && ["id", "file", "title", "credit", "page", "nature"].every((k) => text((e as Record<string, unknown>)[k]));

/** Resolve one body's state from the index and an image loader (both injected, so tests need no network). Never throws. */
export async function resolvePhoto<T>(
  id: string,
  getIndex: () => Promise<IndexResult>,
  loadImage: (entry: TextureIndexEntry) => Promise<T | null>,
): Promise<PhotoState<T>> {
  let idx: IndexResult;
  try { idx = await getIndex(); } catch { return done(id, "error"); }
  if (idx === "error") return done(id, "error");
  if (!idx || !Array.isArray(idx.textures)) return done(id, "missing");
  const entry = idx.textures.find((t) => t && (t as { id?: unknown }).id === id);
  if (!entry) return done(id, "missing");
  if (!validEntry(entry)) return done(id, "error");
  let texture: T | null = null;
  try { texture = await loadImage(entry); } catch { texture = null; }
  return texture ? { id, status: "loaded", meta: entry, texture } : done(id, "error");
}
