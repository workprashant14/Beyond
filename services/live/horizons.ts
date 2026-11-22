import { fetchJson, LiveError } from "./http";
import { AU_KM, fixed, fmtDuration, row, sig3, toNum } from "./format";
import type { HorizonsTarget } from "./sources";
import type { LiveRow } from "./types";

const ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const NUM = String.raw`([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)`;

export interface HorizonsVector {
  /** Range in AU. */
  rangeAU: number;
  /** One-way light time in days. */
  lightTimeDays: number;
  /** The epoch text Horizons printed for this row (TDB). */
  epoch: string | null;
}

/** Pure: read the first vector row between $$SOE and $$EOE from a Horizons JSON payload (VEC_TABLE 3, OUT_UNITS AU-D). */
export function parseHorizons(json: unknown): HorizonsVector {
  const j = json as { result?: unknown; error?: unknown } | null;
  if (!j || typeof j !== "object") throw new LiveError("parse", "unexpected Horizons shape");
  if (j.error) throw new LiveError("not-found", "Horizons reported an error");
  if (typeof j.result !== "string") throw new LiveError("parse", "no result text");
  const m = j.result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new LiveError("parse", "no ephemeris block");
  const block = m[1];
  const rg = toNum(block.match(new RegExp(`RG\\s*=\\s*${NUM}`))?.[1]);
  const lt = toNum(block.match(new RegExp(`LT\\s*=\\s*${NUM}`))?.[1]);
  if (rg === null || lt === null) throw new LiveError("parse", "RG/LT missing");
  return { rangeAU: rg, lightTimeDays: lt, epoch: block.match(/A\.D\.\s*([0-9]{4}-[A-Za-z]{3}-[0-9]{2}\s+[0-9:.]+)\s*TDB/)?.[1] ?? null };
}

export function horizonsRows(v: HorizonsVector, label: string, moon: boolean): LiveRow[] {
  const note = v.epoch ? `as of ${v.epoch} TDB` : "current epoch";
  const km = v.rangeAU * AU_KM;
  return [
    row(
      label,
      moon ? `${Math.round(km).toLocaleString("en-US")} km` : `${fixed(v.rangeAU, 3)} AU (≈ ${sig3(km / 1e6)} million km)`,
      note,
    ),
    row("Light travel time", fmtDuration(v.lightTimeDays * 86_400), note),
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

export async function fetchHorizons(t: HorizonsTarget, now: Date): Promise<LiveRow[]> {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  const stop = new Date(start.getTime() + 3_600_000);
  const q = (s: string) => `'${s}'`;
  const url = `${ENDPOINT}?${new URLSearchParams({
    format: "json",
    COMMAND: q(t.command),
    OBJ_DATA: q("NO"),
    MAKE_EPHEM: q("YES"),
    EPHEM_TYPE: q("VECTORS"),
    CENTER: q(t.center),
    START_TIME: q(stamp(start)),
    STOP_TIME: q(stamp(stop)),
    STEP_SIZE: q("1 h"),
    VEC_TABLE: q("3"),
    OUT_UNITS: q("AU-D"),
    REF_PLANE: q("ECLIPTIC"),
    CSV_FORMAT: q("NO"),
  })}`;
  const { json } = await fetchJson(url, { revalidate: 3600 });
  return horizonsRows(parseHorizons(json), t.label, t.command === "301");
}
