export type DeviceProfile = "desktop" | "mobile" | "low";

/** Coarse capability class used to scale procedural particle counts (never removes objects). */
export function deviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || window.innerWidth < 700) return cores <= 4 ? "low" : "mobile";
  return cores <= 2 ? "low" : "desktop";
}

/** Multiplier on resolved-star counts per profile. */
export const PROFILE_STAR_SCALE: Record<DeviceProfile, number> = { desktop: 1, mobile: 0.6, low: 0.4 };
