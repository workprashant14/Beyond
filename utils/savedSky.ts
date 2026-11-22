import { useSyncExternalStore } from "react";

/** A saved Sky Atlas target. `name` is stored at save time so lists render without loading any catalogue. */
export interface SavedItem { k: "star" | "dso" | "con"; id: string; name: string }
interface State { fav: SavedItem[]; rec: SavedItem[] }

const KEY = "beyond.sky.saved.v1";
const MAX_REC = 12, MAX_FAV = 200;
const EMPTY: State = { fav: [], rec: [] };
let state: State | null = null;
const subs = new Set<() => void>();

const valid = (x: unknown): x is SavedItem =>
  !!x && typeof x === "object" &&
  ["star", "dso", "con"].includes((x as SavedItem).k) &&
  typeof (x as SavedItem).id === "string" && typeof (x as SavedItem).name === "string";

/** Parses stored JSON defensively; anything unexpected yields an empty list. */
export function parseSaved(raw: string | null): State {
  try {
    const o = raw ? JSON.parse(raw) : null;
    return { fav: Array.isArray(o?.fav) ? o.fav.filter(valid).slice(0, MAX_FAV) : [], rec: Array.isArray(o?.rec) ? o.rec.filter(valid).slice(0, MAX_REC) : [] };
  } catch { return EMPTY; }
}

function read(): State {
  if (state) return state;
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked: keep in memory only */ }
  return (state = parseSaved(raw));
}
function write(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* in-memory only */ }
  subs.forEach((f) => f());
}
const same = (a: SavedItem, b: SavedItem) => a.k === b.k && a.id === b.id;

export const toggleFavorite = (item: SavedItem) => {
  const s = read();
  write({ ...s, fav: s.fav.some((f) => same(f, item)) ? s.fav.filter((f) => !same(f, item)) : [item, ...s.fav].slice(0, MAX_FAV) });
};
export const addRecent = (item: SavedItem) => {
  const s = read();
  if (s.rec[0] && same(s.rec[0], item)) return;
  write({ ...s, rec: [item, ...s.rec.filter((r) => !same(r, item))].slice(0, MAX_REC) });
};
export const clearRecents = () => write({ ...read(), rec: [] });

export function useSaved(): State {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    read,
    () => EMPTY,
  );
}
