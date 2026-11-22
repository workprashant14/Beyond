/**
 * Bounds for drei's PerformanceMonitor, which lowers the render resolution (pixel ratio) when the frame rate falls below `lower` and raises it when
 * it stays at or above `upper`. Going from DPR_LOW to DPR_HIGH multiplies the pixels by (DPR_HIGH / DPR_LOW)^2 = 2.25, so a machine that just managed
 * `upper` fps at DPR_LOW can only be expected to manage upper / 2.25 at DPR_HIGH. With drei's default bounds (40, 60) that is 26.7 fps: below `lower`,
 * so the monitor drops the resolution again a few seconds later and the resolution pumps between the two values for as long as the page is open.
 * Requiring upper >= lower * 2.25 removes the oscillation: after one decline the resolution stays low unless the machine is fast enough to hold `lower`
 * at the high resolution. On a 60 Hz display (observed fps cannot exceed about 60) that means it never goes back up on its own.
 */
export const DPR_HIGH = 1.5;
export const DPR_LOW = 1;

export function dprBounds(refreshrate: number): [number, number] {
  const lower = refreshrate > 100 ? 60 : 40; // drei's own lower bounds
  return [lower, lower * (DPR_HIGH / DPR_LOW) ** 2];
}
