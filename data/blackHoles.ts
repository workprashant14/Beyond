/**
 * Published masses of the three black holes in the catalogue. Nothing else is invented here: the horizon sizes are
 * computed from these masses by utils/schwarzschild.ts. Masses are in solar masses; `plusMinus` is the quoted uncertainty.
 */
export interface BlackHoleMass {
  id: string;
  mass: number;
  plusMinus: number;
  /** What the uncertainty covers, as the source words it. */
  uncertaintyNote: string;
  source: { label: string; url: string };
  /** Short statement for the catalogue "Mass" row. */
  massText: string;
}

export const BLACK_HOLE_MASSES: Record<string, BlackHoleMass> = {
  "sgr-a": {
    id: "sgr-a",
    mass: 4.297e6,
    plusMinus: 0.012e6,
    uncertaintyNote: "statistical error only; the paper also quotes a systematic uncertainty of about 40,000 solar masses",
    source: { label: "GRAVITY Collaboration 2022, Astronomy & Astrophysics: stellar orbits around Sgr A*", url: "https://www.aanda.org/10.1051/0004-6361/202142465" },
    massText: "about 4.3 million solar masses",
  },
  m87: {
    id: "m87",
    mass: 6.5e9,
    plusMinus: 0.7e9,
    uncertaintyNote: "uncertainty as reported for the 2019 Event Horizon Telescope result",
    source: { label: "Physics World report of the Event Horizon Telescope result (April 2019)", url: "https://physicsworld.com/a/first-images-of-a-black-hole-unveiled-by-astronomers-in-landmark-discovery/" },
    massText: "about 6.5 billion solar masses",
  },
  "cygnus-x1": {
    id: "cygnus-x1",
    mass: 21.2,
    plusMinus: 2.2,
    uncertaintyNote: "uncertainty from the paper's abstract",
    source: { label: "Miller-Jones et al. 2021, Science (arXiv 2102.09091): Cygnus X-1 contains a 21-solar mass black hole", url: "https://arxiv.org/abs/2102.09091v1" },
    massText: "about 21 solar masses",
  },
};
