/**
 * NASA Exoplanet Archive helpers: CSV parsing and display formatting.
 * Columns come from the archive's pscomppars table (one row per confirmed planet, composite parameters).
 * Nothing is invented: empty cells become null and the UI shows "Data unavailable".
 *
 * Measurement detail (added): for five parameters the archive also gives an upper and a lower uncertainty, a limit flag and a
 * parameter-specific reference. They are kept in the optional `u` object, keyed by the parameter's short key, with a fixed naming
 * convention: e1 = upper error (NASA `*err1`), e2 = lower error (NASA `*err2`, normally negative, kept exactly as given),
 * l = raw limit flag (NASA `*lim`), r = reference (NASA `*_reflink`, reduced to plain text plus an optional validated URL).
 * Keys exist only when the archive supplied them; a missing uncertainty is absent/null, never 0. Records built before this
 * addition have no `u` and stay valid.
 */
export interface Exoplanet {
  /** Planet name, e.g. "Kepler-22 b" */
  n: string;
  /** Host star name */
  h: string;
  /** Discovery method, as the archive spells it */
  m: string | null;
  /** Discovery year */
  y: number | null;
  /** Orbital period, days */
  p: number | null;
  /** Semi-major axis, au */
  a: number | null;
  /** Radius, Earth radii */
  r: number | null;
  /** Mass or minimum mass (Mass*sin(i)), Earth masses */
  ms: number | null;
  /** Equilibrium temperature, K */
  t: number | null;
  /** Stars in the system / planets in the system */
  ns: number | null;
  np: number | null;
  /** Distance to the system, parsecs */
  d: number | null;
  /** Host star V magnitude */
  v: number | null;
  /** Host spectral type, as catalogued */
  sp: string | null;
  /** Host effective temperature, K */
  te: number | null;
  /** Position, decimal degrees (J2000) */
  ra: number | null;
  dec: number | null;
  /** 1 when the archive flags the planet as controversial */
  c: number | null;
  /** Mass provenance as the archive writes it (`pl_bmassprov`): Mass, M*sin(i)/sin(i) or M*sini. Absent in older files. */
  mp?: string | null;
  /** Uncertainty, limit flag and reference per parameter. Absent in older files; sparse. */
  u?: Partial<Record<ParamKey, ParamExtra>>;
}

/** Short keys of the five parameters that carry uncertainty, limit and reference data. */
export type ParamKey = "p" | "a" | "r" | "ms" | "t";

/** A parameter's reference, reduced to safe data: plain-text label, an optional http(s) URL, and a marker for archive-calculated values. */
export interface ExoRef {
  /** Plain text, never HTML */
  l: string;
  /** Validated http(s) URL, only when the archive supplied one */
  u?: string;
  /** "calc" when the archive says the value was calculated (CALCULATED_VALUE); it is not a publication */
  k?: "calc";
}

export interface ParamExtra {
  /** Upper uncertainty (NASA *err1) */
  e1?: number;
  /** Lower uncertainty (NASA *err2), sign exactly as given */
  e2?: number;
  /** Raw limit flag (NASA *lim) */
  l?: number;
  /** Reference for this parameter only */
  r?: ExoRef;
}

/** Archive column for each short key. */
/** Fields that map one-to-one to a required archive column (everything except the optional detail fields). */
type BaseKey = Exclude<keyof Exoplanet, "mp" | "u">;
export const EXO_COLUMNS: Record<BaseKey, string> = {
  n: "pl_name", h: "hostname", m: "discoverymethod", y: "disc_year", p: "pl_orbper", a: "pl_orbsmax", r: "pl_rade",
  ms: "pl_bmasse", t: "pl_eqt", ns: "sy_snum", np: "sy_pnum", d: "sy_dist", v: "sy_vmag", sp: "st_spectype",
  te: "st_teff", ra: "ra", dec: "dec", c: "pl_controv_flag",
};
const TEXT = new Set<BaseKey>(["n", "h", "m", "sp"]);

/** Archive columns for the extra measurement detail. Optional when parsing (older CSVs lack them); the build script requests all of them. */
export const PARAM_COLUMNS: Record<ParamKey, { value: string; e1: string; e2: string; lim: string; ref: string }> = {
  p: { value: "pl_orbper", e1: "pl_orbpererr1", e2: "pl_orbpererr2", lim: "pl_orbperlim", ref: "pl_orbper_reflink" },
  a: { value: "pl_orbsmax", e1: "pl_orbsmaxerr1", e2: "pl_orbsmaxerr2", lim: "pl_orbsmaxlim", ref: "pl_orbsmax_reflink" },
  r: { value: "pl_rade", e1: "pl_radeerr1", e2: "pl_radeerr2", lim: "pl_radelim", ref: "pl_rade_reflink" },
  ms: { value: "pl_bmasse", e1: "pl_bmasseerr1", e2: "pl_bmasseerr2", lim: "pl_bmasselim", ref: "pl_bmasse_reflink" },
  t: { value: "pl_eqt", e1: "pl_eqterr1", e2: "pl_eqterr2", lim: "pl_eqtlim", ref: "pl_eqt_reflink" },
};
export const MASS_PROV_COLUMN = "pl_bmassprov";
/** Every extra column, in query order. */
export const EXO_EXTRA_COLUMNS: string[] = [
  ...(Object.keys(PARAM_COLUMNS) as ParamKey[]).flatMap((k) => [PARAM_COLUMNS[k].e1, PARAM_COLUMNS[k].e2, PARAM_COLUMNS[k].lim, PARAM_COLUMNS[k].ref]),
  MASS_PROV_COLUMN,
];
/** Every column the build script asks the archive for. */
export const EXO_ALL_COLUMNS: string[] = [...Object.values(EXO_COLUMNS), ...EXO_EXTRA_COLUMNS];

const decodeEntities = (t: string) =>
  t.replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&nbsp;/gi, " ");

/** Only plain http(s) URLs without credentials survive; anything else (javascript:, data:, relative, malformed) is dropped. */
export function safeUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return undefined;
    return u.toString();
  } catch { return undefined; }
}

/** Never returns markup: every tag is removed, entities are decoded once, and angle brackets left over are dropped. */
const plainText = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * Reduces an archive reference cell to safe data. The archive's *_reflink columns hold either plain text or a small HTML anchor
 * (`<a refstr=... href=... target=ref>label</a>`); both are accepted. HTML is never kept or rendered: the label is plain text and the
 * link must pass safeUrl. The value CALCULATED_VALUE (the archive's marker for values it computed itself) becomes { k: "calc" }.
 */
export function parseReference(raw: string | null | undefined): ExoRef | null {
  const cell = (raw ?? "").trim();
  if (!cell) return null;
  const attr = (name: string) => {
    const m = cell.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : undefined;
  };
  const isHtml = /<\s*a\b/i.test(cell);
  const refstr = isHtml ? attr("refstr") : undefined;
  const href = isHtml ? attr("href") : /^https?:\/\//i.test(cell) ? cell : undefined;
  const inner = plainText(cell);
  const label = (inner || refstr || "").trim();
  const norm = (t: string) => t.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (norm(label) === "CALCULATED_VALUE" || (refstr !== undefined && norm(refstr) === "CALCULATED_VALUE")) return { l: "CALCULATED_VALUE", k: "calc" };
  const url = safeUrl(href);
  if (!label && url) return { l: new URL(url).host, u: url };
  if (!label) return null;
  return url ? { l: label, u: url } : { l: label };
}

/** Number or null; blank and malformed cells both become null (never 0, never NaN). */
const num = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const PC_TO_LY = 3.261564; // 1 parsec in light-years (IAU)

/** RFC 4180 CSV into rows of cells: handles quoted commas, doubled quotes, newlines inside quotes, CRLF and a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Turns the archive CSV into planets. Throws when a required column is missing, so a changed archive schema is noticed, not hidden. */
export function parseExoCsv(text: string): Exoplanet[] {
  const [head, ...body] = parseCsv(text);
  if (!head) throw new Error("empty CSV");
  const idx = new Map(head.map((h, i) => [h.trim(), i]));
  const keys = Object.keys(EXO_COLUMNS) as BaseKey[];
  const missing = keys.filter((k) => !idx.has(EXO_COLUMNS[k])).map((k) => EXO_COLUMNS[k]);
  if (missing.length) throw new Error(`archive columns missing: ${missing.join(", ")}`);
  const out: Exoplanet[] = [];
  for (const cells of body) {
    const rec: Record<string, string | number | null> = {};
    for (const k of keys) {
      const raw = (cells[idx.get(EXO_COLUMNS[k])!] ?? "").trim();
      if (raw === "") rec[k] = null;
      else if (TEXT.has(k)) rec[k] = raw;
      else { const v = Number(raw); rec[k] = Number.isFinite(v) ? v : null; }
    }
    if (!rec.n || !rec.h) continue; // a planet without a name cannot be shown or linked
    const planet = rec as unknown as Exoplanet;
    // Optional measurement detail: only when the CSV has the columns, and only for parameters that have a value.
    const cell = (col: string) => (idx.has(col) ? cells[idx.get(col)!] : undefined);
    const u: Partial<Record<ParamKey, ParamExtra>> = {};
    for (const k of Object.keys(PARAM_COLUMNS) as ParamKey[]) {
      if (planet[k] === null) continue;
      const c = PARAM_COLUMNS[k];
      const ex: ParamExtra = {};
      const e1 = num(cell(c.e1)), e2 = num(cell(c.e2)), l = num(cell(c.lim)), r = parseReference(cell(c.ref));
      if (e1 !== null) ex.e1 = e1;
      if (e2 !== null) ex.e2 = e2;
      if (l !== null) ex.l = l;
      if (r) ex.r = r;
      if (Object.keys(ex).length) u[k] = ex;
    }
    if (Object.keys(u).length) planet.u = u;
    const mp = (cell(MASS_PROV_COLUMN) ?? "").trim();
    if (mp) planet.mp = plainText(mp);
    out.push(planet);
  }
  return out;
}

/**
 * Meaning of the archive's limit flag (`*lim`).
 *  1  -> upper limit. Verified only by the archive's own formatted value for Kepler-80 f mass ("<12651.5", flag 1); the pages that define
 *        the columns do not describe the flag values.
 *  0 or absent -> no limit flag set: an ordinary value. This is the evident default, but the documentation I could read does not state it.
 *  anything else (including -1) -> NOT interpreted. The raw flag is kept and shown; the value is not presented as a plain measurement.
 */
export type LimitKind = "none" | "upper" | "unverified";
export const limitKind = (flag: number | null | undefined): LimitKind => (flag === undefined || flag === null || flag === 0 ? "none" : flag === 1 ? "upper" : "unverified");

/** Wording for the controversy flag: a literature flag, not a verdict. */
export const CONTROVERSY_TEXT =
  "The archive flags this planet as controversial: its confirmation status has been questioned in the published literature. This is a flag, not a ruling. The archive still lists it among confirmed planets.";

/** Everything the detail view needs about one of the five parameters, with missing pieces left null. */
export interface ParamDetail {
  key: ParamKey;
  value: number | null;
  upper: number | null;
  lower: number | null;
  limit: LimitKind;
  /** Raw archive flag, kept even when it is not interpreted */
  rawLimit: number | null;
  ref: ExoRef | null;
  /** "calculated": the archive computed it (reference is CALCULATED_VALUE); "measured": a published value; "unknown": no reference recorded */
  origin: "measured" | "calculated" | "unknown";
}

export function paramDetail(x: Exoplanet, key: ParamKey): ParamDetail {
  const ex = x.u?.[key];
  const ref = ex?.r ?? null;
  return {
    key,
    value: x[key],
    upper: ex?.e1 ?? null,
    lower: ex?.e2 ?? null,
    limit: limitKind(ex?.l),
    rawLimit: ex?.l ?? null,
    ref,
    origin: !ref ? "unknown" : ref.k === "calc" ? "calculated" : "measured",
  };
}

/**
 * Provenance badge for one of the five planet parameters, or null when no badge is scientifically justified.
 * The archive's composite values are published fits, and mass, radius or orbit size can depend on models (for example imaged companions),
 * so they are NOT all labelled as direct observations. Only two cases get a badge: values the archive calculated itself, and the
 * equilibrium temperature (always computed from the star and the orbit) are "estimated". Upper limits get none: they are not measurements.
 */
export function paramBadge(d: ParamDetail, isModelValue: boolean): "estimated" | null {
  if (d.value === null || d.limit === "upper" || d.limit === "unverified") return null;
  return d.origin === "calculated" || isModelValue ? "estimated" : null;
}

/** Full-precision number for scientific values: no rounding of what the archive gave, thousands separators, no float noise. */
export function fmtExact(v: number): string {
  return Number(v.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 12 });
}
/** Uncertainty sign shown exactly as stored: +200, -300 (written with a real minus sign). */
export function fmtSigned(v: number): string {
  return `${v < 0 ? "\u2212" : "+"}${fmtExact(Math.abs(v))}`;
}

/** Counts used after a build to sanity-check the new dataset. */
export function exoStats(all: Exoplanet[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  const limits: Record<string, number> = {};
  const provenance: Record<string, number> = {};
  let nullUncertainty = 0, withValue = 0, missingRef = 0, controversial = 0, withMeasureDetail = 0;
  for (const x of all) {
    if (seen.has(x.n)) duplicates++;
    seen.add(x.n);
    if (x.c === 1) controversial++;
    const mp = x.mp ?? "(none)";
    provenance[mp] = (provenance[mp] ?? 0) + 1;
    if (x.u) withMeasureDetail++;
    for (const k of Object.keys(PARAM_COLUMNS) as ParamKey[]) {
      if (x[k] === null) continue;
      withValue++;
      const d = paramDetail(x, k);
      if (d.upper === null && d.lower === null) nullUncertainty++;
      if (!d.ref) missingRef++;
      if (d.rawLimit !== null) limits[String(d.rawLimit)] = (limits[String(d.rawLimit)] ?? 0) + 1;
    }
  }
  return { records: all.length, duplicates, parameterValues: withValue, valuesWithNoUncertainty: nullUncertainty, valuesWithNoReference: missingRef, limitFlags: limits, massProvenance: provenance, controversial, recordsWithMeasurementDetail: withMeasureDetail };
}

export const distanceLy = (pc: number | null) => (pc === null ? null : pc * PC_TO_LY);

export function fmtNum(v: number | null, unit: string, digits = 3): string | null {
  if (v === null) return null;
  const s = Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Number(v.toPrecision(digits)));
  return `${s} ${unit}`;
}

export interface ExoQuery { text: string; method: string; sort: "year" | "distance" | "radius" | "name" }

/** Filter and sort; unknown values sort last. */
export function queryExo(all: Exoplanet[], q: ExoQuery): Exoplanet[] {
  const f = q.text.trim().toLowerCase();
  const out = all.filter((x) => (!q.method || x.m === q.method) && (!f || x.n.toLowerCase().includes(f) || x.h.toLowerCase().includes(f)));
  const num = (v: number | null, dir: 1 | -1) => (v === null ? Infinity : v * dir);
  const by = {
    year: (x: Exoplanet) => num(x.y, -1),
    distance: (x: Exoplanet) => num(x.d, 1),
    radius: (x: Exoplanet) => num(x.r, -1),
  } as const;
  out.sort((a, b) => (q.sort === "name" ? a.n.localeCompare(b.n) : by[q.sort](a) - by[q.sort](b) || a.n.localeCompare(b.n)));
  return out;
}
