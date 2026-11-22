/**
 * Body rotation driven by the simulation clock.
 * The angle is the real sidereal rotation rate times the simulated time, so spin speeds up, slows, pauses and reverses with the clock.
 * Its zero point (angle 0 at J2000) is NOT the body's real prime-meridian orientation: textures are not calibrated, only the rate is real.
 */
const TAU = Math.PI * 2;

/** Above this many turns per real second a spin would look like a flickering or backwards wheel, so it is not animated. */
export const MAX_ANIMATED_TURNS_PER_SECOND = 0.5;

/** Rotation angle in radians (0 to 2 pi) after `days` simulated days since J2000, for a sidereal rotation period in hours. */
export function spinAngleRad(days: number, rotationHours: number): number {
  if (!(rotationHours > 0) || !Number.isFinite(days)) return 0;
  const turns = (days * 24) / rotationHours;
  return (turns - Math.floor(turns)) * TAU;
}

/** Turns per real second that the clock speed (simulated days per real second, may be negative) would produce. */
export function spinTurnsPerSecond(speedDaysPerSecond: number, rotationHours: number): number {
  return rotationHours > 0 ? Math.abs(speedDaysPerSecond * 24) / rotationHours : 0;
}

export const spinIsAnimated = (speedDaysPerSecond: number, rotationHours: number): boolean =>
  spinTurnsPerSecond(speedDaysPerSecond, rotationHours) <= MAX_ANIMATED_TURNS_PER_SECOND;
