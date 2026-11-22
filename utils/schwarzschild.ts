/**
 * Schwarzschild radius r_s = 2GM/c^2: the event-horizon radius of a NON-rotating black hole.
 * Uses the IAU nominal solar GM (1.32712440041279419e20 m^3/s^2, same as data/gm.ts) so the uncertain G drops out,
 * and the exact SI speed of light. A spinning (Kerr) black hole has a smaller horizon, between r_s/2 and r_s,
 * and the spin of these three is not used here, so the value is an upper-bound-style estimate, not a measurement.
 */
import { GM_SUN_KM3_S2 } from "@/data/gm";

export const C_KM_S = 299792.458;
export const SUN_RADIUS_KM = 695700; // IAU 2015 nominal solar radius
export const EARTH_RADIUS_KM = 6378.1; // IAU 2015 nominal equatorial radius
export const AU_KM = 149597870.7;

/** Schwarzschild radius in km for a mass in solar masses. */
export function schwarzschildRadiusKm(massSun: number): number {
  return (2 * GM_SUN_KM3_S2 * massSun) / (C_KM_S * C_KM_S);
}

export interface Horizon { rKm: number; lowKm: number; highKm: number }

export function horizon(massSun: number, plusMinus: number): Horizon {
  return { rKm: schwarzschildRadiusKm(massSun), lowKm: schwarzschildRadiusKm(massSun - plusMinus), highKm: schwarzschildRadiusKm(massSun + plusMinus) };
}

const sig = (x: number, n = 2) => Number(x.toPrecision(n)).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** A length in km as the most natural of km, million km, au. */
export function formatLength(km: number): string {
  if (km < 1e6) return `${sig(km)} km`;
  if (km < 0.5 * AU_KM) return `${sig(km / 1e6)} million km`;
  return `${sig(km / AU_KM)} au`;
}

/** A plain size comparison for the horizon radius. */
export function compareSize(rKm: number): string {
  if (rKm < EARTH_RADIUS_KM) return `much smaller than the Earth (${sig((rKm / EARTH_RADIUS_KM) * 100)}% of its radius)`;
  if (rKm < 100 * SUN_RADIUS_KM) return `${sig(rKm / SUN_RADIUS_KM)} times the Sun's radius`;
  return `${sig(rKm / AU_KM)} times the Earth-Sun distance`;
}
