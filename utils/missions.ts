/** Arithmetic on the mission facts in data/missions.ts. Everything here is computed, nothing is looked up. */
import type { MissionFacts } from "@/data/missions";

/** Light travel time for 1 au: 499.004783836 s (IAU 2012 au = 149,597,870,700 m, c = 299,792,458 m/s). */
export const LIGHT_SECONDS_PER_AU = 149597870700 / 299792458;

/** One-way light travel time in hours for a distance in au. */
export function lightTimeHours(au: number): number {
  return (au * LIGHT_SECONDS_PER_AU) / 3600;
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  return `${hours.toFixed(1)} hours`;
}

export interface Elapsed { years: number; days: number | null; approx: boolean }

/** Time from the launch date to `now` (UTC). Day precision: whole years and remaining days. Month/year precision: whole years only, marked approximate. */
export function elapsedSince(m: Pick<MissionFacts, "launch" | "precision">, now: Date): Elapsed {
  const [y, mo = "1", d = "1"] = m.launch.split("-");
  const ny = now.getUTCFullYear(), nm = now.getUTCMonth(), nd = now.getUTCDate();
  if (m.precision === "year") return { years: ny - +y, days: null, approx: true };
  if (m.precision === "month") return { years: Math.floor(((ny - +y) * 12 + (nm - (+mo - 1))) / 12), days: null, approx: true };
  const anniv = (yr: number) => Date.UTC(yr, +mo - 1, +d);
  const today = Date.UTC(ny, nm, nd);
  const years = ny - +y - (today < anniv(ny) ? 1 : 0);
  return { years, days: Math.round((today - anniv(+y + years)) / 86400000), approx: false };
}

export function formatElapsed(e: Elapsed): string {
  const yrs = `${e.years} year${e.years === 1 ? "" : "s"}`;
  return e.days === null ? `about ${yrs}` : `${yrs} and ${e.days} day${e.days === 1 ? "" : "s"}`;
}
