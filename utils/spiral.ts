/** Logarithmic spiral r = r0 * exp(theta * tan(pitch)). Pitch is the angle between the arm and a circle around the centre. */
export function logSpiral(r0: number, pitchDeg: number, startRad: number, turns: number, n: number): [number, number][] {
  const k = Math.tan((pitchDeg * Math.PI) / 180);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * turns * 2 * Math.PI;
    const r = r0 * Math.exp(th * k);
    out.push([r * Math.cos(startRad + th), r * Math.sin(startRad + th)]);
  }
  return out;
}
