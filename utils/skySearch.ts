import { norm } from "./search";
import { bayerName, flamsteedName, starDisplayName } from "./sky";
import { compactKey, dsoTitle, dsoTypeLabel, messierName } from "./dso";
import type { DsoSet, SkyData } from "@/universe/sky/skyData";

export interface SkyHit {
  kind: "star" | "con" | "dso";
  /** HIP number (as text) for stars, IAU abbreviation for constellations. */
  id: string;
  name: string;
  sub: string;
  score: number;
}

interface Entry {
  kind: "star" | "con" | "dso";
  id: string;
  name: string;
  sub: string;
  keys: string[];
  mag: number;
}

const cache = new WeakMap<SkyData, Entry[]>();
const dsoCache = new WeakMap<DsoSet, Entry[]>();

/** Deep-sky search keys: designation with and without the space ("ngc 224", "ngc224"), Messier alias, proper name. */
export function buildDsoIndex(sky: SkyData, dso: DsoSet): Entry[] {
  const hit = dsoCache.get(dso);
  if (hit) return hit;
  const out: Entry[] = [];
  for (let i = 0; i < dso.n; i++) {
    const id = dso.id[i], desig = dso.desig[i], nm = dso.names[id];
    const keys = [norm(id), compactKey(id)];
    if (desig && desig !== id) keys.push(norm(desig), compactKey(desig));
    const mess = messierName(desig);
    if (mess) keys.push(norm(mess));
    if (nm) keys.push(norm(nm));
    const con = dso.con[i] ? sky.conById.get(dso.con[i]) : undefined;
    out.push({
      kind: "dso", id, name: dsoTitle(nm, desig, id),
      sub: `${dsoTypeLabel(dso.type[i]) ?? "Deep-sky object"}${con ? ` · ${con.name}` : ""} · ${id}`,
      keys, mag: Number.isNaN(dso.mag[i]) ? 99 : dso.mag[i],
    });
  }
  dsoCache.set(dso, out);
  return out;
}

/** Search keys use Greek letter names ("alpha"), because norm() strips non-ASCII characters. */
export function buildSkyIndex(sky: SkyData): Entry[] {
  const hit = cache.get(sky);
  if (hit) return hit;
  const out: Entry[] = [];
  for (const c of sky.constellations) {
    out.push({ kind: "con", id: c.id, name: c.name, sub: `Constellation · ${c.id}`, keys: [norm(c.name), norm(c.id), norm(c.gen)], mag: -99 });
  }
  for (let i = 0; i < sky.n; i++) {
    const hip = sky.hip[i];
    const nm = sky.names[String(hip)];
    const con = nm?.c ? sky.conById.get(nm.c) : undefined;
    const keys = [`hip ${hip}`];
    if (nm?.n) keys.push(norm(nm.n));
    const long = bayerName(nm?.b, con?.gen, true);
    if (long) {
      keys.push(norm(long));
      if (con) keys.push(norm(long.replace(con.gen, con.id)));
    }
    const fl = flamsteedName(nm?.f, con?.gen);
    if (fl) { keys.push(norm(fl)); if (con) keys.push(norm(`${nm!.f} ${con.id}`)); }
    if (nm?.v && con) keys.push(norm(`${nm.v} ${con.id}`));
    if (nm?.h) keys.push(`hd ${nm.h}`);
    const name = starDisplayName(hip, nm, con?.gen, con?.id);
    const mag = sky.mag[i];
    out.push({ kind: "star", id: String(hip), name, sub: `Star${con ? ` · ${con.name}` : ""} · mag ${mag.toFixed(1)} · HIP ${hip}`, keys, mag });
  }
  cache.set(sky, out);
  return out;
}

function keyScore(key: string, q: string): number {
  if (key === q) return 100;
  if (key.startsWith(q)) return q.length >= 2 ? 70 : 0;
  if (q.length >= 3 && key.split(" ").some((w) => w.startsWith(q))) return 55;
  if (q.length >= 4 && key.includes(q)) return 35;
  return 0;
}

/** Stars and constellations matching a query. `skipNames` removes stars already offered from the main catalogue (e.g. Sirius). */
export function searchSky(sky: SkyData, query: string, limit = 5, skipNames: Set<string> = new Set(), dso: DsoSet | null = null): SkyHit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: (SkyHit & { mag: number })[] = [];
  const entries = dso ? [...buildSkyIndex(sky), ...buildDsoIndex(sky, dso)] : buildSkyIndex(sky);
  for (const e of entries) {
    if (e.kind === "star" && skipNames.has(norm(e.name))) continue;
    let best = 0;
    for (const k of e.keys) best = Math.max(best, keyScore(k, q));
    if (best > 0) hits.push({ kind: e.kind, id: e.id, name: e.name, sub: e.sub, score: best, mag: e.mag });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.mag - b.mag || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ mag: _m, ...h }) => h); // eslint-disable-line @typescript-eslint/no-unused-vars
}