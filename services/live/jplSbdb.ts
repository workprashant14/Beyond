import { fetchJson, LiveError } from "./http";
import { fixed, row, sig3, toNum } from "./format";
import type { LiveRow } from "./types";

const ENDPOINT = "https://ssd-api.jpl.nasa.gov/sbdb.api";

interface Named {
  name?: string;
  value?: unknown;
}
const byName = (list: unknown): Record<string, Named> => {
  const out: Record<string, Named> = {};
  if (Array.isArray(list)) for (const e of list as Named[]) if (e && typeof e.name === "string") out[e.name] = e;
  return out;
};
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Pure: turn a JPL SBDB lookup payload into display rows. Throws LiveError on 'not found' / unexpected shapes. */
export function parseSbdb(json: unknown, status = 200): LiveRow[] {
  const j = json as {
    code?: number;
    object?: { fullname?: unknown; orbit_class?: { name?: unknown } };
    orbit?: { elements?: unknown };
    phys_par?: unknown;
    discovery?: Record<string, unknown> | null;
  } | null;

  if (status === 300 || j?.code === 300) throw new LiveError("ambiguous", "query matched several objects");
  if (!j || typeof j !== "object") throw new LiveError("parse", "unexpected SBDB shape");
  if (!j.object) throw new LiveError("not-found", "object not found");

  const el = byName(j.orbit?.elements);
  const ph = byName(j.phys_par);
  const num = (n: Named | undefined) => toNum(n?.value);

  const a = num(el.a);
  const e = num(el.e);
  const i = num(el.i);
  const per = num(el.per); // days
  const dia = num(ph.diameter); // km
  const rot = num(ph.rot_per); // hours
  const alb = num(ph.albedo);

  const disc = j.discovery;
  const discParts = disc ? [text(disc.who), text(disc.date), text(disc.location) ?? text(disc.site)].filter(Boolean) : [];

  return [
    row("JPL designation", text(j.object.fullname)),
    row("Class", text(j.object.orbit_class?.name)),
    row("Diameter", dia !== null ? `${sig3(dia)} km` : null),
    row("Rotation period", rot !== null ? `${sig3(rot)} hours` : null),
    row("Albedo", alb !== null ? fixed(alb, 3) : null),
    row("Orbital period", per !== null ? (per > 548 ? `${sig3(per / 365.25)} Earth years` : `${sig3(per)} Earth days`) : null),
    row("Semi-major axis", a !== null ? `${sig3(a)} AU` : null),
    row("Eccentricity", e !== null ? fixed(e, 4) : null),
    row("Inclination", i !== null ? `${sig3(i)}°` : null),
    row("Discovery", discParts.length ? discParts.join(" · ") : null),
  ];
}

export async function fetchSbdb(target: string): Promise<LiveRow[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({ sstr: target, "phys-par": "1", discovery: "1" })}`;
  const { status, json } = await fetchJson(url, { acceptStatuses: [300], revalidate: 86_400 });
  return parseSbdb(json, status);
}
