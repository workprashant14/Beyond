"use client";

import TextureCredit from "./TextureCredit";
import Link from "next/link";
import { X } from "lucide-react";
import { CATEGORY_LABEL, type CelestialObject } from "@/types/celestial";
import { getRelated } from "@/services/catalogue";
import { orUnavailable } from "@/utils/format";
import LiveDataSection from "./LiveDataSection";
import BlackHoleHorizon from "./BlackHoleHorizon";

/** Categories where mass and rotation period are meaningful rows. */
const PHYSICAL = new Set(["star", "planet", "moon", "dwarf-planet", "asteroid", "pulsar"]);
/** Categories where composition is meaningful (adds comets). */
// Entries documented only from NASA text: rows without a value are hidden instead of repeating "Data unavailable".
const SPARSE = new Set(["region", "spacecraft", "pulsar", "quasar"]);
const MADE_OF = new Set(["star", "planet", "moon", "dwarf-planet", "asteroid", "comet", "region", "pulsar"]);

export default function ObjectInfoPanel({
  obj,
  requestedId,
  inScene,
  basePath = "/explore",
  closeHref,
  onClose,
  note,
  actions,
}: {
  /** When set, X only hides the panel (no navigation) and the panel sits below the selector row. */
  onClose?: () => void;
  obj: CelestialObject | undefined;
  requestedId: string;
  inScene: boolean;
  /** Route that related-object links point to (e.g. /explore or /map). */
  basePath?: string;
  closeHref?: string;
  /** Overrides the default honesty note under the data rows. */
  note?: string;
  /** Extra buttons shown under the title (e.g. "Open in 3D"). */
  actions?: React.ReactNode;
}) {
  return (
    <aside
      aria-label="Object information"
      className={`glass absolute bottom-0 right-0 top-auto z-20 max-h-[65svh] w-full overflow-y-auto rounded-t-2xl p-6 sm:bottom-6 sm:right-6 sm:max-h-none sm:w-96 sm:rounded-2xl ${
        // Below the object-selector row (nav at top-24, ~3rem tall incl. a scrollbar) when the shell owns that row.
        onClose ? "sm:top-[9.5rem]" : "sm:top-24"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="eyebrow !text-[0.62rem]">{obj ? CATEGORY_LABEL[obj.category] : "Not found"}</span>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close panel" className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        ) : (
          <Link href={closeHref ?? basePath} aria-label="Close panel" className="text-muted hover:text-ink">
            <X size={18} />
          </Link>
        )}
      </div>

      {!obj ? (
        <p className="mt-4 text-sm text-muted">“{requestedId}” is not in the catalogue yet.</p>
      ) : (
        <>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{obj.name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{obj.summary}</p>
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}

          <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
            {[
              ["Diameter", obj.diameter],
              ...((PHYSICAL.has(obj.category) || obj.mass) ? [["Mass", obj.mass]] : []),
              ["Distance", obj.distance],
              ...(PHYSICAL.has(obj.category) ? [["Rotation period", obj.rotationPeriod]] : []),
              ["Orbital period", obj.orbitalPeriod],
              ...(PHYSICAL.has(obj.category) ? [["Temperature", obj.temperature]] : []),
              ...(MADE_OF.has(obj.category) ? [["Composition", obj.composition]] : []),
              [obj.category === "spacecraft" ? "Launch" : "Discovery", obj.discovery],
            ]
              // Regions and spacecraft have no diameter, rotation or temperature: hide rows that would only say "Data unavailable".
              .filter(([k, v]) => !SPARSE.has(obj.category) || v || k === "Distance")
              .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className={`text-right ${v ? "text-ink" : "text-muted"}`}>{orUnavailable(v)}</dd>
              </div>
            ))}
          </dl>

          {obj.category === "black-hole" && <BlackHoleHorizon id={obj.id} />}

          <p className="mt-4 rounded-lg border border-line px-3 py-2 text-xs leading-relaxed text-muted">
            {note ??
              obj.caveat ??
              (inScene
              ? "Its look in the 3D view is an artistic visualization (unless a NASA surface image is credited below), not to scale. Orbit shape and tilt are real JPL elements; planet positions follow JPL's approximate method, moon positions along their orbits are illustrative."
              : "No 3D model for this object yet — it arrives in a later phase. Data above is from the catalogue.")}
          </p>

          {inScene && <TextureCredit id={obj.id} />}

          <LiveDataSection id={obj.id} />

          {getRelated(obj).length > 0 && (
            <div className="mt-6">
              <h3 className="eyebrow !text-[0.62rem]">Related</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {getRelated(obj).map((r) => (
                  <Link
                    key={r.id}
                    href={`${basePath}?object=${r.id}`}
                    className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60"
                  >
                    {r.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="eyebrow !text-[0.62rem]">Sources</h3>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {obj.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
