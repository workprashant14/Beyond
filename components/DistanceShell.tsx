"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import Logo from "./Logo";
import ProvenanceBadge from "./ProvenanceBadge";
import { getObject } from "@/services/catalogue";
import {
  SEP_BODIES, MIN_YEAR, MAX_YEAR, isSepBody, separation, distanceSeries, formatLightTime, type SepBody,
} from "@/utils/separation";

const name = (id: string) => getObject(id)?.name ?? id;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s: string | null): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && iso(d) === s ? d : null;
};
const nf = (x: number, digits: number) => x.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

function Picker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink">
        {SEP_BODIES.map((id) => <option key={id} value={id}>{name(id)}</option>)}
      </select>
    </label>
  );
}

function Chart({ pts }: { pts: { t: Date; au: number }[] }) {
  const W = 640, H = 160, P = 8;
  const lo = Math.min(...pts.map((p) => p.au)), hi = Math.max(...pts.map((p) => p.au));
  const span = hi - lo || 1;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${(P + (i / Math.max(1, pts.length - 1)) * (W - 2 * P)).toFixed(1)},${(H - P - ((p.au - lo) / span) * (H - 2 * P)).toFixed(1)}`).join(" ");
  const min = pts.reduce((m, p) => (p.au < m.au ? p : m)), max = pts.reduce((m, p) => (p.au > m.au ? p : m));
  return (
    <figure className="mt-8">
      <figcaption className="eyebrow !text-[0.62rem]">The next {pts.length - 1} days</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Distance over time: closest ${nf(min.au, 3)} au on ${iso(min.t)}, farthest ${nf(max.au, 3)} au on ${iso(max.t)}`} className="mt-3 w-full text-cyan">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="mt-2 text-xs text-muted">
        Closest in this window: {nf(min.au, 3)} au on {iso(min.t)}. Farthest: {nf(max.au, 3)} au on {iso(max.t)}. The vertical scale is stretched to the range, so a flat-looking line can still change.
      </p>
    </figure>
  );
}

const subscribe = () => () => {};
const todayClient = () => iso(new Date());
const todayServer = () => null;

export default function DistanceShell() {
  const router = useRouter();
  const params = useSearchParams();
  const rawA = params.get("a") ?? "earth", rawB = params.get("b") ?? "mars";
  const a: SepBody = isSepBody(rawA) ? rawA : "earth";
  const b: SepBody = isSepBody(rawB) ? rawB : "mars";
  const typed = params.get("date");
  const parsed = parseDay(typed);
  // "Today" only exists in the browser (the page is prerendered), so it is read through useSyncExternalStore to avoid a hydration mismatch.
  const today = useSyncExternalStore(subscribe, todayClient, todayServer);
  const dStr = parsed ? iso(parsed) : today;
  const result = useMemo(() => (dStr ? separation(a, b, new Date(`${dStr}T12:00:00Z`)) : null), [a, b, dStr]);
  const series = useMemo(() => (dStr && result ? distanceSeries(a, b, new Date(`${dStr}T12:00:00Z`), 365) : []), [a, b, dStr, result]);

  const go = (na: string, nb: string, nd: string) => {
    const q = new URLSearchParams({ a: na, b: nb, date: nd });
    router.replace(`/distance?${q}`, { scroll: false });
  };

  if (!dStr) return <div className="min-h-svh bg-void" />;

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-5 py-8 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Distance between bodies</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        How far apart two Solar System bodies are on a chosen date, from JPL&apos;s approximate planet positions. The Sun and the eight planets only: moon positions along their orbits are illustrative here, so no date-specific moon distance is given. Distances to stars and galaxies are not included either.
      </p>

      <div className="mt-8 grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <Picker label="From" value={a} onChange={(v) => go(v, b, dStr!)} />
        <button type="button" onClick={() => go(b, a, dStr!)} aria-label="Swap bodies" className="glass mx-auto grid h-10 w-10 place-items-center rounded-full hover:border-cyan/60"><ArrowLeftRight size={16} /></button>
        <Picker label="To" value={b} onChange={(v) => go(a, v, dStr!)} />
        <label className="block text-xs text-muted">
          Date (UT, {MIN_YEAR}–{MAX_YEAR})
          <input type="date" value={dStr} min={`${MIN_YEAR}-01-01`} max={`${MAX_YEAR}-12-31`} onChange={(e) => e.target.value && go(a, b, e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink" />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted">
        <button type="button" onClick={() => go(a, b, iso(new Date()))} className="underline-offset-4 hover:text-ink hover:underline">Use today</button>
        {typed && !parsed && <span role="alert">“{typed}” is not a valid date, showing today instead.</span>}
      </div>

      {!result ? (
        <p role="alert" className="mt-10 text-sm text-muted">
          {dStr} is outside {MIN_YEAR}–{MAX_YEAR}, the range where JPL&apos;s approximate positions are valid, so no distance is given.
        </p>
      ) : (
        <>
          <section aria-label="Result" className="mt-8 rounded-xl border border-line p-5">
            <p className="text-sm text-muted">{name(a)} to {name(b)} on {dStr}, 12:00 UT</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">{nf(result.au, 3)} <span className="text-lg font-normal text-muted">au</span></p>
            <dl className="mt-4 grid gap-x-8 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">In kilometres</dt><dd>{nf(result.km / 1e6, 2)} million km</dd></div>
              <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">Light travel time</dt><dd>{formatLightTime(result.lightSeconds)}</dd></div>
            </dl>
            <p className="mt-3"><ProvenanceBadge kind="estimated" /></p>
            <p className="mt-2 text-xs text-muted">
              Computed from the Keplerian elements in Standish &amp; Williams, &ldquo;Keplerian Elements for Approximate Positions of the Major Planets&rdquo; (<a className="underline hover:text-ink" href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noreferrer">JPL</a>), valid 1800–2050. It is not a full ephemeris (JPL lists errors of up to hundreds of arcseconds for the outer planets). Earth is the Earth–Moon barycentre, up to about 4,700 km from Earth&apos;s centre. Positions are geometric: light-time delay is not applied.
            </p>
          </section>
          <Chart pts={series} />
        </>
      )}
    </div>
  );
}
