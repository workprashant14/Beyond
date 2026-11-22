"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ProvenanceBadge from "./ProvenanceBadge";
import { fmtNum } from "@/utils/exoplanets";
import { KPC_TO_LY, MSP_SECONDS, queryPulsars, type PsrQuery, type Pulsar } from "@/utils/pulsars";
import { UNAVAILABLE } from "@/utils/format";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ok"; pulsars: Pulsar[] };
const PAGE = 100;
const CATALOGUE = "https://www.atnf.csiro.au/research/pulsar/psrcat/";

const fmtPeriod = (s: number | null) => (s === null ? null : s < 1 ? `${fmtNum(s * 1000, "ms", 4)}` : fmtNum(s, "s", 4));

function Detail({ x }: { x: Pulsar }) {
  const rows: { k: string; v: string | null; kind?: "observed" | "estimated"; note?: string }[] = [
    { k: "Other name", v: x.b },
    { k: "Rotation period", v: fmtPeriod(x.p), kind: "observed", note: "barycentric period, as catalogued" },
    { k: "Dispersion measure", v: fmtNum(x.dm, "cm⁻³ pc", 4), kind: "observed" },
    {
      k: "Distance",
      v: x.d === null ? null : `${fmtNum(x.d, "kpc")} (about ${fmtNum(x.d * KPC_TO_LY, "light-years", 3)})`,
      kind: "estimated",
      note: "the catalogue's best estimate: a measured parallax when there is one, otherwise a model distance from the dispersion measure; the file does not say which",
    },
    { k: "Position (J2000)", v: x.ra === null || x.dec === null ? null : `RA ${x.ra.toFixed(4)}°, Dec ${x.dec.toFixed(4)}°`, kind: "observed" },
    { k: "Class", v: x.p === null ? null : x.p < MSP_SECONDS ? "Millisecond pulsar (period under 30 ms)" : "Slower pulsar (period 30 ms or more)", kind: "estimated", note: "the 30 ms cut is a common convention, not a catalogue field" },
  ];
  return (
    <div>
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
      <p className="mt-3 text-xs text-muted">
        Source: <a className="underline hover:text-ink" href={CATALOGUE} target="_blank" rel="noreferrer">ATNF Pulsar Catalogue</a> (Manchester, Hobbs, Teoh &amp; Hobbs 2005, AJ 129, 1993). A pulsar is a spinning neutron star; none is photographed here.
      </p>
    </div>
  );
}

export default function PulsarShell() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("pulsar");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [q, setQ] = useState<PsrQuery>({ text: "", kind: "", sort: "period" });
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    fetch("/pulsars/pulsars.json")
      .then(async (r) => {
        if (r.status === 404) return alive && setLoad({ state: "missing" });
        if (!r.ok) throw new Error(String(r.status));
        const pulsars = (await r.json()) as Pulsar[];
        if (alive) setLoad({ state: "ok", pulsars });
      })
      .catch(() => alive && setLoad({ state: "error" }));
    return () => { alive = false; };
  }, []);

  const pulsars = load.state === "ok" ? load.pulsars : null;
  const list = useMemo(() => (pulsars ? queryPulsars(pulsars, q) : []), [pulsars, q]);
  const target = pulsars && open ? pulsars.find((p) => p.n === open) : undefined;
  useEffect(() => { if (target) document.getElementById(`psr-${target.n}`)?.scrollIntoView({ block: "center" }); }, [target]);
  const visible = useMemo(() => {
    const v = list.slice(0, shown);
    return target && !v.includes(target) ? [target, ...v] : v;
  }, [list, shown, target]);

  const update = (next: Partial<PsrQuery>) => { setQ((s) => ({ ...s, ...next })); setShown(PAGE); };
  const toggle = (x: Pulsar) => router.replace(open === x.n ? "/pulsars" : `/pulsars?pulsar=${encodeURIComponent(x.n)}`, { scroll: false });

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Pulsar Atlas</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Spinning neutron stars from the ATNF Pulsar Catalogue. Period and dispersion measure are catalogue measurements; distances are the catalogue&apos;s best estimates. Pulsars are not imaged, so nothing here is a picture.
      </p>

      {load.state === "loading" && <p className="eyebrow mt-10">Loading pulsars…</p>}
      {load.state === "error" && <p role="alert" className="mt-10 text-sm text-muted">The pulsar file could not be loaded. Reload the page to try again.</p>}
      {load.state === "missing" && (
        <section className="glass mt-10 rounded-2xl p-6" aria-labelledby="psr-missing">
          <h2 id="psr-missing" className="text-lg font-medium">The pulsar data has not been built yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            BEYOND does not ship numbers it could not verify. On the <a className="underline hover:text-ink" href={CATALOGUE} target="_blank" rel="noreferrer">ATNF catalogue page</a> tick Name, JName, RAJD, DecJD, P0, DM and DIST, choose &ldquo;short csv without errors&rdquo;, save the result as psrcat.csv, then run this once on your own computer:
          </p>
          <pre tabIndex={0} aria-label="Command to run" className="mt-3 overflow-x-auto rounded-lg border border-line px-3 py-2 text-xs text-ink"><code>npm run build:pulsars -- --file psrcat.csv</code></pre>
          <p className="mt-3 text-sm text-muted">Then reload this page. Meanwhile, three compact objects are in the <Link href="/explore" prefetch={false} className="underline hover:text-ink">main catalogue</Link>.</p>
        </section>
      )}

      {pulsars && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input type="search" value={q.text} onChange={(e) => update({ text: e.target.value })} aria-label="Search pulsars by name" placeholder="Search name, e.g. J0534+2200"
              className="w-72 rounded-full border border-line bg-transparent px-4 py-2 text-sm placeholder:text-muted focus:border-cyan/50" />
            <label className="flex items-center gap-2 text-xs text-muted">Class
              <select value={q.kind} onChange={(e) => update({ kind: e.target.value as PsrQuery["kind"] })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
                <option value="">All pulsars</option>
                <option value="msp">Millisecond (under 30 ms)</option>
                <option value="slow">Slower (30 ms or more)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">Sort by
              <select value={q.sort} onChange={(e) => update({ sort: e.target.value as PsrQuery["sort"] })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
                <option value="period">Fastest spin</option>
                <option value="distance">Nearest first</option>
                <option value="name">Name</option>
              </select>
            </label>
            <span className="text-xs text-muted" aria-live="polite">{list.length.toLocaleString("en-US")} of {pulsars.length.toLocaleString("en-US")} pulsars</span>
          </div>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {visible.map((x) => {
              const isOpen = open === x.n;
              return (
                <li key={x.n} id={`psr-${x.n}`}>
                  <button type="button" onClick={() => toggle(x)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5">
                    <span><span className="text-base text-ink">PSR {x.n}</span>{x.b && <span className="ml-3 text-xs text-muted">{x.b}</span>}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtPeriod(x.p) ?? UNAVAILABLE}</span>
                  </button>
                  {isOpen && <div className="px-2 pb-5"><Detail x={x} /></div>}
                </li>
              );
            })}
            {list.length === 0 && <li className="px-2 py-6 text-sm text-muted">No pulsar matches these filters.</li>}
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
