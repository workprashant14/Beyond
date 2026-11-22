import { parseCsv } from "./exoplanets";

/**
 * ATNF Pulsar Catalogue helpers (Manchester, Hobbs, Teoh & Hobbs 2005, AJ 129, 1993). The CSV comes from the catalogue's own
 * web form ("short csv without errors", semicolon-separated). Parameter names and units were checked against the catalogue
 * documentation: JName, Name (B name if it exists), RAJD / DecJD (degrees, J2000), P0 (barycentric period, s), DM (cm-3 pc),
 * DIST (best estimate, kpc). Empty cells and "*" become null; nothing is invented.
 */
export interface Pulsar {
  /** J2000 name, e.g. "J0534+2200" */
  n: string;
  /** B name when the catalogue has one, e.g. "B0531+21" */
  b: string | null;
  ra: number | null;
  dec: number | null;
  /** Rotation period, seconds */
  p: number | null;
  /** Dispersion measure, cm-3 pc */
  dm: number | null;
  /** Distance, kiloparsecs */
  d: number | null;
}

export const PSR_COLUMNS: Record<keyof Pulsar, string> = { n: "JNAME", b: "NAME", ra: "RAJD", dec: "DECJD", p: "P0", dm: "DM", d: "DIST" };
const REQUIRED: (keyof Pulsar)[] = ["n", "ra", "dec", "p"];
export const KPC_TO_LY = 3261.564;
/** Conventional cut for "millisecond pulsar" (a convention, not a catalogue field). */
export const MSP_SECONDS = 0.03;

const MISSING = new Set(["", "*", "nan", "-"]);

/** Parses the catalogue CSV. Throws when a required column is missing, so a changed format is noticed, not hidden. */
export function parsePsrcat(text: string): Pulsar[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  // The header is the first line naming JName; any lines before it (comments, titles) are ignored.
  const h = lines.findIndex((l) => /\bjname\b/i.test(l));
  if (h < 0) throw new Error("no header line containing JName was found");
  const delim = (lines[h].match(/;/g)?.length ?? 0) >= (lines[h].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = delim === "," ? parseCsv(lines.slice(h).join("\n")) : lines.slice(h).filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#")).map((l) => l.split(";"));
  const head = rows[0].map((c) => c.replace(/^#/, "").trim().toUpperCase());
  const idx = new Map(head.map((c, i) => [c, i]));
  const missing = REQUIRED.filter((k) => !idx.has(PSR_COLUMNS[k])).map((k) => PSR_COLUMNS[k]);
  if (missing.length) throw new Error(`columns missing: ${missing.join(", ")}`);
  const cell = (r: string[], k: keyof Pulsar) => {
    const i = idx.get(PSR_COLUMNS[k]);
    const raw = i === undefined ? "" : (r[i] ?? "").trim();
    return MISSING.has(raw.toLowerCase()) ? null : raw;
  };
  const num = (r: string[], k: keyof Pulsar) => {
    const raw = cell(r, k);
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const out: Pulsar[] = [];
  for (const r of rows.slice(1)) {
    const n = cell(r, "n");
    if (!n) continue;
    out.push({ n, b: cell(r, "b"), ra: num(r, "ra"), dec: num(r, "dec"), p: num(r, "p"), dm: num(r, "dm"), d: num(r, "d") });
  }
  return out;
}

export interface PsrQuery { text: string; kind: "" | "msp" | "slow"; sort: "period" | "distance" | "name" }

export function queryPulsars(all: Pulsar[], q: PsrQuery): Pulsar[] {
  const f = q.text.trim().toLowerCase();
  const out = all.filter(
    (x) =>
      (!f || x.n.toLowerCase().includes(f) || (x.b?.toLowerCase().includes(f) ?? false)) &&
      (q.kind === "" || (x.p !== null && (q.kind === "msp" ? x.p < MSP_SECONDS : x.p >= MSP_SECONDS))),
  );
  const num = (v: number | null) => (v === null ? Infinity : v);
  out.sort((a, b) => (q.sort === "name" ? a.n.localeCompare(b.n) : (q.sort === "period" ? num(a.p) - num(b.p) : num(a.d) - num(b.d)) || a.n.localeCompare(b.n)));
  return out;
}
