import { raDecToVec, type StarNames } from "@/utils/sky";
import type { StarPhysFile } from "@/utils/starPhys";

export interface Constellation {
  id: string;
  name: string;
  gen: string;
  labels: [number, number][];
  lines: [number, number][][];
  bounds: [number, number][][];
}

export interface SkyData {
  n: number;
  hip: Int32Array;
  ra: Float32Array;
  dec: Float32Array;
  mag: Float32Array;
  /** NaN when the catalogue has no B-V for the star. */
  bv: Float32Array;
  /** Unit-sphere positions scaled to SKY_RADIUS, xyz interleaved. */
  pos: Float32Array;
  names: Record<string, StarNames>;
  /** IAU constellation abbreviation per star (catalogue value where given, otherwise computed from the IAU boundaries). */
  con: string[];
  constellations: Constellation[];
  conById: Map<string, Constellation>;
  indexOfHip: Map<number, number>;
}

export interface ConstellationAreas { source: string; unit: string; areas: Record<string, number> }

let areaPending: Promise<ConstellationAreas> | null = null;
/** Published areas of the 88 IAU regions (about 1.5 KB), loaded when a constellation panel opens; a failed load can be retried. */
export function loadConstellationAreas(): Promise<ConstellationAreas> {
  areaPending ??= getJson<ConstellationAreas>("constellation-areas.json").catch((e) => { areaPending = null; throw e; });
  return areaPending;
}

let pending: Promise<SkyData> | null = null;
let physPending: Promise<StarPhysFile> | null = null;

/** Loaded only when a star panel is opened (about 28 KB gzip); a failed load can be retried. */
export function loadStarPhys(): Promise<StarPhysFile> {
  physPending ??= getJson<StarPhysFile>("starphys.json").catch((e) => { physPending = null; throw e; });
  return physPending;
}

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`/sky/${name}`);
  if (!res.ok) throw new Error(`Could not load ${name}`);
  return (await res.json()) as T;
}

/** Fetches the three sky files once per session (about 130 KB gzip in total). */
export function loadSky(): Promise<SkyData> {
  pending ??= (async () => {
    const [stars, names, constellations] = await Promise.all([
      getJson<{ n: number; hip: number[]; ra: number[]; dec: number[]; mag: number[]; bv: (number | null)[]; con?: string[] }>("stars.json"),
      getJson<Record<string, StarNames>>("starinfo.json"),
      getJson<Constellation[]>("constellations.json"),
    ]);
    const pos = new Float32Array(stars.n * 3);
    const indexOfHip = new Map<number, number>();
    for (let i = 0; i < stars.n; i++) {
      const [x, y, z] = raDecToVec(stars.ra[i], stars.dec[i]);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      indexOfHip.set(stars.hip[i], i);
    }
    return {
      n: stars.n,
      hip: Int32Array.from(stars.hip),
      ra: Float32Array.from(stars.ra),
      dec: Float32Array.from(stars.dec),
      mag: Float32Array.from(stars.mag),
      bv: Float32Array.from(stars.bv, (v) => (v === null ? NaN : v)),
      pos,
      names,
      con: stars.con ?? stars.hip.map((h) => names[String(h)]?.c ?? ""),
      constellations,
      conById: new Map(constellations.map((c) => [c.id, c])),
      indexOfHip,
    };
  })().catch((e) => {
    pending = null; // allow a retry after a network failure
    throw e;
  });
  return pending;
}

// ---------- deep-sky objects (two tiers, fetched progressively) ----------

export interface DsoSet {
  n: number;
  id: string[];
  desig: string[];
  type: string[];
  /** IAU constellation abbreviation (empty when unknown). */
  con: string[];
  ra: Float32Array;
  dec: Float32Array;
  /** NaN when the catalogue has no magnitude. */
  mag: Float32Array;
  /** Photometric band of `mag`: "V", "B" or "" (unknown). */
  magBand: string[];
  /** Angular size in arcminutes; NaN when unknown. */
  a: Float32Array;
  b: Float32Array;
  /** Hubble type code as catalogued (galaxies), e.g. "Sb". */
  hubble: string[];
  /** Radial velocity in km/s; NaN when unknown. */
  radVel: Float32Array;
  /** NaN when the catalogue has no redshift / parallax (milliarcseconds). */
  redshift: Float64Array;
  parallax: Float64Array;
  names: Record<string, string>;
  pos: Float32Array;
  indexOfId: Map<string, number>;
}

interface RawDso {
  n: number; id: string[]; d: string[]; t: string[]; c: string[]; ra: number[]; dec: number[];
  mag: (number | null)[]; mb: string[]; a: (number | null)[]; b: (number | null)[]; h: string[]; v: (number | null)[];
  /** Redshift and parallax (mas) as catalogued by OpenNGC (SIMBAD main values); absent in files built before they were added. */
  z?: (number | null)[]; p?: (number | null)[];
  names: Record<string, string>;
}
const nan = (v: number | null) => (v === null ? NaN : v);

function buildDso(r: RawDso): DsoSet {
  const pos = new Float32Array(r.n * 3);
  const indexOfId = new Map<string, number>();
  for (let i = 0; i < r.n; i++) {
    pos.set(raDecToVec(r.ra[i], r.dec[i]), i * 3);
    indexOfId.set(r.id[i], i);
  }
  return {
    n: r.n, id: r.id, desig: r.d, type: r.t, con: r.c, ra: Float32Array.from(r.ra), dec: Float32Array.from(r.dec),
    mag: Float32Array.from(r.mag, nan), magBand: r.mb, a: Float32Array.from(r.a, nan), b: Float32Array.from(r.b, nan),
    hubble: r.h, radVel: Float32Array.from(r.v, nan),
    redshift: Float64Array.from(r.z ?? r.v.map(() => null), nan), parallax: Float64Array.from(r.p ?? r.v.map(() => null), nan), names: r.names, pos, indexOfId,
  };
}

const dsoPending: Partial<Record<"bright" | "faint", Promise<DsoSet>>> = {};

/** "bright": Messier objects and everything up to magnitude 10 (about 13 KB gzip). "faint": about 11,500 more objects (about 250 KB gzip), loaded only on request. */
export function loadDso(tier: "bright" | "faint"): Promise<DsoSet> {
  dsoPending[tier] ??= getJson<RawDso>(`dsos-${tier}.json`).then(buildDso).catch((e) => {
    delete dsoPending[tier];
    throw e;
  });
  return dsoPending[tier]!;
}

export function mergeDso(x: DsoSet, y: DsoSet | null): DsoSet {
  if (!y) return x;
  const cat = (a: Float32Array, b: Float32Array) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  const cat64 = (a: Float64Array, b: Float64Array) => { const o = new Float64Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  const id = [...x.id, ...y.id];
  return {
    n: x.n + y.n, id, desig: [...x.desig, ...y.desig], type: [...x.type, ...y.type], con: [...x.con, ...y.con],
    ra: cat(x.ra, y.ra), dec: cat(x.dec, y.dec), mag: cat(x.mag, y.mag), magBand: [...x.magBand, ...y.magBand],
    a: cat(x.a, y.a), b: cat(x.b, y.b), hubble: [...x.hubble, ...y.hubble], radVel: cat(x.radVel, y.radVel),
    redshift: cat64(x.redshift, y.redshift),
    parallax: cat64(x.parallax, y.parallax),
    names: { ...x.names, ...y.names }, pos: cat(x.pos, y.pos),
    indexOfId: new Map(id.map((k, i) => [k, i])),
  };
}
