"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ProvenanceBadge from "./ProvenanceBadge";
import { MISSIONS } from "@/data/missions";
import { getObject } from "@/services/catalogue";
import { elapsedSince, formatDuration, formatElapsed, lightTimeHours } from "@/utils/missions";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const subscribeNever = () => () => {};

export default function MissionsShell() {
  // "Today" (UTC date) is read in the browser only: the server snapshot is null, so the server HTML and first client render agree.
  const today = useSyncExternalStore(subscribeNever, () => new Date().toISOString().slice(0, 10), () => null);
  const now = today ? new Date(today + "T00:00:00Z") : null;
  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Missions</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        The {MISSIONS.length} spacecraft in the BEYOND catalogue, oldest first, with facts taken from the NASA pages listed on each card. Two things are calculated here and say so: time since launch, and how long a radio signal needs to cross a distance NASA has stated. No spacecraft position is drawn or predicted: trajectories need JPL Horizons data that is not in this project.
      </p>
      <ol className="mt-8 space-y-5">
        {[...MISSIONS].sort((a, b) => a.launch.localeCompare(b.launch)).map((m) => {
          const o = getObject(m.id);
          if (!o) return null;
          const e = now ? elapsedSince(m, now) : null;
          const lt = m.distance ? lightTimeHours(m.distance.au) : null;
          return (
            <li key={m.id} id={`mission-${m.id}`} data-testid={`mission-${m.id}`} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">{o.name}</h2>
                <Link href={`/explore?object=${m.id}`} prefetch={false} className="text-xs text-cyan underline-offset-4 hover:underline">Open in Explore</Link>
              </div>
              <p className="mt-2 text-sm text-muted">{o.summary}</p>
              <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{m.launchKind === "launch" ? "Launch" : "Start"}</dt>
                  <dd className="text-right">{o.discovery}<span className="mt-1 flex justify-end"><ProvenanceBadge kind="observed" /></span></dd>
                </div>
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{m.launchKind === "launch" ? "Time since launch" : "Time since it began"}</dt>
                  <dd className="text-right" data-testid={`elapsed-${m.id}`}>
                    {e ? formatElapsed(e) : "…"}
                    <span className="mt-1 flex flex-col items-end gap-1"><ProvenanceBadge kind="estimated" /><span className="text-[11px] text-muted">calculated from the date above to today (UTC){e?.approx ? "; the source gives only a month or year, so whole years" : ""}</span></span>
                  </dd>
                </div>
                {m.distance && lt !== null && (
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted">Signal time one way</dt>
                    <dd className="text-right" data-testid={`light-${m.id}`}>
                      {formatDuration(lt)} <span className="text-muted">as of {fmtDate(m.distance.asOf)}</span>
                      <span className="mt-1 flex flex-col items-end gap-1"><ProvenanceBadge kind="estimated" /><span className="text-[11px] text-muted">{m.distance.au} au{m.distance.rounded ? " (NASA's rounded figure)" : ""} from the {m.distance.from} divided by the speed of light. A date in the past: the spacecraft has moved since, and the Earth-spacecraft distance changes as the Earth orbits.</span></span>
                    </dd>
                  </div>
                )}
              </dl>
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {o.sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">{s.label}</a></li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
