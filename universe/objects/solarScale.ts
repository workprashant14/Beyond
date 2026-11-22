/**
 * NOT TO SCALE. Real solar system proportions can't be shown on one screen
 * (Neptune is ~78x farther out than Mercury, the Sun ~109x wider than Earth),
 * so distances and sizes are compressed with monotonic curves: bigger / farther
 * real values still look bigger / farther, but ratios are not preserved.
 */
export const SUN_VISUAL_RADIUS = 4.5;

export const visualOrbitRadius = (semiMajorAxisAU: number): number => 8 + 14 * Math.sqrt(semiMajorAxisAU);

/** Moon orbit size (world units): logarithmic in a / planet radius, so a farther moon is always drawn farther out. */
export const moonVisualOrbit = (parentRadiusKm: number, aKm: number): number =>
  visualRadius(parentRadiusKm) * (1.8 + 0.9 * Math.log(aKm / parentRadiusKm));

export const visualRadius = (radiusKm: number): number => 0.45 * Math.pow(radiusKm / 6371, 0.35);

export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const daysSinceJ2000 = (ms: number): number => (ms - J2000_MS) / 86_400_000;
