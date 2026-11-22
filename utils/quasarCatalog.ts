/**
 * Client/library side of the chunked quasar catalogue written by scripts/build_quasars_fits.py (format "chunked").
 * Nothing here knows about the network: the loader receives two functions (getJson, getBytes), so tests use files and the
 * browser uses fetch. A catalogue of 750,000 records is never loaded as a whole: the index is split into declination-band
 * chunks (~2,000 records each), sorted list files give the redshift / brightness ordering, and full records are fetched one
 * small detail file at a time.
 */
export interface CatalogChunkInfo { pos0: number; n: number; band: number; ra0?: number; ra1?: number; dec0?: number; dec1?: number }
export interface CatalogColumn { name: string; format: string; unit: string | null; null: number | null; dim: string | null }
export interface CatalogMeta {
  format: "chunked"; version: number; source: string; band: string | null; built: string; count: number;
  input: { file: string; sha256: string | null; rows: number; columns: number; rows_used: number; test_limit: number | null };
  counts: Record<string, number | null>;
  chunkMax: number; listChunk: number; detailChunk: number; hasDetail: boolean;
  columnsUsed: Record<string, string | null>;
  magnitudeNote: string; ordering: string;
  chunks: CatalogChunkInfo[]; columns: CatalogColumn[];
  sentinelNotes: Record<string, string>; citation: string; licence: string;
}
interface RawChunk { pos0?: number; pos?: number[]; n: string[]; ra: (number | null)[]; dec: (number | null)[]; z: (number | null)[]; m: (number | null)[] | null; f: (number | null)[] | null }
/** One index record. pos is its position in the catalogue's stable sorted order; it addresses detail records. */
export interface CatalogRecord { pos: number; name: string; ra: number | null; dec: number | null; z: number | null; m: number | null; flag: number | null }
export interface Fetchers { getJson: (path: string) => Promise<unknown>; getBytes: (path: string) => Promise<ArrayBuffer> }
export type CatalogSort = "position" | "z-high" | "z-low" | "bright";

export const isChunkedMeta = (m: unknown): m is CatalogMeta => !!m && typeof m === "object" && (m as { format?: unknown }).format === "chunked" && Array.isArray((m as { chunks?: unknown }).chunks);

const RAD = Math.PI / 180;
/** Great-circle separation in degrees (haversine). */
export function sepDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const dRa = (ra2 - ra1) * RAD, dDec = (dec2 - dec1) * RAD;
  const a = Math.sin(dDec / 2) ** 2 + Math.cos(dec1 * RAD) * Math.cos(dec2 * RAD) * Math.sin(dRa / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / RAD;
}

/** Normalises "SDSS J123456.78+012345.6", "sdssj1234", "J 1234" to the digits-and-sign core, or null if it is not designation-like. */
export function normaliseDesignation(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/^SDSS\s*/, "").replace(/^J\s*/, "").replace(/\s+/g, "");
  return /^\d{1,6}(\.\d*)?([+-]\d{0,6}(\.\d*)?)?$/.test(t) ? t : null;
}

/**
 * Right-ascension interval (degrees) that a designation prefix such as "0012" or "001234.5" can correspond to.
 * Designations hold the J2000 position truncated to 0.01 s, so a small margin is added. Returns null if the text is not a designation.
 */
export function designationRaRange(text: string): [number, number] | null {
  const t = normaliseDesignation(text);
  if (!t) return null;
  const [intPart, frac = ""] = t.split(/[+-]/)[0].split(".");
  const k = intPart.length;
  const p = intPart.padEnd(6, "0");
  const hours = Number(p.slice(0, 2)) + Number(p.slice(2, 4)) / 60 + (Number(p.slice(4, 6)) + (frac && k === 6 ? Number(`0.${frac}`) : 0)) / 3600;
  const secs = 1 / 3600;
  // width of the interval = the unit of the last digit that was given
  const width = [10, 1, 10 / 60, 1 / 60, 10 * secs, frac ? 10 ** -frac.length * secs : secs][k - 1];
  const lo = hours * 15 - 0.0006, hi = (hours + width) * 15 + 0.0006;
  return [Math.max(0, lo), Math.min(360, hi)];
}

/** Sentinel text that SDSS documents for a column (see meta.sentinelNotes), matched by column name. Raw values are never altered. */
export function sentinelFor(meta: CatalogMeta, column: string): string | null {
  const n = column.toUpperCase();
  for (const [k, v] of Object.entries(meta.sentinelNotes)) {
    const keys = k.split("/").map((s) => s.trim().toUpperCase());
    if (keys.some((x) => (x.endsWith("*") ? n.startsWith(x.slice(0, -1)) : x === n))) return v;
  }
  return null;
}

/** Chunks whose bounding box can hold a point within radiusDeg of (ra, dec). Unplaced records are never part of a cone. */
export function conePruneChunks(meta: CatalogMeta, ra: number, dec: number, radiusDeg: number): number[] {
  const decLo = dec - radiusDeg, decHi = dec + radiusDeg;
  const poleInside = decHi >= 90 || decLo <= -90;
  const dRa = poleInside ? 180 : Math.asin(Math.min(1, Math.sin(radiusDeg * RAD) / Math.cos(dec * RAD))) / RAD;
  const full = poleInside || dRa >= 180;
  const ivs: [number, number][] = full ? [[0, 360]] : [[ra - dRa, ra + dRa]];
  if (!full) { const [lo, hi] = ivs[0]; if (lo < 0) ivs.push([lo + 360, 360]); if (hi > 360) ivs.push([0, hi - 360]); }
  const out: number[] = [];
  meta.chunks.forEach((c, i) => {
    if (c.ra0 === undefined || c.ra1 === undefined || c.dec0 === undefined || c.dec1 === undefined) return;
    if (c.dec1 < decLo || c.dec0 > decHi) return;
    if (ivs.some(([a, b]) => c.ra1! >= a && c.ra0! <= b)) out.push(i);
  });
  return out;
}

export class QuasarCatalog {
  private chunks = new Map<number, Promise<RawChunk>>();
  private lists = new Map<string, Promise<RawChunk>>();
  private details = new Map<number, Promise<{ pos0: number; rows: unknown[][] }>>();
  constructor(public readonly meta: CatalogMeta, private f: Fetchers, private maxCached = 24) {}

  static async open(f: Fetchers): Promise<QuasarCatalog> {
    const m = await f.getJson("meta.json");
    if (!isChunkedMeta(m)) throw new Error("meta.json is not a chunked quasar catalogue");
    return new QuasarCatalog(m, f);
  }

  get size() { return this.meta.count; }

  private remember<T>(map: Map<number, Promise<T>>, key: number, make: () => Promise<T>): Promise<T> {
    const hit = map.get(key);
    if (hit) { map.delete(key); map.set(key, hit); return hit; }
    const p = make().catch((e) => { map.delete(key); throw e; });
    map.set(key, p);
    while (map.size > this.maxCached) map.delete(map.keys().next().value as number);
    return p;
  }

  chunkIndexOf(pos: number): number {
    const cs = this.meta.chunks;
    if (!Number.isInteger(pos) || pos < 0 || pos >= this.meta.count) throw new RangeError(`position ${pos} is outside 0..${this.meta.count - 1}`);
    let lo = 0, hi = cs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cs[mid].pos0 <= pos) lo = mid; else hi = mid - 1; }
    return lo;
  }

  chunk(i: number): Promise<RawChunk> {
    if (!Number.isInteger(i) || i < 0 || i >= this.meta.chunks.length) throw new RangeError(`no chunk ${i}`);
    return this.remember(this.chunks, i, async () => {
      const c = (await this.f.getJson(`index/${String(i).padStart(4, "0")}.json`)) as RawChunk;
      const info = this.meta.chunks[i];
      if (!c || c.pos0 !== info.pos0 || c.n.length !== info.n) throw new Error(`index chunk ${i} does not match meta.json`);
      return c;
    });
  }

  private rec(c: RawChunk, k: number): CatalogRecord {
    return { pos: c.pos ? c.pos[k] : (c.pos0 as number) + k, name: c.n[k], ra: c.ra[k], dec: c.dec[k], z: c.z[k], m: c.m ? c.m[k] : null, flag: c.f ? c.f[k] : null };
  }

  async recordAt(pos: number): Promise<CatalogRecord> {
    const i = this.chunkIndexOf(pos), c = await this.chunk(i);
    return this.rec(c, pos - (c.pos0 as number));
  }

  private listCount(kind: "z" | "mag"): number {
    const n = kind === "z" ? this.meta.counts.redshift_ordered : this.meta.counts.magnitude_ordered;
    return typeof n === "number" ? n : 0;
  }

  /** One file of a sorted list (redshift or brightness order). */
  private listFile(kind: "z" | "mag", i: number): Promise<RawChunk> {
    const key = `${kind}/${i}`;
    let p = this.lists.get(key);
    if (!p) {
      p = this.f.getJson(`lists/${kind}/${String(i).padStart(4, "0")}.json`).then((c) => {
        const x = c as RawChunk;
        const expected = Math.min(this.meta.listChunk, this.listCount(kind) - i * this.meta.listChunk);
        if (!x || !Array.isArray(x.pos) || x.n.length !== expected) throw new Error(`list file ${key} does not match meta.json`);
        return x;
      });
      p.catch(() => this.lists.delete(key));
      this.lists.set(key, p);
      while (this.lists.size > this.maxCached) this.lists.delete(this.lists.keys().next().value as string);
    }
    return p;
  }

  /** Number of records the sort can list (records without a redshift or magnitude are not part of those orderings). */
  async sortedCount(sort: CatalogSort): Promise<number> {
    return sort === "position" ? this.meta.count : this.listCount(sort === "bright" ? "mag" : "z");
  }

  /** One page of the catalogue in the chosen order. Redshift and brightness pages read one or two small list files. */
  async page(sort: CatalogSort, offset: number, limit: number): Promise<CatalogRecord[]> {
    const total = await this.sortedCount(sort);
    const end = Math.min(total, offset + limit);
    if (!Number.isInteger(offset) || offset < 0 || offset >= total) return [];
    if (sort === "position") return Promise.all(Array.from({ length: end - offset }, (_, k) => this.recordAt(offset + k)));
    const kind = sort === "bright" ? "mag" : "z", size = this.meta.listChunk;
    const out: CatalogRecord[] = [];
    for (let k = offset; k < end; k++) {
      const idx = sort === "z-low" ? total - 1 - k : k;
      const c = await this.listFile(kind, Math.floor(idx / size));
      out.push(this.rec(c, idx % size));
    }
    return out;
  }

  /** Records whose designation starts with the text (digits form, e.g. "0012" or "001234.5+01"). Null when the text is not designation-like. */
  async searchDesignation(text: string, limit = 50): Promise<CatalogRecord[] | null> {
    const range = designationRaRange(text), core = normaliseDesignation(text);
    if (!range || !core) return null;
    const out: CatalogRecord[] = [];
    for (let i = 0; i < this.meta.chunks.length && out.length < limit; i++) {
      const info = this.meta.chunks[i];
      if (info.ra0 === undefined || info.ra1 === undefined || info.ra1 < range[0] || info.ra0 > range[1]) continue;
      const c = await this.chunk(i);
      for (let k = 0; k < c.n.length && out.length < limit; k++) if (normaliseDesignation(c.n[k])?.startsWith(core)) out.push(this.rec(c, k));
    }
    return out;
  }

  /** Records within radiusDeg of a position, nearest first. Only chunks whose bounding box can intersect the cone are loaded. */
  async cone(ra: number, dec: number, radiusDeg: number, limit = 200): Promise<(CatalogRecord & { sepDeg: number })[]> {
    if (![ra, dec, radiusDeg].every(Number.isFinite) || dec < -90 || dec > 90 || radiusDeg <= 0 || radiusDeg > 180) throw new RangeError("invalid cone: need 0<=RA<360, -90<=Dec<=90 and 0<radius<=180 degrees");
    const out: (CatalogRecord & { sepDeg: number })[] = [];
    for (const i of conePruneChunks(this.meta, ((ra % 360) + 360) % 360, dec, radiusDeg)) {
      const c = await this.chunk(i);
      for (let k = 0; k < c.n.length; k++) {
        const r = c.ra[k], d = c.dec[k];
        if (r === null || d === null || r < 0 || r >= 360 || d < -90 || d > 90) continue; // unplaced records are never part of a cone
        const s = sepDeg(ra, dec, r, d);
        if (s <= radiusDeg) out.push({ ...this.rec(c, k), sepDeg: s });
      }
    }
    out.sort((a, b) => a.sepDeg - b.sepDeg || a.pos - b.pos);
    return out.slice(0, limit);
  }

  /** The complete original record (every FITS column), as [column, raw value] pairs in file order. Needs the detail files. */
  async detail(pos: number): Promise<{ column: CatalogColumn; value: unknown }[]> {
    if (!this.meta.hasDetail) throw new Error("this build has no detail files (built with --detail none)");
    this.chunkIndexOf(pos);
    const di = Math.floor(pos / this.meta.detailChunk);
    const d = await this.remember(this.details, di, async () => {
      const x = (await this.f.getJson(`detail/${String(di).padStart(6, "0")}.json`)) as { pos0: number; rows: unknown[][] };
      if (!x || x.pos0 !== di * this.meta.detailChunk) throw new Error(`detail chunk ${di} does not match meta.json`);
      return x;
    });
    const row = d.rows[pos - d.pos0];
    if (!row || row.length !== this.meta.columns.length) throw new Error(`detail record ${pos} is malformed`);
    return this.meta.columns.map((column, k) => ({ column, value: row[k] }));
  }
}

/** Fetch-based loaders for the browser. detailBase lets the large detail files live on separate hosting. */
export function browserFetchers(base = "/quasars", detailBase?: string): Fetchers {
  const url = (p: string) => (p.startsWith("detail/") && detailBase ? `${detailBase.replace(/\/$/, "")}/${p.slice(7)}` : `${base}/${p}`);
  const ok = async (r: Response, p: string) => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r; };
  return {
    getJson: async (p) => (await ok(await fetch(url(p)), p)).json(),
    getBytes: async (p) => (await ok(await fetch(url(p)), p)).arrayBuffer(),
  };
}
