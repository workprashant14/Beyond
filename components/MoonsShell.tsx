"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ProvenanceBadge from "./ProvenanceBadge";
import { fmtVal, formatMass, massKg, type Moon, type Val } from "@/utils/moons";
import { loadMoons } from "@/utils/moonData";
import { UNAVAILABLE } from "@/utils/format";

const PARENTS = ["All", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
type SortKey = "radius" | "name";
const SOURCE = "https://ssd.jpl.nasa.gov/sats/phys_par/";

const chip = (on: boolean) =>
  `glass rounded-full px-3.5 py-1.5 text-xs transition hover:border-cyan/60 ${on ? "!border-cyan/70 text-cyan" : "text-muted"}`;

/** Detail rows: a value with a stated uncertainty is a measurement; one without is adopted by the source table. */
function Detail({ m }: { m: Moon }) {
  const kindOf = (v: Val | null) => (v && v.u !== undefined ? "observed" : "estimated");
  const rows: { k: string; v: string | null; kind: "observed" | "estimated"; note?: string }[] = [
    { k: "Mean radius", v: fmtVal(m.r, "km"), kind: kindOf(m.r) },
    { k: "Density", v: fmtVal(m.d, "g/cm³"), kind: kindOf(m.d) },
    { k: "GM", v: fmtVal(m.g, "km³/s²"), kind: kindOf(m.g) },
    { k: "Mass", v: m.g ? formatMass(massKg(m.g.v)) : null, kind: "estimated", note: "calculated as GM ÷ G" },
    { k: "Apparent magnitude", v: m.m ? `${m.m.v}${m.m.u !== undefined ? ` ± ${m.m.u}` : ""} (${m.m.b} band)` : null, kind: kindOf(m.m) },
    { k: "Geometric albedo", v: fmtVal(m.a), kind: kindOf(m.a) },
  ];
  return (
    <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
          <dt className="text-muted">{r.k}</dt>
          <dd className="text-right">
            <span className={r.v ? "text-ink" : "text-muted"}>{r.v ?? UNAVAILABLE}</span>
            {r.v && (
              <span className="mt-1 flex flex-col items-end gap-1">
                <ProvenanceBadge kind={r.kind} />
                {r.note && <span className="text-[11px] text-muted">{r.note}</span>}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function MoonsShell() {
  const router = useRouter();
  const params = useSearchParams();
  const [moons, setMoons] = useState<Moon[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [parent, setParent] = useState<(typeof PARENTS)[number]>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("radius");
  const open = params.get("m");

  useEffect(() => {
    let alive = true;
    loadMoons().then((m) => alive && setMoons(m)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  // A deep link such as /moons?m=Titan shows that moon even if the filters would hide it, and scrolls to it.
  const target = moons && open ? moons.find((m) => m.n === open) : undefined;
  useEffect(() => {
    if (target) document.getElementById(`moon-${target.n}`)?.scrollIntoView({ block: "center" });
  }, [target]);

  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    const out = (moons ?? []).filter((m) => (parent === "All" || m.p === parent) && (!f || m.n.toLowerCase().includes(f)));
    out.sort((a, b) => (sort === "name" ? a.n.localeCompare(b.n) : (b.r?.v ?? 0) - (a.r?.v ?? 0)));
    return target && !out.includes(target) ? [target, ...out] : out;
  }, [moons, parent, q, sort, target]);

  const toggle = (m: Moon) => router.replace(open === m.n ? "/moons" : `/moons?m=${encodeURIComponent(m.n)}`, { scroll: false });

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Moons Atlas</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        {moons ? moons.length : "177"} natural satellites of Earth, Mars, the giant planets and Pluto, with their physical parameters from the NASA/JPL satellite table.
        A value shown with “±” is a measurement with its uncertainty. A value without one is adopted or assumed by the source, so it is labelled Estimated.
        Orbits are not included in this catalogue, so no moon positions are drawn here.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by parent body">
        {PARENTS.map((p) => (
          <button key={p} type="button" aria-pressed={parent === p} onClick={() => setParent(p)} className={chip(parent === p)}>{p}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search moons by name" placeholder="Search moons, e.g. Titan"
          className="w-64 rounded-full border border-line bg-transparent px-4 py-2 text-sm placeholder:text-muted/70 focus:border-cyan/50" />
        <label className="flex items-center gap-2 text-xs text-muted">Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
            <option value="radius">Radius, largest first</option>
            <option value="name">Name</option>
          </select>
        </label>
        <span className="text-xs text-muted" aria-live="polite">{moons ? `${list.length} shown` : ""}</span>
      </div>

      {failed ? (
        <p role="alert" className="mt-10 text-sm text-muted">The moon catalogue could not be loaded. Reload the page to try again.</p>
      ) : !moons ? (
        <p className="eyebrow mt-10">Loading moons…</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {list.map((m) => {
            const isOpen = open === m.n;
            return (
              <li key={`${m.p}-${m.n}`} id={`moon-${m.n}`}>
                <button type="button" onClick={() => toggle(m)} aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5">
                  <span>
                    <span className="text-base text-ink">{m.n}</span>
                    <span className="ml-3 text-xs text-muted">{m.p}</span>
                  </span>
                  <span className="text-xs text-muted">{m.r ? `radius ${m.r.v.toLocaleString("en-US")} km` : UNAVAILABLE}</span>
                </button>
                {isOpen && (
                  <div className="px-2 pb-5">
                    <Detail m={m} />
                    <p className="mt-3 text-xs text-muted">
                      Source: <a className="underline hover:text-ink" href={SOURCE} target="_blank" rel="noreferrer">NASA/JPL planetary satellite physical parameters</a>, via the MIT-licensed devstronomy/nasa-data-scraper.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
          {list.length === 0 && <li className="px-2 py-6 text-sm text-muted">No moon matches “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}
