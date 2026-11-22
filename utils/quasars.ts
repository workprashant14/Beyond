/**
 * Quasar subset helpers. The catalogue file is NOT bundled: you export a small subset (for example the brightest few thousand
 * quasars of the SDSS DR16Q catalogue, Lyke et al. 2020, 2020ApJS..250....8L) as CSV and `npm run build:quasars` converts it.
 * Column names of the real export could not be verified from this build environment, so the parser never guesses silently:
 * it matches a documented list of common names, prints what it chose, accepts explicit overrides, and fails loudly otherwise.
 * Positions must be decimal degrees; sexagesimal values are rejected. Empty cells become null.
 */
export interface Quasar {
  n: string;
  ra: number;
  dec: number;
  /** Redshift as catalogued */
  z: number | null;
  /** Magnitude in the band named in meta.json, or null */
  m: number | null;
}

export interface QuasarMeta { source: string; band: string | null; built: string; count: number }
export interface ColumnMap { name: string; ra: string; dec: string; z: string; mag: string | null }

const CANDIDATES = {
  name: ["sdss_name", "sdss-dr16", "sdss", "name", "designation", "object", "id"],
  ra: ["ra", "raj2000", "_raj2000", "ra_icrs", "raj2000_deg"],
  dec: ["dec", "dej2000", "_dej2000", "de_icrs", "dej2000_deg", "decl"],
  z: ["z", "z_pipe", "redshift", "zph"],
  mag: ["imag", "i_mag", "psfmag_i", "mag", "i"],
} as const;

export function detectDelimiter(headerLine: string): string {
  const count = (c: string) => headerLine.split(c).length - 1;
  return [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
}

/** Splits one line on a delimiter, honouring double quotes. */
function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cell = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cell); cell = ""; }
    else cell += ch;
  }
  out.push(cell);
  return out;
}

export function detectColumns(headers: string[], override: Partial<ColumnMap> = {}): ColumnMap {
  const lower = new Map(headers.map((h) => [h.trim().toLowerCase(), h.trim()]));
  const pick = (key: keyof typeof CANDIDATES, given?: string | null): string | null => {
    if (given) {
      const hit = lower.get(given.toLowerCase());
      if (!hit) throw new Error(`column "${given}" not found; the file has: ${headers.join(", ")}`);
      return hit;
    }
    const found = CANDIDATES[key].map((c) => lower.get(c)).filter((x): x is string => !!x);
    return found[0] ?? null;
  };
  const name = pick("name", override.name), ra = pick("ra", override.ra), dec = pick("dec", override.dec), z = pick("z", override.z);
  const mag = pick("mag", override.mag);
  const missing = Object.entries({ name, ra, dec, z }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`could not find a column for: ${missing.join(", ")}. The file has: ${headers.join(", ")}. Name them with --name-col, --ra-col, --dec-col, --z-col.`);
  return { name: name!, ra: ra!, dec: dec!, z: z!, mag };
}

export interface ParsedQuasars { quasars: Quasar[]; columns: ColumnMap; dropped: number }

export function parseQuasarCsv(text: string, override: Partial<ColumnMap> = {}): ParsedQuasars {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("the file has no data rows");
  const d = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], d).map((h) => h.trim());
  const columns = detectColumns(headers, override);
  const at = (c: string) => headers.indexOf(c);
  const [iN, iR, iD, iZ] = [at(columns.name), at(columns.ra), at(columns.dec), at(columns.z)];
  const iM = columns.mag ? at(columns.mag) : -1;
  const quasars: Quasar[] = [];
  let dropped = 0;
  for (const line of lines.slice(1)) {
    const c = splitLine(line, d);
    const raw = (i: number) => (i < 0 ? "" : (c[i] ?? "").trim());
    for (const v of [raw(iR), raw(iD)]) if (/[:\s]/.test(v)) throw new Error(`RA/Dec must be decimal degrees but found "${v}"; re-export with degree units`);
    const ra = Number(raw(iR)), dec = Number(raw(iD));
    const name = raw(iN);
    if (!name || raw(iR) === "" || raw(iD) === "" || !Number.isFinite(ra) || !Number.isFinite(dec) || ra < 0 || ra > 360 || dec < -90 || dec > 90) { dropped++; continue; }
    const num = (s: string) => (s === "" || !Number.isFinite(Number(s)) ? null : Number(s));
    const z = num(raw(iZ)), m = num(raw(iM));
    quasars.push({ n: name, ra, dec, z: z !== null && z >= 0 && z < 15 ? z : null, m: m !== null && m > 0 && m < 40 ? m : null });
  }
  return { quasars, columns, dropped };
}

export interface QuasarQuery { text: string; sort: "redshift-high" | "redshift-low" | "bright" | "name" }

export function queryQuasars(all: Quasar[], q: QuasarQuery): Quasar[] {
  const f = q.text.trim().toLowerCase();
  const out = all.filter((x) => !f || x.n.toLowerCase().includes(f));
  const hi = (v: number | null) => (v === null ? Infinity : -v);
  const lo = (v: number | null) => (v === null ? Infinity : v);
  out.sort((a, b) => (q.sort === "name" ? a.n.localeCompare(b.n) : (q.sort === "redshift-high" ? hi(a.z) - hi(b.z) : q.sort === "redshift-low" ? lo(a.z) - lo(b.z) : lo(a.m) - lo(b.m)) || a.n.localeCompare(b.n)));
  return out;
}
