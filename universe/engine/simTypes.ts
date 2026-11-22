/** Simulation speeds in simulated days per real second. */
export const SPEEDS = [0.1, 0.5, 1, 5, 10, 25, 50, 100] as const;
/** 10 simulated days per second, as before the slower speeds were added. */
export const DEFAULT_SPEED_INDEX = 4;

export interface SimState {
  speedIdx: number;
  paused: boolean;
  orbits: boolean;
  labels: boolean;
  /** Show the asteroid and comet layer (only if public/smallbodies/bodies.json exists). */
  smallBodies: boolean;
  /** SPK-ID of the selected asteroid or comet. */
  smallSel: string | null;
  /** Increment to jump the simulation clock back to the current real date. */
  resetToken: number;
  /** Run the clock backwards (speed stays a positive magnitude). */
  reverse: boolean;
  /** Jump to a UTC date: change `token` to apply `ms`. */
  jump: { token: number; ms: number };
  /** Which schematic outer regions are drawn (Kuiper belt, scattered disc, Oort cloud). */
  /** Draw illustrative comet tails. */
  tails: boolean;
  /** Draw the artistic atmosphere glow on bodies that have atmospheres. */
  atmospheres: boolean;
  /** Draw Saturn's ring shadow on the globe and the globe's shadow on the rings. */
  ringShadows: boolean;
  regions: { kuiper: boolean; scattered: boolean; oort: boolean };
  /** Set when the clock stopped at the edge of the valid range (1800 or 2050). */
  limit: "start" | "end" | null;
}

export const INITIAL_SIM: SimState = {
  speedIdx: DEFAULT_SPEED_INDEX,
  paused: false,
  orbits: true,
  labels: true,
  smallBodies: true,
  smallSel: null,
  resetToken: 0,
  reverse: false,
  jump: { token: 0, ms: 0 },
  limit: null,
  // The Oort cloud is off by default: it is theoretical and makes the view very wide.
  tails: true,
  atmospheres: true,
  ringShadows: true,
  regions: { kuiper: true, scattered: true, oort: false },
};
