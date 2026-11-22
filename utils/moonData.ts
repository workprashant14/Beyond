import type { Moon } from "./moons";

let cached: Promise<Moon[]> | null = null;

/** Loads the generated moon catalogue once (about 21 KB). A failed load can be retried. */
export function loadMoons(): Promise<Moon[]> {
  if (!cached) {
    cached = fetch("/solar/moons.json").then((r) => {
      if (!r.ok) throw new Error(`moons ${r.status}`);
      return r.json() as Promise<Moon[]>;
    });
    cached.catch(() => { cached = null; });
  }
  return cached;
}
