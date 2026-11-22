"use client";

import { useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Rewind, Tag, Orbit, Asterisk } from "lucide-react";
import { useSmallBodyState } from "@/universe/objects/smallBodyData";
import { pickFeatured } from "@/utils/featuredBodies";
import { REGIONS } from "@/utils/conceptualRegions";
import { jdToDate, searchSmallBodies } from "@/utils/smallBodies";
import { fmtNum } from "@/utils/exoplanets";
import { UNAVAILABLE } from "@/utils/format";
import ProvenanceBadge from "./ProvenanceBadge";
import { SPEEDS, type SimState } from "@/universe/engine/simTypes";
import { CLOCK_MAX_DATE, CLOCK_MIN_DATE, parseDateInput, clockDaysFromDateInput } from "@/utils/simClock";

interface Props {
  sim: SimState;
  onChange: (patch: Partial<SimState>) => void;
  dateRef: React.RefObject<HTMLSpanElement | null>;
  readoutRef: React.RefObject<HTMLParagraphElement | null>;
}

const toggle = (on: boolean) =>
  `grid h-9 w-9 place-items-center rounded-full border transition ${
    on ? "border-cyan/60 text-cyan" : "border-line text-muted hover:text-ink"
  }`;

function SmallBodyBlock({ sim, onChange }: Pick<Props, "sim" | "onChange">) {
  const state = useSmallBodyState();
  const file = state.status === "ready" ? state.file : null;
  const [text, setText] = useState("");
  const bodies = file?.bodies ?? null;
  const hits = useMemo(() => (bodies ? searchSmallBodies(bodies, text) : []), [bodies, text]);
  const sel = bodies && sim.smallSel ? bodies.find((b) => b.id === sim.smallSel) ?? null : null;
  const featured = useMemo(() => (bodies ? pickFeatured(bodies) : null), [bodies]);
  if (state.status === "loading") return null;
  if (!file || !bodies) {
    return (
      <p className="mt-2 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">
        Dwarf planets, asteroids and comets: Data unavailable. The JPL Small-Body file has not been built (run <code>npm run build:smallbodies</code> on a computer with internet).
      </p>
    );
  }
  return (
    <div className="mt-2 border-t border-line pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Toggle asteroids and comets" aria-pressed={sim.smallBodies} onClick={() => onChange({ smallBodies: !sim.smallBodies })} className={toggle(sim.smallBodies)}>
          <Asterisk size={15} />
        </button>
        <span className="text-[11px] text-muted">{file.meta.asteroids.toLocaleString("en-US")} {file.meta.asteroids === 1 ? "asteroid" : "asteroids"} · {file.meta.comets.toLocaleString("en-US")} {file.meta.comets === 1 ? "comet" : "comets"}</span>
        {sim.smallBodies && (
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find an asteroid or comet by name" placeholder="Find, e.g. Ceres"
            className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-3 py-1 text-xs placeholder:text-muted focus:border-cyan/50" />
        )}
      </div>
      {sim.smallBodies && bodies.some((b) => b.k === "c") && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <button type="button" aria-pressed={sim.tails} onClick={() => onChange({ tails: !sim.tails })}
            className={`rounded-full border px-2.5 py-1 ${sim.tails ? "border-cyan/60 text-ink" : "border-line hover:text-ink"}`}>
            Comet tails
          </button>
          <ProvenanceBadge kind="artistic" />
          <span>Tails point away from the Sun (real); length and the 3 au limit are display choices.</span>
        </div>
      )}
      {sim.smallBodies && featured && (
        <div className="mt-1 text-[11px] text-muted">
          <ul aria-label="Dwarf planets and large asteroids" className="flex flex-wrap items-center gap-1">
            {featured.found.map(({ spec, body }) => (
              <li key={body.id}>
                <button type="button" aria-pressed={sim.smallSel === body.id} onClick={() => onChange({ smallSel: body.id })} className={`rounded-full border px-2.5 py-1 text-[11px] hover:text-ink ${sim.smallSel === body.id ? "border-cyan/60 text-ink" : "border-line"}`}>
                  {spec.name}
                </button>
              </li>
            ))}
          </ul>
          {featured.missing.length > 0 && <p className="mt-1">Not in the built file: {featured.missing.map((m) => m.name).join(", ")}.</p>}
        </div>
      )}
      {sim.smallBodies && hits.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {hits.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => { onChange({ smallSel: b.id }); setText(""); }} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:border-cyan/60 hover:text-ink">{b.n}</button>
            </li>
          ))}
        </ul>
      )}
      {sim.smallBodies && sel && (
        <div className="mt-2 rounded-lg border border-line p-2 text-[11px] leading-relaxed text-muted">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink">{sel.n}</span>
            <button type="button" onClick={() => onChange({ smallSel: null })} className="text-[11px] underline underline-offset-4 hover:text-ink">Clear</button>
          </div>
          <p>
            {sel.k === "c" ? "Comet" : "Asteroid"} · {sel.per === null ? `perihelion ${fmtNum(sel.a * (1 - sel.e), "au", 3)}` : `semi-major axis ${fmtNum(sel.a, "au", 3)}`} · eccentricity {sel.e.toFixed(3)} · inclination {fmtNum(sel.i, "°", 3)} · {sel.per === null ? "no period (open orbit at the epoch)" : sel.per > 548 ? `period ${fmtNum(sel.per / 365.25, "years", 3)}` : `period ${fmtNum(sel.per, "days", 3)}`}
            {" · "}absolute magnitude {sel.H === null ? UNAVAILABLE : sel.H.toFixed(1)}{" · "}diameter {sel.d === null ? UNAVAILABLE : fmtNum(sel.d, "km", 3)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <ProvenanceBadge kind="estimated" />
            <span>Orbit shape is from JPL osculating elements (epoch {jdToDate(sel.ep)}).{sel.e > 1 ? " An eccentricity above 1 describes the orbit at that epoch only; it can change after a close planetary encounter. The path is drawn out to 60 au and compressed in distance." : ""} The marker moves along it with a two-body model, which drifts from the real place as the date moves away from the epoch.</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SolarControls({ sim, onChange, dateRef, readoutRef }: Props) {
  const [dateError, setDateError] = useState<string | null>(null);
  // On a phone only the play/speed row shows until the person opens the rest, so the object panel (bottom) is not covered by this one (top).
  const [more, setMore] = useState(false);
  const applyDate = (text: string) => {
    const ms = parseDateInput(text);
    if (ms === null || clockDaysFromDateInput(text) === null) {
      setDateError(`Pick a real date from ${CLOCK_MIN_DATE} to ${CLOCK_MAX_DATE}.`);
      return;
    }
    setDateError(null);
    onChange({ jump: { token: sim.jump.token + 1, ms }, limit: null });
  };
  return (
    <section
      aria-label="Simulation controls"
      className="glass pointer-events-auto absolute inset-x-4 top-32 z-30 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-2xl p-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:right-[26rem] sm:top-auto sm:max-h-[calc(100dvh-11rem)] sm:max-w-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={sim.paused ? "Play simulation" : "Pause simulation"}
            aria-pressed={sim.paused}
            onClick={() => onChange({ paused: !sim.paused, limit: null })}
            className="grid h-9 w-9 place-items-center rounded-full bg-ink text-void"
          >
            {sim.paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button type="button" aria-label="Run time backwards" aria-pressed={sim.reverse} onClick={() => onChange({ reverse: !sim.reverse, limit: null })} className={toggle(sim.reverse)}>
            <Rewind size={15} />
          </button>
          <div role="group" aria-label="Simulation speed" className="flex items-center gap-1">
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={sim.speedIdx === i}
                onClick={() => onChange({ speedIdx: i, paused: false })}
                className={`rounded-full px-2.5 py-1.5 font-mono text-[11px] transition ${
                  sim.speedIdx === i ? "bg-white/12 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" aria-label="Toggle orbit lines" aria-pressed={sim.orbits} onClick={() => onChange({ orbits: !sim.orbits })} className={toggle(sim.orbits)}>
            <Orbit size={15} />
          </button>
          <button type="button" aria-label="Toggle labels" aria-pressed={sim.labels} onClick={() => onChange({ labels: !sim.labels })} className={toggle(sim.labels)}>
            <Tag size={15} />
          </button>
          <button
            type="button"
            aria-label="Reset to today's date"
            onClick={() => onChange({ resetToken: sim.resetToken + 1 })}
            className={toggle(false)}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={more}
        aria-controls="solar-more-controls"
        onClick={() => setMore((v) => !v)}
        className="mt-2 w-full rounded-full border border-line px-3 py-1.5 text-[11px] text-muted hover:text-ink sm:hidden"
      >
        {more ? "Hide more controls" : "More controls, date and caveats"}
      </button>
      <div id="solar-more-controls" className={more ? "" : "max-sm:hidden"}>
      <SmallBodyBlock sim={sim} onChange={onChange} />

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-[11px] text-muted">
        <button type="button" aria-pressed={sim.atmospheres} onClick={() => onChange({ atmospheres: !sim.atmospheres })}
          className={`rounded-full border px-2.5 py-1 ${sim.atmospheres ? "border-cyan/60 text-ink" : "border-line hover:text-ink"}`}>
          Atmosphere glow
        </button>
        <ProvenanceBadge kind="artistic" />
        <span>Shown for Venus, Earth, Mars, the giant planets and Titan. Colour and thickness are artistic, not measured.</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <button type="button" aria-pressed={sim.ringShadows} onClick={() => onChange({ ringShadows: !sim.ringShadows })}
          className={`rounded-full border px-2.5 py-1 ${sim.ringShadows ? "border-cyan/60 text-ink" : "border-line hover:text-ink"}`}>
          Saturn ring shadows
        </button>
        <ProvenanceBadge kind="artistic" />
        <span>Computed from the drawn geometry with a point Sun. The ring size and the pole direction are simplified, so the season of the shadow is not the real one. No moon shadows or eclipses.</span>
      </div>

      <div className="mt-2 border-t border-line pt-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Schematic outer regions">
          <span className="mr-1 text-[11px] text-muted">Outer regions (schematic):</span>
          {REGIONS.map((r) => (
            <button key={r.id} type="button" aria-pressed={sim.regions[r.id]} onClick={() => onChange({ regions: { ...sim.regions, [r.id]: !sim.regions[r.id] } })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${sim.regions[r.id] ? "border-cyan/60 text-ink" : "border-line text-muted hover:text-ink"}`}>
              {r.name}
            </button>
          ))}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-muted">
          {REGIONS.some((r) => sim.regions[r.id] && r.kind === "artistic") && <ProvenanceBadge kind="artistic" />}
          {sim.regions.oort && <ProvenanceBadge kind="theoretical" />}
          <span>Random dots inside real extents, not real objects.{sim.regions.oort ? " Oort cloud distances are log-compressed." : ""}</span>
        </p>
        <details className="mt-1 text-[11px] text-muted">
          <summary className="cursor-pointer underline underline-offset-4 hover:text-ink">Extents, sources and caveats</summary>
          <ul className="mt-1 space-y-1.5">
            {REGIONS.map((r) => (
              <li key={r.id}>
                <span className="text-ink">{r.name}</span> ({r.rMinAu.toLocaleString("en-US")} to {r.rMaxAu.toLocaleString("en-US")} au drawn). {r.extent} {r.caveat} <span className="opacity-80">Source: {r.source}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        <span>
          Simulated date <span ref={dateRef} data-testid="sim-date" className="text-ink">—</span>
        </span>
        <span>{sim.reverse ? "−" : ""}{SPEEDS[sim.speedIdx]} days / second · not to scale</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <label htmlFor="sim-date">Jump to date (UTC)</label>
        <input id="sim-date" type="date" min={CLOCK_MIN_DATE} max={CLOCK_MAX_DATE} defaultValue=""
          onChange={(e) => e.target.value && applyDate(e.target.value)}
          className="rounded-full border border-line bg-transparent px-3 py-1 text-xs text-ink focus:border-cyan/50" />
        <span>valid {CLOCK_MIN_DATE.slice(0, 4)} to {CLOCK_MAX_DATE.slice(0, 4)}</span>
      </div>
      {dateError && <p role="alert" className="mt-1 text-[11px] text-[#ff9a8a]">{dateError}</p>}
      {sim.limit && (
        <p role="status" className="mt-1 text-[11px] text-[#ffd27a]">
          The clock stopped at {sim.limit === "start" ? CLOCK_MIN_DATE : CLOCK_MAX_DATE}: the planet elements are only valid from {CLOCK_MIN_DATE.slice(0, 4)} to {CLOCK_MAX_DATE.slice(0, 4)}. Press play to go the other way.
        </p>
      )}
      <p ref={readoutRef} aria-live="off" className="mt-1 min-h-[1rem] font-mono text-[10px] text-muted" />
      <p className="mt-2 hidden text-[11px] leading-relaxed text-muted sm:block">
        Not to scale: sizes and distances are compressed. Orbit shapes and tilts are real JPL values; planet positions follow JPL&apos;s approximate method (1800 to 2050), moon positions along their orbits are illustrative. Body spin uses the real rotation period and follows the simulated time; at speeds where a spin would flicker it is left still.
      </p>
      </div>
    </section>
  );
}
