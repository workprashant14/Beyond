"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ExoSystemDiagram from "./ExoSystemDiagram";
import ProvenanceBadge from "./ProvenanceBadge";
import { CONTROVERSY_TEXT, distanceLy, fmtExact, fmtNum, fmtSigned, paramBadge, paramDetail, queryExo, type ExoQuery, type Exoplanet, type ParamKey } from "@/utils/exoplanets";
import { UNAVAILABLE } from "@/utils/format";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ok"; planets: Exoplanet[] };
const PAGE = 100;
const ARCHIVE = "https://exoplanetarchive.ipac.caltech.edu/";

const PARAMS: { key: ParamKey; label: string; unit: string; model?: boolean }[] = [
  { key: "p", label: "Orbital period", unit: "days" },
  { key: "a", label: "Orbit size (semi-major axis)", unit: "au" },
  { key: "r", label: "Radius", unit: "Earth radii" },
  { key: "ms", label: "Mass", unit: "Earth masses" },
  { key: "t", label: "Equilibrium temperature", unit: "K", model: true },
];

/** Value, uncertainty, limit meaning, mass type and the parameter's own reference. Detail lines appear only for datasets built with that detail. */
function Measurements({ x }: { x: Exoplanet }) {
  const hasDetail = !!x.u || x.mp !== undefined;
  return (
    <section className="mt-4" aria-label="Planet measurements">
      <p className="eyebrow !text-[0.62rem]">Planet measurements</p>
      <dl>
        {PARAMS.map(({ key, label, unit, model }) => {
          const d = paramDetail(x, key);
          const noUnc = d.upper === null && d.lower === null;
          const upper = d.limit === "upper";
          const value = d.value === null ? null : `${upper ? "< " : ""}${fmtExact(d.value)} ${unit}`;
          const badge = paramBadge(d, !!model);
          return (
            <div key={key} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-2 text-sm">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right">
                <span className={value ? "text-ink" : "text-muted"}>{value ?? UNAVAILABLE}</span>
                {upper && <span className="ml-2 text-[11px] text-muted">upper limit, not a measured value</span>}
              </dd>
              {value && (
                <dd className="col-span-2 mt-1 flex flex-col items-end gap-1 text-right text-[11px] text-muted">
                  {badge && <ProvenanceBadge kind={badge} />}
                  {d.limit === "unverified" && <span>Archive limit flag {d.rawLimit}: its meaning is not verified here, so this is not shown as a plain measurement.</span>}
                  {hasDetail && !upper && (
                    <span>
                      {noUnc ? "No uncertainty given." : `Uncertainty ${d.upper !== null ? fmtSigned(d.upper) : "upper not given"} / ${d.lower !== null ? fmtSigned(d.lower) : "lower not given"} ${unit}.`}
                    </span>
                  )}
                  {key === "ms" && x.mp && <span>Mass type (archive): {x.mp}.</span>}
                  {key === "t" && <span>Calculated from the star and orbit; not a measured surface temperature.</span>}
                  {hasDetail && (
                    <span>
                      {d.origin === "calculated" ? "Calculated by the archive (not a publication)." : d.ref ? (
                        <>Reference: {d.ref.u ? <a className="underline hover:text-ink" href={d.ref.u} target="_blank" rel="noopener noreferrer">{d.ref.l}</a> : d.ref.l}</>
                      ) : "Reference not recorded for this value."}
                    </span>
                  )}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function Detail({ x, siblings }: { x: Exoplanet; siblings: Exoplanet[] }) {
  const ly = distanceLy(x.d);
  const rows: { k: string; v: string | null; kind?: "observed" | "estimated"; note?: string }[] = [
    { k: "Host star", v: x.h },
    { k: "Discovery", v: x.m ? `${x.m}${x.y ? `, ${x.y}` : ""}` : x.y ? String(x.y) : null, kind: "observed" },
    { k: "Distance", v: x.d === null ? null : `${fmtNum(x.d, "parsecs")} (about ${fmtNum(ly, "light-years", 3)})`, kind: "observed", note: "light-years converted from parsecs" },
    { k: "Host spectral type", v: x.sp, kind: "observed" },
    { k: "Host temperature", v: fmtNum(x.te, "K", 4), kind: "observed" },
    { k: "Planets in system", v: x.np === null ? null : String(x.np), kind: "observed" },
  ];
  return (
    <div>
      {x.c === 1 && <p className="mb-2 rounded-lg border border-line px-3 py-2 text-xs text-muted">{CONTROVERSY_TEXT}</p>}
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
            <dt className="text-muted">{r.k}</dt>
            <dd className="text-right">
              <span className={r.v ? "text-ink" : "text-muted"}>{r.v ?? UNAVAILABLE}</span>
              {r.v && r.kind && (
                <span className="mt-1 flex flex-col items-end gap-1">
                  <ProvenanceBadge kind={r.kind} />
                  {r.note && <span className="text-[11px] text-muted">{r.note}</span>}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <Measurements x={x} />
      <ExoSystemDiagram planets={siblings} selected={x.n} />
      <p className="mt-3 text-xs text-muted">
        Source: <a className="underline hover:text-ink" href={ARCHIVE} target="_blank" rel="noreferrer">NASA Exoplanet Archive</a>, composite parameters table. The archive picks each value separately, so one planet&apos;s values can come from different publications; the reference shown under a value is that value&apos;s own. The planet itself is not drawn: no image of it exists.
      </p>
    </div>
  );
}

export default function ExoShell() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("planet");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [q, setQ] = useState<ExoQuery>({ text: "", method: "", sort: "year" });
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    fetch("/exoplanets/planets.json")
      .then(async (r) => {
        if (r.status === 404) return alive && setLoad({ state: "missing" });
        if (!r.ok) throw new Error(String(r.status));
        const planets = (await r.json()) as Exoplanet[];
        if (alive) setLoad({ state: "ok", planets });
      })
      .catch(() => alive && setLoad({ state: "error" }));
    return () => { alive = false; };
  }, []);

  const planets = load.state === "ok" ? load.planets : null;
  const methods = useMemo(() => [...new Set((planets ?? []).map((p) => p.m).filter((m): m is string => !!m))].sort(), [planets]);
  const list = useMemo(() => (planets ? queryExo(planets, q) : []), [planets, q]);
  const target = planets && open ? planets.find((p) => p.n === open) : undefined;
  useEffect(() => { if (target) document.getElementById(`exo-${target.n}`)?.scrollIntoView({ block: "center" }); }, [target]);
  const visible = useMemo(() => {
    const v = list.slice(0, shown);
    return target && !v.includes(target) ? [target, ...v] : v;
  }, [list, shown, target]);

  const update = (next: Partial<ExoQuery>) => { setQ((s) => ({ ...s, ...next })); setShown(PAGE); };
  const toggle = (x: Exoplanet) => router.replace(open === x.n ? "/exoplanets" : `/exoplanets?planet=${encodeURIComponent(x.n)}`, { scroll: false });

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Exoplanet Atlas</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Confirmed planets around other stars, from the NASA Exoplanet Archive. Values are catalogue measurements; equilibrium temperature is calculated. Exoplanets are never photographed in detail, so nothing here is a picture of the planet.
      </p>

      {load.state === "loading" && <p className="eyebrow mt-10">Loading exoplanets…</p>}
      {load.state === "error" && <p role="alert" className="mt-10 text-sm text-muted">The exoplanet file could not be loaded. Reload the page to try again.</p>}
      {load.state === "missing" && (
        <section className="glass mt-10 rounded-2xl p-6" aria-labelledby="exo-missing">
          <h2 id="exo-missing" className="text-lg font-medium">The exoplanet data has not been built yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            BEYOND does not ship exoplanet numbers it could not verify. To download the current NASA Exoplanet Archive table into this site, run this once on your own computer (it needs internet):
          </p>
          <pre tabIndex={0} aria-label="Command to run" className="mt-3 overflow-x-auto rounded-lg border border-line px-3 py-2 text-xs text-ink"><code>npm run build:exoplanets</code></pre>
          <p className="mt-3 text-sm text-muted">Then reload this page. Meanwhile, three exoplanets are in the <Link href="/explore" prefetch={false} className="underline hover:text-ink">main catalogue</Link>.</p>
        </section>
      )}

      {planets && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input type="search" value={q.text} onChange={(e) => update({ text: e.target.value })} aria-label="Search planets and host stars" placeholder="Search planet or star, e.g. Kepler-22"
              className="w-72 rounded-full border border-line bg-transparent px-4 py-2 text-sm placeholder:text-muted/70 focus:border-cyan/50" />
            <label className="flex items-center gap-2 text-xs text-muted">Method
              <select value={q.method} onChange={(e) => update({ method: e.target.value })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
                <option value="">All methods</option>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">Sort by
              <select value={q.sort} onChange={(e) => update({ sort: e.target.value as ExoQuery["sort"] })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
                <option value="year">Newest discovery</option>
                <option value="distance">Nearest first</option>
                <option value="radius">Largest radius</option>
                <option value="name">Name</option>
              </select>
            </label>
            <span className="text-xs text-muted" aria-live="polite">{list.length.toLocaleString("en-US")} of {planets.length.toLocaleString("en-US")} planets</span>
          </div>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {visible.map((x) => {
              const isOpen = open === x.n;
              return (
                <li key={x.n} id={`exo-${x.n}`}>
                  <button type="button" onClick={() => toggle(x)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5">
                    <span><span className="text-base text-ink">{x.n}</span><span className="ml-3 text-xs text-muted">{x.m ?? UNAVAILABLE}{x.y ? ` · ${x.y}` : ""}</span></span>
                    <span className="shrink-0 text-xs text-muted">{x.d === null ? UNAVAILABLE : `${fmtNum(distanceLy(x.d), "ly", 3)}`}</span>
                  </button>
                  {isOpen && <div className="px-2 pb-5"><Detail x={x} siblings={planets.filter((q) => q.h === x.h)} /></div>}
                </li>
              );
            })}
            {list.length === 0 && <li className="px-2 py-6 text-sm text-muted">No planet matches these filters.</li>}
          </ul>
          {list.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-4 rounded-full border border-line px-5 py-2 text-sm hover:border-cyan/60">
              Show {Math.min(PAGE, list.length - shown)} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
