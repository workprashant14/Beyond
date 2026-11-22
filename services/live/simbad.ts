import { fetchJson, LiveError } from "./http";
import { fixed, row, sig3, toNum } from "./format";
import { distanceLyFromParallax } from "@/utils/sky";
import { cached } from "./cache";
import type { LiveRow, Section } from "./types";

const ENDPOINT = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync";
const DAY = 86_400_000;

/** SIMBAD object-type codes we can name with confidence; anything else is shown as the raw code. */
const OTYPE: Record<string, string> = {
  "*": "Star",
  "**": "Double or multiple star",
  "V*": "Variable star",
  "Pu*": "Pulsating variable star",
  "EB*": "Eclipsing binary",
  "SB*": "Spectroscopic binary",
  "Er*": "Eruptive variable star",
  "RG*": "Red giant branch star",
  "WD*": "White dwarf",
  "Mi*": "Mira-type variable",
  "Ce*": "Cepheid variable",
  "RR*": "RR Lyrae variable",
  "Be*": "Be star",
  // deep-sky objects
  G: "Galaxy",
  GiG: "Galaxy in a group of galaxies",
  GiP: "Galaxy in a pair of galaxies",
  GiC: "Galaxy in a cluster of galaxies",
  SyG: "Seyfert galaxy",
  AGN: "Active galactic nucleus",
  SBG: "Starburst galaxy",
  PN: "Planetary nebula",
  SNR: "Supernova remnant",
  HII: "H II region",
  RNe: "Reflection nebula",
  OpC: "Open cluster",
  GlC: "Globular cluster",
  "Cl*": "Cluster of stars",
  "As*": "Association of stars",
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Pure: turn a SIMBAD TAP JSON result ({metadata:[{name}], data:[[...]]}) into display rows.
 * Columns are looked up by name, so a different column order cannot silently shift values.
 */
export function parseSimbad(json: unknown): LiveRow[] {
  const j = json as { metadata?: { name?: unknown }[]; data?: unknown[][] } | null;
  if (!j || !Array.isArray(j.metadata) || !Array.isArray(j.data)) throw new LiveError("parse", "unexpected SIMBAD shape");
  if (j.data.length === 0) throw new LiveError("not-found", "no SIMBAD record");
  const cols = j.metadata.map((m) => String(m?.name ?? "").toLowerCase());
  const first = j.data[0];
  if (!Array.isArray(first)) throw new LiveError("parse", "unexpected SIMBAD row");
  const get = (name: string) => {
    const i = cols.indexOf(name);
    return i >= 0 ? first[i] : undefined;
  };
  if (cols.indexOf("main_id") < 0) throw new LiveError("parse", "SIMBAD result lacks main_id");

  const otype = text(get("otype"));
  const plx = toNum(get("plx_value"));
  const err = toNum(get("plx_err"));
  const dist = distanceLyFromParallax(plx, err);

  return [
    row("SIMBAD identifier", text(get("main_id"))),
    row("Object type", otype ? (OTYPE[otype] ?? `SIMBAD type code “${otype}”`) : null),
    row("Spectral type", text(get("sp_type")), "observed classification"),
    row("Parallax", plx !== null ? `${fixed(plx, 2)} mas${err !== null ? ` ± ${fixed(err, 2)}` : ""}` : null),
    row("Distance", dist !== null ? `about ${sig3(dist)} light-years` : null, dist !== null ? "estimated as 1 / parallax" : undefined),
  ];
}

/** Pure: rows for a deep-sky object (object type, morphology, redshift). Redshift is shown as measured; no distance is derived from it. */
export function parseSimbadDso(json: unknown): LiveRow[] {
  const j = json as { metadata?: { name?: unknown }[]; data?: unknown[][] } | null;
  if (!j || !Array.isArray(j.metadata) || !Array.isArray(j.data)) throw new LiveError("parse", "unexpected SIMBAD shape");
  if (j.data.length === 0) throw new LiveError("not-found", "no SIMBAD record");
  const cols = j.metadata.map((m) => String(m?.name ?? "").toLowerCase());
  const first = j.data[0];
  if (!Array.isArray(first) || cols.indexOf("main_id") < 0) throw new LiveError("parse", "unexpected SIMBAD row");
  const get = (name: string) => { const i = cols.indexOf(name); return i >= 0 ? first[i] : undefined; };
  const otype = text(get("otype"));
  const z = toNum(get("rvz_redshift"));
  return [
    row("SIMBAD identifier", text(get("main_id"))),
    row("Object type", otype ? (OTYPE[otype] ?? `SIMBAD type code “${otype}”`) : null),
    row("Morphological type", text(get("morph_type")), "observed classification"),
    row("Redshift (z)", z !== null ? fixed(z, 5) : null, z !== null ? "as measured; negative means approaching" : undefined),
  ];
}

export function isSimbadIdent(id: string): boolean {
  return /^[A-Za-z]{1,6} ?\d{1,6}[A-Za-z]{0,2}$/.test(id) && id.length <= 14;
}

export async function fetchSimbadDso(ident: string): Promise<LiveRow[]> {
  if (!isSimbadIdent(ident)) throw new LiveError("not-found", "invalid identifier");
  const query =
    "SELECT b.main_id, b.otype, b.morph_type, b.rvz_redshift FROM basic AS b " +
    `JOIN ident AS i ON i.oidref = b.oid WHERE i.id = '${ident}'`;
  const url = `${ENDPOINT}?${new URLSearchParams({ request: "doQuery", lang: "adql", format: "json", query })}`;
  const { json } = await fetchJson(url, { revalidate: 86_400 });
  return parseSimbadDso(json);
}

export async function getDsoLive(ident: string): Promise<{ id: string; measurements: Section<LiveRow[]> }> {
  const measurements = await cached<Section<LiveRow[]>>(
    `simbad-dso:${ident}`,
    (v) => (v.status === "ok" ? DAY : 30_000),
    async () => {
      try {
        return {
          status: "ok",
          data: await fetchSimbadDso(ident),
          sources: [{ label: "SIMBAD Astronomical Database (CDS)", url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(ident)}` }],
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return e instanceof LiveError
          ? { status: "unavailable", reason: e.reason, detail: e.message }
          : { status: "unavailable", reason: "network", detail: "unexpected error" };
      }
    },
  );
  return { id: ident, measurements };
}

export async function fetchSimbad(hip: number): Promise<LiveRow[]> {
  if (!Number.isInteger(hip) || hip < 1 || hip > 120000) throw new LiveError("not-found", "invalid HIP number");
  const query =
    "SELECT b.main_id, b.otype, b.sp_type, b.plx_value, b.plx_err FROM basic AS b " +
    `JOIN ident AS i ON i.oidref = b.oid WHERE i.id = 'HIP ${hip}'`;
  const url = `${ENDPOINT}?${new URLSearchParams({ request: "doQuery", lang: "adql", format: "json", query })}`;
  const { json } = await fetchJson(url, { revalidate: 86_400 });
  return parseSimbad(json);
}

export interface StarLive {
  hip: number;
  measurements: Section<LiveRow[]>;
}

export async function getStarLive(hip: number): Promise<StarLive> {
  const measurements = await cached<Section<LiveRow[]>>(
    `simbad:${hip}`,
    (v) => (v.status === "ok" ? DAY : 30_000),
    async () => {
      try {
        return {
          status: "ok",
          data: await fetchSimbad(hip),
          sources: [{ label: "SIMBAD Astronomical Database (CDS)", url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=HIP+${hip}` }],
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return e instanceof LiveError
          ? { status: "unavailable", reason: e.reason, detail: e.message }
          : { status: "unavailable", reason: "network", detail: "unexpected error" };
      }
    },
  );
  return { hip, measurements };
}
