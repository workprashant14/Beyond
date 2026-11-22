/**
 * Comparison helpers. Catalogue values are human-readable strings, so a ratio is computed ONLY when both
 * strings match a strict, known format. Anything else (prose such as "about 940 km") returns null and the UI
 * says "Ratio unavailable" instead of guessing.
 */

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };

/** "12,742 km" -> 12742. Anything else -> null. */
export function parseDiameterKm(s: string | null | undefined): number | null {
  const m = s?.trim().match(/^([\d,]+(?:\.\d+)?) km$/);
  if (!m) return null;
  const v = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** "5.972 × 10²⁴ kg" -> 5.972e24. Anything else -> null. */
export function parseMassKg(s: string | null | undefined): number | null {
  const m = s?.trim().match(/^([\d.]+) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+) kg$/);
  if (!m) return null;
  const exp = [...m[2]].map((c) => SUP[c]).join("");
  const v = Number(`${m[1]}e${exp}`);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Ratio a/b, or null if either side is missing. */
export function ratio(a: number | null, b: number | null): number | null {
  return a === null || b === null || b === 0 ? null : a / b;
}

/** "about 10.9 times", "about 1/10 as large" style text for a ratio of a to b. */
export function describeRatio(r: number | null, noun: string, aName: string, bName: string): string | null {
  if (r === null || !Number.isFinite(r)) return null;
  if (Math.abs(r - 1) < 0.005) return `${aName} and ${bName} have the same ${noun}`;
  const big = r >= 1;
  const x = big ? r : 1 / r;
  const txt = x >= 100 ? Math.round(x).toLocaleString("en-US") : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return big ? `${aName} is ${txt}× ${bName} in ${noun}` : `${bName} is ${txt}× ${aName} in ${noun}`;
}
