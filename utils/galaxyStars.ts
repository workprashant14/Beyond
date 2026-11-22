/** Smaller galaxies get fewer points, so the universe view stays light on integrated graphics. */
export const galaxyStars = (radius: number) =>
  Math.round(Math.min(7000, Math.max(2200, 7000 * Math.pow(radius / 34, 1.5))));
