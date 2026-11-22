/**
 * Structured copies of facts ALREADY in data/objects.json (spacecraft entries, from NASA pages). Nothing new is asserted here;
 * tests/missions.test.ts checks that each launch date and distance figure still agrees with the catalogue text.
 */
export type Precision = "day" | "month" | "year";

export interface MissionFacts {
  id: string;
  /** ISO date at the stated precision: YYYY-MM-DD, YYYY-MM or YYYY */
  launch: string;
  precision: Precision;
  /** What the launch/start date means, as the catalogue words it */
  launchKind: "launch" | "construction began";
  /** A dated distance figure from NASA that allows a signal-time calculation; absent when NASA gives none for a spacecraft that moves away. */
  distance?: { au: number; asOf: string; from: "Earth" | "Sun"; rounded?: boolean };
}

export const MISSIONS: MissionFacts[] = [
  { id: "voyager-2", launch: "1977-08-20", precision: "day", launchKind: "launch", distance: { au: 116.167, asOf: "2017-11-05", from: "Earth" } },
  { id: "voyager-1", launch: "1977-09-05", precision: "day", launchKind: "launch", distance: { au: 164.7, asOf: "2024-08-21", from: "Earth" } },
  { id: "iss", launch: "1998-11", precision: "month", launchKind: "construction began" },
  { id: "hubble", launch: "1990", precision: "year", launchKind: "launch" },
  { id: "new-horizons", launch: "2006-01-19", precision: "day", launchKind: "launch", distance: { au: 60, asOf: "2024-10-01", from: "Sun", rounded: true } },
  { id: "parker-solar-probe", launch: "2018-08-12", precision: "day", launchKind: "launch" },
  { id: "jwst", launch: "2021-12-25", precision: "day", launchKind: "launch" },
];
