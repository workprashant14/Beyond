import { UNAVAILABLE } from "@/utils/format";
import type { LiveRow } from "./types";

export const AU_KM = 149_597_870.7;
export const LY_PER_PC = 3.26156;

export const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** 3 significant digits with thousands separators. */
export const sig3 = (n: number): string => Number(n.toPrecision(3)).toLocaleString("en-US");
export const fixed = (n: number, d: number): string => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${fixed(seconds, 1)} seconds`;
  if (seconds < 90 * 60) return `${fixed(seconds / 60, 1)} minutes`;
  return `${fixed(seconds / 3600, 1)} hours`;
}

/** A row whose value is "Data unavailable" when the upstream value is missing. */
export const row = (label: string, value: string | null, note?: string): LiveRow => ({
  label,
  value: value ?? UNAVAILABLE,
  ...(value !== null && note ? { note } : {}),
});
