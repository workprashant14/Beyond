/** A measured or adopted number: `u` is the stated uncertainty, absent when the source lists none. */
export interface Val { v: number; u?: number }
export interface Moon {
  n: string;
  /** Parent body: Earth, Mars, Jupiter, Saturn, Uranus, Neptune or Pluto. */
  p: string;
  /** Mean radius, km. */
  r: Val | null;
  /** Density, g/cm^3. */
  d: Val | null;
  /** GM, km^3/s^2. */
  g: Val | null;
  /** Apparent magnitude and its photometric band (V unless the source says otherwise). */
  m: (Val & { b: string }) | null;
  /** Geometric albedo. */
  a: Val | null;
}

const G_SI = 6.6743e-20; // km^3 kg^-1 s^-2 (CODATA 2018)

/** "1737.5±0.1", "170.±25.", "14.2R", "22.9V±0.1", "?" or "" -> value, or null when unknown. */
export function parseVal(raw: string): (Val & { b: string }) | null {
  const s = raw.trim();
  if (!s || s === "?") return null;
  const m = /^(-?\d+\.?\d*)([A-Za-z]?)(?:±(\d+\.?\d*))?$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  const out: Val & { b: string } = { v, b: m[2] || "V" };
  if (m[3] !== undefined && Number.isFinite(Number(m[3]))) out.u = Number(m[3]);
  return out;
}

const plain = (x: (Val & { b: string }) | null): Val | null => (x ? (x.u === undefined ? { v: x.v } : { v: x.v, u: x.u }) : null);

/** Splits one CSV line (no quoted commas appear in this table). */
export function parseMoonCsv(text: string): Moon[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split(",");
  const col = (k: string) => head.indexOf(k);
  const [ip, iname, ig, ir, id, im, ia] = ["planet", "name", "gm", "radius", "density", "magnitude", "albedo"].map(col);
  if ([ip, iname, ig, ir, id, im, ia].some((i) => i < 0)) throw new Error("unexpected satellites.csv header");
  return lines.slice(1).map((l) => {
    const c = l.split(",");
    return { n: c[iname], p: c[ip], r: plain(parseVal(c[ir])), d: plain(parseVal(c[id])), g: plain(parseVal(c[ig])), m: parseVal(c[im]), a: plain(parseVal(c[ia])) };
  });
}

/** Mass in kg derived from GM (M = GM / G). */
export const massKg = (gm: number) => gm / G_SI;

export function formatMass(kg: number): string {
  const e = Math.floor(Math.log10(kg));
  return `${(kg / 10 ** e).toFixed(2)} × 10${String(e).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)])} kg`;
}

/** Number with its uncertainty when the source gives one: "1737.5 ± 0.1". */
export const fmtVal = (x: Val | null, unit = ""): string | null =>
  x ? `${x.v.toLocaleString("en-US", { maximumFractionDigits: 6 })}${x.u !== undefined ? ` ± ${x.u}` : ""}${unit ? ` ${unit}` : ""}` : null;

export const moonId = (m: Moon) => m.n;

export interface MoonHit { name: string; sub: string; id: string }

/** Name search over the moon catalogue; names already present as curated objects (e.g. "Moon") are skipped by the caller's set. */
export function searchMoons(moons: Moon[], query: string, limit = 5, skip: Set<string> = new Set()): MoonHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return moons
    .map((m) => {
      const n = m.n.toLowerCase();
      const score = n === q ? 100 : n.startsWith(q) ? 70 : n.includes(q) ? 40 : 0;
      return { m, score };
    })
    .filter((x) => x.score > 0 && !skip.has(x.m.n.toLowerCase()))
    .sort((a, b) => b.score - a.score || (b.m.r?.v ?? 0) - (a.m.r?.v ?? 0))
    .slice(0, limit)
    .map(({ m }) => ({ id: m.n, name: m.n, sub: `Moon of ${m.p}${m.r ? ` · radius ${m.r.v.toLocaleString("en-US")} km` : ""}` }));
}
