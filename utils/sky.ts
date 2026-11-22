/** Pure helpers for the sky atlas: coordinates, formatting, estimates and star names. */

export const SKY_RADIUS = 100;
const D2R = Math.PI / 180;

/**
 * Equatorial (RA, Dec in degrees) to a point on the celestial sphere.
 * +Y is the north celestial pole, +X the vernal equinox (RA 0). RA grows eastward
 * (counter-clockwise seen from the north pole), so RA 90 degrees lies on -Z.
 * Viewed from the origin this reproduces the real sky, not a mirror image.
 */
export function raDecToVec(raDeg: number, decDeg: number, r = SKY_RADIUS): [number, number, number] {
  const a = raDeg * D2R;
  const d = decDeg * D2R;
  const c = Math.cos(d);
  return [r * c * Math.cos(a), r * Math.sin(d), -r * c * Math.sin(a)];
}

/** Camera yaw/pitch (radians) that makes a camera with rotation order YXZ look at this RA/Dec. */
export function lookAngles(raDeg: number, decDeg: number): { yaw: number; pitch: number } {
  const [x, y, z] = raDecToVec(raDeg, decDeg, 1);
  return { yaw: Math.atan2(-x, -z), pitch: Math.asin(Math.max(-1, Math.min(1, y))) };
}

export function formatRA(raDeg: number): string {
  const totalSec = Math.round((((raDeg % 360) + 360) % 360) / 15 * 3600);
  const t = totalSec % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "−" : "+";
  const total = Math.round(Math.abs(decDeg) * 3600);
  const d = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${sign}${d}° ${String(m).padStart(2, "0")}′ ${String(s).padStart(2, "0")}″`;
}

export function formatMag(m: number): string {
  return (m < 0 ? "−" : "") + Math.abs(m).toFixed(2);
}

/**
 * Effective temperature estimated from the B-V colour index (Ballesteros 1997).
 * Rough (hundreds of kelvin) and ignores interstellar reddening. Null outside the formula's useful range.
 */
export function estimateTempK(bv: number | null | undefined): number | null {
  if (bv === null || bv === undefined || !Number.isFinite(bv) || bv < -0.4 || bv > 2.0) return null;
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Display colour (0..1 RGB) for a star: blackbody approximation of the estimated temperature, softened toward white. */
export function starColor(bv: number | null | undefined): [number, number, number] {
  const T = estimateTempK(bv) ?? 6500;
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const soft = (v: number) => (clamp(v) / 255) * 0.75 + 0.25;
  return [soft(r), soft(g), soft(b)];
}

export const LY_PER_PC = 3.26156;

/** Distance in light-years from a parallax in milliarcseconds; null unless the parallax is positive and well measured (S/N >= 5). */
export function distanceLyFromParallax(plxMas: number | null, errMas: number | null): number | null {
  if (plxMas === null || !(plxMas > 0)) return null;
  if (errMas !== null && errMas > 0 && plxMas / errMas < 5) return null;
  return (1000 / plxMas) * LY_PER_PC;
}

// ---- designations -------------------------------------------------------

const GREEK: Record<string, string> = {
  α: "Alpha", β: "Beta", γ: "Gamma", δ: "Delta", ε: "Epsilon", ζ: "Zeta", η: "Eta", θ: "Theta", ι: "Iota", κ: "Kappa",
  λ: "Lambda", μ: "Mu", ν: "Nu", ξ: "Xi", ο: "Omicron", π: "Pi", ρ: "Rho", σ: "Sigma", τ: "Tau", υ: "Upsilon",
  φ: "Phi", χ: "Chi", ψ: "Psi", ω: "Omega",
};
const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const sup = (d: string) => d.replace(/\d/g, (c) => SUP[Number(c)]);

/** "κ1" -> {letter:"κ", n:"1"}; returns null for anything that is not letter(s)+digit. */
function splitBayer(b: string) {
  const m = /^(\p{L}{1,2})(\d?)$/u.exec(b);
  return m ? { letter: m[1], n: m[2] } : null;
}

export interface StarNames {
  n?: string; // proper name
  b?: string; // Bayer letter(s) + optional index
  f?: string; // Flamsteed number
  v?: string; // variable-star designation
  h?: string; // HD number
  c?: string; // IAU constellation abbreviation
}

/** "α Canis Majoris" (short symbol) or "Alpha Canis Majoris" (long) from the Bayer field and the constellation's genitive. */
export function bayerName(b: string | undefined, gen: string | undefined, long = false): string | null {
  if (!b || !gen) return null;
  const p = splitBayer(b);
  if (!p) return null;
  const greek = GREEK[p.letter];
  const letter = long && greek ? greek : p.letter;
  return `${letter}${p.n ? (long ? ` ${p.n}` : sup(p.n)) : ""} ${gen}`;
}

export function flamsteedName(f: string | undefined, gen: string | undefined): string | null {
  return f && gen ? `${f} ${gen}` : null;
}

/** Best display name: proper name, else Bayer, else Flamsteed, else variable designation, else HIP number. */
export function starDisplayName(hip: number, names: StarNames | undefined, gen: string | undefined, abbr: string | undefined): string {
  if (names?.n) return names.n;
  return (
    bayerName(names?.b, gen) ??
    flamsteedName(names?.f, gen) ??
    (names?.v && abbr ? `${names.v} ${abbr}` : null) ??
    `HIP ${hip}`
  );
}
