import { systemLayout, CENTER, VIEW } from "@/utils/exoSystem";
import type { Exoplanet } from "@/utils/exoplanets";
import ProvenanceBadge from "./ProvenanceBadge";

/** Top-down schematic of one system from catalogue semi-major axes (log scale). Positions on the orbits and orbit shapes are NOT known. */
export default function ExoSystemDiagram({ planets, selected }: { planets: Exoplanet[]; selected: string }) {
  const L = systemLayout(planets, selected);
  if (L.placed.length === 0) {
    return <p data-testid="exo-system" className="mt-4 text-xs text-muted">No planet of {L.host} has an orbit size in the catalogue, so no system diagram can be drawn.</p>;
  }
  const summary = `${L.host}: ${L.placed.map((p) => `${p.name} at ${p.au} au`).join(", ")}.`;
  return (
    <section data-testid="exo-system" aria-label={`System diagram of ${L.host}`} className="mt-4 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="eyebrow !text-[0.62rem]">System diagram ({L.placed.length} planet{L.placed.length === 1 ? "" : "s"} with an orbit size)</h3>
        <ProvenanceBadge kind="artistic" />
      </div>
      <svg role="img" aria-label={summary} viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto mt-3 w-full max-w-sm">
        {L.refRings.map((r) => (
          <g key={r.au}>
            <circle cx={CENTER} cy={CENTER} r={r.r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeDasharray="2 4" className="text-muted" />
            <text x={CENTER + 3} y={CENTER - r.r - 2} fontSize="8" className="fill-muted">{r.label}</text>
          </g>
        ))}
        <circle cx={CENTER} cy={CENTER} r={4} className="fill-ink" />
        {L.placed.map((p) => (
          <g key={p.name}>
            <circle cx={CENTER} cy={CENTER} r={p.r} fill="none" strokeWidth={p.selected ? 1.6 : 0.8} className={p.selected ? "stroke-cyan" : "stroke-muted"} strokeOpacity={p.selected ? 1 : 0.55} />
            <circle cx={p.x} cy={p.y} r={p.dot} fill={p.sizeKnown ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.2} className={p.selected ? "text-cyan" : "text-ink"} />
          </g>
        ))}
      </svg>
      <ul className="mt-2 grid gap-x-6 text-xs text-muted sm:grid-cols-2">
        {L.placed.map((p) => (
          <li key={p.name} className={p.selected ? "text-ink" : undefined}>
            {p.name}: {p.au} au{p.clamped ? " (off the drawn scale, drawn at its edge)" : ""}{p.sizeKnown ? "" : " · size not in catalogue (hollow dot)"}
          </li>
        ))}
      </ul>
      {L.noOrbit.length > 0 && <p className="mt-2 text-xs text-muted">No orbit size in the catalogue, not drawn: {L.noOrbit.join(", ")}.</p>}
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Orbit sizes are the catalogue&apos;s semi-major axes on a log scale (dashed rings: 0.1, 1 and 10 au). Orbits are drawn as circles because eccentricity is not in the bundled data, and where each planet sits on its orbit is not known (dots are spread out only so they do not overlap). Dot size grows slowly with planet radius and is not to scale; the star is not to scale.
      </p>
    </section>
  );
}
