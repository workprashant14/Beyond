import { solveKepler, solveHyperbolicKepler, rotateOrbital, type Vec3 } from "./kepler";

/**
 * Asteroids and comets from the JPL Small-Body Database query API (https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html).
 * Field names and units were checked against that documentation: a (au), e, i (deg), om (deg, ascending node), w (deg, argument
 * of perihelion), ma (deg, mean anomaly), epoch (Julian day, TDB, epoch of osculation), tp (Julian day, TDB, perihelion time),
 * q (au), per (days), H (absolute magnitude), diameter (km). The documentation page does not describe the response layout; this
 * parser expects {"fields": [...], "data": [[...], ...]}, reads columns by name and fails loudly if it sees anything else.
 *
 * Open orbits (osculating e > 1, a < 0) are supported with the hyperbolic Kepler equation. Parabolic orbits (e = 1 within 1e-9) are
 * dropped and counted, as are rows with e < 0. An osculating e above 1 describes the orbit at the epoch only; it can differ from the
 * orbit before or after a close planetary encounter.
 *
 * Positions are TWO-BODY propagations of osculating elements from their epoch. They are close to the epoch and drift as planets
 * perturb the orbit, so the further the date is from the epoch, the less reliable the place on the orbit is.
 */
export interface SmallBody {
  /** SPK-ID, unique */
  id: string;
  /** Full designation and name, as JPL gives it */
  n: string;
  /** a = asteroid, c = comet */
  k: "a" | "c";
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  /** Mean anomaly in degrees at epoch `ep` (for comets derived from tp and the period). For an open (hyperbolic) orbit it is signed and not limited to 360. */
  ma: number;
  /** Epoch, Julian day (TDB) */
  ep: number;
  /** Orbital period, days; null when the osculating orbit is open (e > 1) */
  per: number | null;
  H: number | null;
  /** Diameter, km */
  d: number | null;
}

export interface SmallBodyMeta { source: string; built: string; asteroids: number; comets: number; query: string }
export interface SmallBodyFile { meta: SmallBodyMeta; bodies: SmallBody[] }

const J2000_JD = 2451545.0;
/** Gaussian gravitational constant (radians per day at 1 au); mean motion on an open orbit is K / |a|^1.5. */
const K_GAUSS = 0.01720209895;
const AU_DAYS = 365.25636; // sidereal year in days: P(days) = 365.25636 * a^1.5 for a Sun-dominated orbit
const rad = (d: number) => (d * Math.PI) / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

export const jdOf = (daysSinceJ2000: number) => J2000_JD + daysSinceJ2000;

const asNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface ParsedSbdb { bodies: SmallBody[]; dropped: number }

/**
 * JPL sb-cdata constraint for the comet query. Without it, sorting comets by perihelion distance q returns the first rows
 * dominated by SOHO sungrazers, whose published orbits are exactly parabolic (e = 1). parseSbdbQuery correctly rejects those
 * (a parabola has no semi-major axis or period, and the hyperbolic and elliptical equations are both undefined at e = 1), so the
 * build ended up with too few usable comets. This asks JPL for e below 0.999999999 (elliptical) or above 1.000000001 (hyperbolic),
 * which is the same 1e-9 margin the parser uses, and for rows where i, om, w, tp and q are defined. Both elliptical and hyperbolic
 * orbits stay in; only parabolic and incomplete rows are excluded server-side. The parser still validates every row it receives.
 * Syntax: https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html (sb-cdata, "|DF" = defined). The counts that come back depend on the live catalogue.
 */
export const COMET_CONSTRAINT = {
  AND: [{ OR: ["e|LT|0.999999999", "e|GT|1.000000001"] }, "i|DF", "om|DF", "w|DF", "tp|DF", "q|DF"],
};

/** Comet query URL: all comets, filtered by COMET_CONSTRAINT, sorted by perihelion distance, first `limit` rows. */
export function cometQueryUrl(endpoint: string, fields: string, limit: number): string {
  return `${endpoint}?fields=${fields}&sb-kind=c&sb-cdata=${encodeURIComponent(JSON.stringify(COMET_CONSTRAINT))}&sort=q&limit=${limit}&full-prec=true`;
}

/** Parses one sbdb_query response for asteroids ("a") or comets ("c"). */
export function parseSbdbQuery(json: unknown, kind: "a" | "c"): ParsedSbdb {
  const j = json as { fields?: unknown; data?: unknown } | null;
  if (!j || !Array.isArray(j.fields) || !Array.isArray(j.data)) throw new Error('unexpected response: expected {"fields": [...], "data": [[...]]}');
  const idx = new Map((j.fields as string[]).map((f, i) => [f, i]));
  const need = kind === "a" ? ["full_name", "spkid", "a", "e", "i", "om", "w", "ma", "epoch"] : ["full_name", "spkid", "e", "i", "om", "w", "epoch", "tp", "q"];
  const missing = need.filter((f) => !idx.has(f));
  if (missing.length) throw new Error(`response is missing fields: ${missing.join(", ")} (it has: ${(j.fields as string[]).join(", ")})`);
  const bodies: SmallBody[] = [];
  let dropped = 0;
  for (const row of j.data as unknown[][]) {
    const g = (f: string) => (idx.has(f) ? row[idx.get(f)!] : null);
    const n = typeof g("full_name") === "string" ? (g("full_name") as string).trim() : "";
    const id = g("spkid") === null ? "" : String(g("spkid")).trim();
    const e = asNum(g("e")), i = asNum(g("i")), om = asNum(g("om")), w = asNum(g("w")), ep = asNum(g("epoch"));
    if (!n || !id || e === null || i === null || om === null || w === null || ep === null || e < 0 || Math.abs(e - 1) < 1e-9) { dropped++; continue; }
    const open = e > 1;
    let a: number | null, ma: number | null, per: number | null;
    if (kind === "a") {
      a = asNum(g("a")); ma = asNum(g("ma"));
      if (a === null || ma === null || (open ? a >= 0 : a <= 0)) { dropped++; continue; }
      per = open ? null : asNum(g("per")) ?? AU_DAYS * a ** 1.5;
    } else {
      const q = asNum(g("q")), tp = asNum(g("tp"));
      if (q === null || tp === null || q <= 0) { dropped++; continue; }
      a = q / (1 - e); // negative for an open orbit
      if (open) { per = null; ma = (K_GAUSS / Math.abs(a) ** 1.5) * (ep - tp) * (180 / Math.PI); }
      else { per = AU_DAYS * a ** 1.5; ma = norm360((360 / per) * (ep - tp)); }
    }
    bodies.push({ id, n, k: kind, a, e, i, om, w, ma, ep, per, H: asNum(g("H")), d: asNum(g("diameter")) });
  }
  return { bodies, dropped };
}

const isOpen = (b: SmallBody) => b.e > 1;

/** Heliocentric position in AU, ecliptic J2000 axes, two-body from the osculating elements. */
export function smallBodyPosition(b: SmallBody, daysSinceJ2000: number): Vec3 {
  const dt = jdOf(daysSinceJ2000) - b.ep;
  if (isOpen(b)) {
    const A = Math.abs(b.a);
    const M = rad(b.ma) + (K_GAUSS / A ** 1.5) * dt;
    const H = solveHyperbolicKepler(M, b.e);
    // hyperbola: r = |a| (e cosh H - 1); x points to perihelion, y along the motion
    return rotateOrbital(A * (b.e - Math.cosh(H)), A * Math.sqrt(b.e * b.e - 1) * Math.sinh(H), rad(b.w), rad(b.i), rad(b.om));
  }
  const M = rad(b.ma) + ((2 * Math.PI) / b.per!) * dt;
  const E = solveKepler(M, b.e);
  return rotateOrbital(b.a * (Math.cos(E) - b.e), b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), rad(b.w), rad(b.i), rad(b.om));
}

/** An open orbit comes from and goes to infinity, so only the part within this distance (au) is drawn. */
export const OPEN_ORBIT_DRAW_AU = 60;

export interface OrbitPath { points: Vec3[]; /** true for an ellipse (draw as a loop), false for the drawn part of a hyperbola */ closed: boolean }

export function smallBodyOrbitPath(b: SmallBody, n = 256): OrbitPath {
  const points: Vec3[] = [];
  if (isOpen(b)) {
    const A = Math.abs(b.a), rMax = Math.max(OPEN_ORBIT_DRAW_AU, 2 * A * (b.e - 1));
    const Hmax = Math.acosh((rMax / A + 1) / b.e);
    for (let k = 0; k <= n; k++) {
      const H = -Hmax + (2 * Hmax * k) / n;
      points.push(rotateOrbital(A * (b.e - Math.cosh(H)), A * Math.sqrt(b.e * b.e - 1) * Math.sinh(H), rad(b.w), rad(b.i), rad(b.om)));
    }
    return { points, closed: false };
  }
  for (let k = 0; k < n; k++) {
    const E = (k / n) * 2 * Math.PI;
    points.push(rotateOrbital(b.a * (Math.cos(E) - b.e), b.a * Math.sqrt(1 - b.e * b.e) * Math.sin(E), rad(b.w), rad(b.i), rad(b.om)));
  }
  return { points, closed: true };
}

/** Julian day to a calendar date string (UTC; TDB-UTC is about a minute, irrelevant at day precision). */
export const jdToDate = (jd: number) => new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);

export function searchSmallBodies(all: SmallBody[], text: string, limit = 8): SmallBody[] {
  const f = text.trim().toLowerCase();
  if (!f) return [];
  const starts = all.filter((b) => b.n.toLowerCase().includes(f)).sort((a, b) => Number(!a.n.toLowerCase().startsWith(f)) - Number(!b.n.toLowerCase().startsWith(f)));
  return starts.slice(0, limit);
}
