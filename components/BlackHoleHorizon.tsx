import ProvenanceBadge from "./ProvenanceBadge";
import { BLACK_HOLE_MASSES } from "@/data/blackHoles";
import { compareSize, formatLength, horizon } from "@/utils/schwarzschild";

/** Event-horizon size of a catalogued black hole: computed from the published mass with r = 2GM/c², not measured. */
export default function BlackHoleHorizon({ id }: { id: string }) {
  const m = BLACK_HOLE_MASSES[id];
  if (!m) return null;
  const h = horizon(m.mass, m.plusMinus);
  return (
    <section data-testid="bh-horizon" aria-label="Event horizon size" className="mt-4 rounded-lg border border-line px-3 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="eyebrow !text-[0.62rem]">Event horizon (if not spinning)</h3>
        <ProvenanceBadge kind="estimated" />
      </div>
      <p className="mt-2 text-ink">
        Radius <strong>{formatLength(h.rKm)}</strong>
        {formatLength(h.lowKm) === formatLength(h.highKm)
          ? `, uncertainty about ±${((m.plusMinus / m.mass) * 100).toPrecision(1)}% from the mass uncertainty.`
          : `, from ${formatLength(h.lowKm)} to ${formatLength(h.highKm)} across the mass uncertainty.`}
      </p>
      <p className="mt-1 text-muted">That is {compareSize(h.rKm)}.</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Computed as r = 2GM/c² from the published mass ({m.massText}; {m.uncertaintyNote}). A spinning black hole has a smaller horizon, between half this and the full value, and spin is not used here.{" "}
        <a href={m.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">Mass source</a>.
      </p>
    </section>
  );
}
