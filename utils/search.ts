import type { CelestialObject } from "@/types/celestial";
import { CATEGORY_LABEL } from "@/types/celestial";

/** Lowercase, strip accents/punctuation (keeps digits and *). */
export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9* ]/g, " ").replace(/\s+/g, " ").trim();

/** Very small stemmer so "nebulae", "galaxies", "planets", "black holes" match their singular forms. */
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("ae")) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
const words = (s: string) => norm(s).split(" ").filter(Boolean).map(stem);

/** Edit distance, bailing out early once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Score one query word (already stemmed) against an object. 0 = no match. */
function tokenScore(obj: CelestialObject, t: string): number {
  const nameWords = words(obj.name);
  const kwWords = obj.keywords.flatMap(words);
  const catWords = words(CATEGORY_LABEL[obj.category]);

  if (nameWords.includes(t)) return 90;
  if (nameWords.some((w) => w.startsWith(t))) return 70;
  // A one-word category that equals the query ranks above a partial hit ("planet" -> Planet before Dwarf planet).
  if (catWords.length === 1 && catWords[0] === t) return 60;
  if (catWords.includes(t)) return 55;
  if (norm(obj.name).includes(t)) return 50;
  if (kwWords.includes(t)) return 45;
  if (kwWords.some((w) => w.startsWith(t) || (t.length >= 3 && w.includes(t)))) return 35;
  if (norm(obj.summary).includes(t)) return 10;

  // typo tolerance (only for words long enough that a typo is unambiguous)
  if (t.length >= 4) {
    const max = t.length >= 7 ? 2 : 1;
    const dist = (ws: string[]) => Math.min(...ws.map((w) => editDistance(t, w, max)));
    const nameBest = dist(nameWords);
    const kwBest = dist(kwWords);
    // A typo of the object's own name outranks a typo of one of its keywords.
    if (nameBest <= max) return 20 - nameBest * 3;
    if (kwBest <= max) return 18 - kwBest * 3;
  }
  return 0;
}

/** Score an object against a whole query. Every word must match somewhere. */
export function scoreObject(obj: CelestialObject, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  if (norm(obj.name) === q) return 100;
  const tokens = q.split(" ").map(stem);
  const scores = tokens.map((t) => tokenScore(obj, t));
  if (scores.some((s) => s === 0)) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg + (norm(obj.name).includes(q) ? 5 : 0);
}

export function searchObjects(objects: CelestialObject[], query: string, limit = 8): CelestialObject[] {
  if (!norm(query)) return [];
  return objects
    .map((o) => ({ o, s: scoreObject(o, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.o.name.localeCompare(b.o.name))
    .slice(0, limit)
    .map((x) => x.o);
}

/** One-click category shortcuts shown when the search box is focused but empty. */
export const CATEGORY_CHIPS: { label: string; query: string }[] = [
  { label: "Planets", query: "planet" },
  { label: "Moons", query: "moon" },
  { label: "Galaxies", query: "galaxy" },
  { label: "Nebulae", query: "nebula" },
  { label: "Black holes", query: "black hole" },
  { label: "Exoplanets", query: "exoplanet" },
  { label: "Comets", query: "comet" },
];
