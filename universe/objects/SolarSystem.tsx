"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SOLAR_BODIES } from "@/data/solarSystem";
import { SPEEDS, type SimState } from "@/universe/engine/simTypes";
import { utcMsToClockDays, stepClock, formatClockDate, type ClockLimit } from "@/utils/simClock";
import { getSolarBody } from "@/data/solarSystem";
import { formatReadout, scaleReadout } from "./scaleReadout";
import SolarBodyMesh, { type Clock, type Shared } from "./SolarBodyMesh";
import OrbitLine from "./OrbitLine";
import SmallBodies from "./SmallBodies";
import ConceptualRegions from "./ConceptualRegions";

/** Evaluated once when this client-only module loads: "now", in days since J2000. */
const BOOT_DAYS = utcMsToClockDays(Date.now());

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  sim: SimState;
  dateRef: React.RefObject<HTMLElement | null>;
  onSmallSelect?: (id: string | null) => void;
  /** Real-versus-drawn numbers for the selected body (text written without React re-renders). */
  readoutRef?: React.RefObject<HTMLElement | null>;
  onClockLimit?: (which: ClockLimit) => void;
}

/**
 * The Sun, eight planets and six moons on real Keplerian orbits (JPL elements, data/keplerElements.ts). Sizes and
 * semi-major axes are compressed (not to scale); eccentricity, tilt and orientation are real. Planet positions follow
 * JPL's approximate-position method; moon positions along their orbits are illustrative (mean elements, not an ephemeris).
 */
export default function SolarSystem({ selectedId, onSelect, sim, dateRef, onSmallSelect, readoutRef, onClockLimit }: Props) {
  const clock = useRef<Clock>({ days: BOOT_DAYS });
  const acc = useRef(0);
  const speed = SPEEDS[sim.speedIdx] ?? SPEEDS[0];

  const paint = () => {
    const text = formatClockDate(clock.current.days);
    if (dateRef.current) dateRef.current.textContent = text;
    const sel = selectedId ? getSolarBody(selectedId) : undefined;
    if (readoutRef?.current) readoutRef.current.textContent = sel ? formatReadout(sel, scaleReadout(sel, clock.current.days)) : "";
  };

  useEffect(() => {
    // Jump to the real current date (also runs once on mount).
    clock.current.days = utcMsToClockDays(Date.now());
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.resetToken]);

  useEffect(() => {
    // Jump to a date the user chose (token 0 is the initial value, not a request).
    if (sim.jump.token === 0) return;
    clock.current.days = utcMsToClockDays(sim.jump.ms);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.jump.token]);

  useFrame((_, dt) => {
    if (!sim.paused) {
      const r = stepClock(clock.current.days, dt, speed, sim.reverse ? -1 : 1);
      clock.current.days = r.days;
      if (r.limit) onClockLimit?.(r.limit);
    }
    acc.current += dt;
    if (acc.current > 0.25) {
      acc.current = 0;
      paint();
    }
  });

  const shared: Shared = { clock, selectedId, onSelect, paused: sim.paused, speed, labels: sim.labels, orbits: sim.orbits, atmospheres: sim.atmospheres, ringShadows: sim.ringShadows };
  const top = SOLAR_BODIES.filter((b) => !b.parent);

  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={5} decay={0} />
      {sim.orbits &&
        top
          .filter((b) => b.kind === "planet")
          .map((b) => <OrbitLine key={b.id} body={b} />)}
      <ConceptualRegions on={sim.regions} />
      {sim.smallBodies && <SmallBodies clock={clock} selectedId={sim.smallSel} onSelect={(id) => onSmallSelect?.(id)} labels={sim.labels} orbits={sim.orbits} tails={sim.tails} />}
      {top.map((b) => (
        <SolarBodyMesh key={b.id} data={b} shared={shared} initialDays={BOOT_DAYS} />
      ))}
    </group>
  );
}
