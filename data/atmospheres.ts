/**
 * Which Solar System bodies get an atmosphere glow in the 3D view.
 *
 * REAL: that each listed body has a substantial atmosphere (Venus, Earth, Mars, the four giant planets, and Titan). Bodies with at most
 * a trace atmosphere (Mercury, the Moon, Io and the other moons) get no glow, so nothing is claimed for them.
 * ARTISTIC: the colour, the thickness and the brightness. They are not measured scale heights or real limb colours, and the glow is the same
 * kind of effect for a 100 bar Venus and a thin Mars (only its strength differs, as a visual cue, not a measurement).
 */
export interface AtmosphereLook {
  /** Glow colour as a hex string (artistic). */
  color: string;
  /** Shell thickness as a fraction of the body's drawn radius (artistic). */
  thickness: number;
  /** Peak brightness 0..1 (artistic; lower for thin atmospheres). */
  strength: number;
}

export const ATMOSPHERES: Readonly<Record<string, AtmosphereLook>> = {
  venus: { color: "#f3dca8", thickness: 0.07, strength: 0.8 },
  earth: { color: "#6fa8ff", thickness: 0.06, strength: 0.9 },
  mars: { color: "#e8a483", thickness: 0.04, strength: 0.35 },
  jupiter: { color: "#e6c9a0", thickness: 0.05, strength: 0.5 },
  saturn: { color: "#f0dca8", thickness: 0.05, strength: 0.5 },
  uranus: { color: "#8fe8ee", thickness: 0.06, strength: 0.7 },
  neptune: { color: "#6f8dff", thickness: 0.06, strength: 0.7 },
  titan: { color: "#e0a64a", thickness: 0.1, strength: 0.7 },
};

/**
 * Reference implementation of the glow brightness, mirrored line for line in the fragment shader (universe/objects/AtmosphereGlow.tsx).
 * cosView: dot(surface normal, direction to the camera); cosSun: dot(surface normal, direction to the Sun). Both -1..1.
 * Brightest at the limb (cosView near 0), invisible face-on, and dimmed on the night side.
 */
export function glowIntensity(cosView: number, cosSun: number, strength: number): number {
  const limb = Math.pow(Math.max(0, 0.75 - Math.abs(cosView)) / 0.75, 3);
  const lit = 0.15 + 0.85 * smoothstep(-0.25, 0.35, cosSun);
  return strength * limb * lit;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
