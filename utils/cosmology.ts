/**
 * Flat Lambda-CDM distances, used only to turn a catalogued redshift into an ESTIMATED distance for galaxies.
 * Parameters are the Planck 2018 base-LCDM best fit (H0 = 67.4 km/s/Mpc, Omega_m = 0.315; Planck Collaboration 2018, paper VI, TT,TE,EE+lowE+lensing).
 * Radiation is ignored (negligible at the low redshifts used here). Checked against astropy FlatLambdaCDM(Tcmb0=0) in tests/dsodistance.test.ts.
 */
export const COSMOLOGY = { H0: 67.4, omegaM: 0.315, label: "Planck 2018 flat ΛCDM (H0 = 67.4 km/s/Mpc, Ωm = 0.315)" } as const;
export const C_KMS = 299792.458;
export const MPC_LY = 3_261_563.777; // light-years in a megaparsec (IAU parsec = 3.26156377716 ly)

/** Comoving (line-of-sight) distance in megaparsecs: (c/H0) x integral of dz / E(z), Simpson's rule. */
export function comovingDistanceMpc(z: number, c: { H0: number; omegaM: number } = COSMOLOGY): number {
  if (!Number.isFinite(z) || z < 0) throw new RangeError("redshift must be a non-negative number");
  if (z === 0) return 0;
  const E = (x: number) => Math.sqrt(c.omegaM * (1 + x) ** 3 + (1 - c.omegaM));
  const n = 2000; // even; the integrand is smooth, so the error is far below 1e-9 for z < 10
  const h = z / n;
  let s = 1 / E(0) + 1 / E(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / E(i * h);
  return (C_KMS / c.H0) * (s * h) / 3;
}
