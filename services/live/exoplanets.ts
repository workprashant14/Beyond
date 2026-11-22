import { fetchJson, LiveError } from "./http";
import { LY_PER_PC, fixed, row, sig3, toNum } from "./format";
import type { LiveRow } from "./types";
import { CONTROVERSY_TEXT, MASS_PROV_COLUMN, PARAM_COLUMNS, fmtExact, fmtSigned, limitKind, parseReference, type ParamKey } from "@/utils/exoplanets";

const ENDPOINT = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Exact columns requested (no select *): the basics used below, the five parameters' detail columns and the mass provenance. */
export const LIVE_COLUMNS: string[] = [
  "pl_name", "hostname", "disc_year", "discoverymethod", "sy_dist", "pl_controv_flag",
  ...(Object.keys(PARAM_COLUMNS) as ParamKey[]).flatMap((k) => Object.values(PARAM_COLUMNS[k])),
  MASS_PROV_COLUMN,
];

interface Detail { upper: number | null; lower: number | null; flag: number | null; refText: string | null; calculated: boolean }

/** Reads one parameter's uncertainty, limit flag and reference from a TAP row (JSON keys are the archive column names). */
function detail(r: Record<string, unknown>, k: ParamKey): Detail {
  const c = PARAM_COLUMNS[k];
  const ref = parseReference(text(r[c.ref]));
  return {
    upper: toNum(r[c.e1]), lower: toNum(r[c.e2]), flag: toNum(r[c.lim]),
    refText: ref && ref.k !== "calc" ? ref.l : null,
    calculated: ref?.k === "calc",
  };
}

/**
 * One display row for a parameter. Without uncertainty or limit data the output is exactly what it was before (3 significant digits).
 * With them, numbers are shown in full; an upper limit is written as "< value" and is never presented as a measurement; a limit flag
 * other than 1 is shown raw and uninterpreted (its meaning is not verified).
 */
function paramRow(label: string, value: number | null, unit: string, d: Detail, note?: string, plain?: (v: number) => string): LiveRow {
  if (value === null) return row(label, null);
  const kind = limitKind(d.flag);
  const notes: string[] = note ? [note] : [];
  let shown: string;
  if (kind === "upper") {
    shown = `< ${fmtExact(value)} ${unit}`;
    notes.push("upper limit, not a measured value");
  } else {
    const unc = [d.upper !== null ? fmtSigned(d.upper) : null, d.lower !== null ? fmtSigned(d.lower) : null];
    const hasUnc = unc[0] !== null || unc[1] !== null;
    shown = hasUnc || kind === "unverified" ? `${fmtExact(value)} ${unit}` : plain ? plain(value) : `${sig3(value)} ${unit}`;
    if (hasUnc) shown += ` (${unc[0] ?? "upper error not given"} / ${unc[1] ?? "lower error not given"})`;
    if (kind === "unverified") notes.push(`archive limit flag ${d.flag} (its meaning is not verified here, so this is not shown as a plain measurement)`);
  }
  if (d.calculated) notes.push("calculated by the archive (CALCULATED_VALUE), not a publication");
  else if (d.refText) notes.push(`reference: ${d.refText}`);
  return row(label, shown, notes.length ? notes.join("; ") : undefined);
}

/** Pure: turn a TAP/JSON result (array of row objects) into display rows. */
export function parseExoplanet(json: unknown): LiveRow[] {
  if (!Array.isArray(json)) throw new LiveError("parse", "unexpected TAP shape");
  const r = json[0] as Record<string, unknown> | undefined;
  if (!r || typeof r !== "object") throw new LiveError("not-found", "planet not in archive");

  const rad = toNum(r.pl_rade);
  const mass = toNum(r.pl_bmasse);
  const per = toNum(r.pl_orbper);
  const sma = toNum(r.pl_orbsmax);
  const teq = toNum(r.pl_eqt);
  const dist = toNum(r.sy_dist);
  const year = toNum(r.disc_year);
  const dt = detail(r, "t");
  const massProv = text(r[MASS_PROV_COLUMN]);
  const controversial = toNum(r.pl_controv_flag) === 1;

  const teqPlain = (v: number) => `${fixed(v, 0)} K (${fixed(v - 273.15, 0)} °C)`;
  const rows: LiveRow[] = [
    row("Archive name", text(r.pl_name)),
    row("Host star", text(r.hostname)),
    paramRow("Radius", rad, "Earth radii", detail(r, "r")),
    paramRow("Mass", mass, "Earth masses", detail(r, "ms"), ["best available estimate", massProv ? `mass type: ${massProv}` : ""].filter(Boolean).join("; ")),
    paramRow("Orbital period", per, "Earth days", detail(r, "p")),
    ...(sma !== null ? [paramRow("Semi-major axis", sma, "au", detail(r, "a"))] : []),
    paramRow("Equilibrium temperature", teq, "K", dt, "theoretical, not measured", teqPlain),
    row("Distance", dist !== null ? `${sig3(dist * LY_PER_PC)} light-years` : null),
    row("Discovery", year !== null ? `${year}${text(r.discoverymethod) ? ` · ${text(r.discoverymethod)}` : ""}` : null),
    ...(controversial ? [row("Archive flag", "Controversial", CONTROVERSY_TEXT)] : []),
  ];
  return rows;
}

export async function fetchExoplanet(names: string[]): Promise<LiveRow[]> {
  const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");
  const query = `select ${LIVE_COLUMNS.join(",")} from pscomppars where pl_name in (${list})`;
  const url = `${ENDPOINT}?${new URLSearchParams({ query, format: "json" })}`;
  const { json } = await fetchJson(url, { revalidate: 86_400 });
  return parseExoplanet(json);
}
