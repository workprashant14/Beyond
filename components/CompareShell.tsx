"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import Logo from "./Logo";
import { CATEGORY_LABEL, type CelestialObject } from "@/types/celestial";
import { getAllObjects, getObject } from "@/services/catalogue";
import { orUnavailable } from "@/utils/format";
import { describeRatio, parseDiameterKm, parseMassKg, ratio } from "@/utils/compare";

const ROWS: { label: string; get: (o: CelestialObject) => string | null }[] = [
  { label: "Diameter", get: (o) => o.diameter },
  { label: "Mass", get: (o) => o.mass },
  { label: "Distance", get: (o) => o.distance },
  { label: "Rotation period", get: (o) => o.rotationPeriod },
  { label: "Orbital period", get: (o) => o.orbitalPeriod },
  { label: "Temperature", get: (o) => o.temperature },
  { label: "Composition", get: (o) => o.composition },
  { label: "Discovery / launch", get: (o) => o.discovery },
];

function Picker({ label, value, other, onChange }: { label: string; value: string; other: string; onChange: (id: string) => void }) {
  const all = getAllObjects();
  return (
    <label className="block text-xs text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink"
      >
        <option value="">Choose an object…</option>
        {all.map((o) => (
          <option key={o.id} value={o.id} disabled={o.id === other}>
            {o.name} ({CATEGORY_LABEL[o.category]})
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CompareShell() {
  const router = useRouter();
  const params = useSearchParams();
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";
  const a = getObject(aId);
  const b = getObject(bId);

  const go = (na: string, nb: string) => {
    const q = new URLSearchParams();
    if (na) q.set("a", na);
    if (nb) q.set("b", nb);
    router.replace(`/compare${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };

  const ratios =
    a && b
      ? [
          describeRatio(ratio(parseDiameterKm(a.diameter), parseDiameterKm(b.diameter)), "diameter", a.name, b.name),
          describeRatio(ratio(parseMassKg(a.mass), parseMassKg(b.mass)), "mass", a.name, b.name),
        ]
      : [];

  return (
    <div className="mx-auto min-h-svh max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Put two catalogue objects side by side. Values are the catalogue&apos;s own text; a size or mass ratio is shown only when both values are written in a precise, parseable form. Otherwise it says so instead of guessing.
      </p>

      <div className="mt-8 grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Picker label="Object A" value={aId} other={bId} onChange={(v) => go(v, bId)} />
        <button
          type="button"
          onClick={() => go(bId, aId)}
          aria-label="Swap objects"
          className="glass mx-auto grid h-10 w-10 place-items-center rounded-full hover:border-cyan/60"
        >
          <ArrowLeftRight size={16} />
        </button>
        <Picker label="Object B" value={bId} other={aId} onChange={(v) => go(aId, v)} />
      </div>

      {(aId && !a) || (bId && !b) ? (
        <p role="alert" className="mt-6 text-sm text-muted">
          {aId && !a ? `“${aId}”` : `“${bId}”`} is not in the catalogue.
        </p>
      ) : null}

      {!a || !b ? (
        <p className="mt-10 text-sm text-muted">Choose two objects to compare.</p>
      ) : (
        <>
          <div className="mt-8 rounded-xl border border-line p-4 text-sm" aria-label="Size and mass ratios">
            <h2 className="eyebrow !text-[0.62rem]">How they scale</h2>
            <ul className="mt-3 space-y-1">
              {(["Diameter", "Mass"] as const).map((k, i) => (
                <li key={k} className={ratios[i] ? "text-ink" : "text-muted"}>
                  {ratios[i] ?? `${k} ratio unavailable (one or both values are not given as a precise number)`}
                </li>
              ))}
            </ul>
          </div>

          <table className="mt-8 w-full border-collapse text-sm">
            <caption className="sr-only">{a.name} compared with {b.name}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="w-1/5 py-3 font-normal text-muted"><span className="sr-only">Property</span></th>
                {[a, b].map((o) => (
                  <th key={o.id} scope="col" className="py-3 pr-3 align-top">
                    <Link href={`/explore?object=${o.id}`} prefetch={false} className="text-xl font-semibold hover:text-cyan">{o.name}</Link>
                    <div className="eyebrow !text-[0.6rem]">{CATEGORY_LABEL[o.category]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <th scope="row" className="py-3 pr-3 text-left font-normal text-muted">Summary</th>
                {[a, b].map((o) => <td key={o.id} className="py-3 pr-3 text-muted">{o.summary}</td>)}
              </tr>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-line align-top">
                  <th scope="row" className="py-3 pr-3 text-left font-normal text-muted">{r.label}</th>
                  {[a, b].map((o) => {
                    const v = r.get(o);
                    return <td key={o.id} className={`py-3 pr-3 ${v ? "text-ink" : "text-muted"}`}>{orUnavailable(v)}</td>;
                  })}
                </tr>
              ))}
              <tr className="align-top">
                <th scope="row" className="py-3 pr-3 text-left font-normal text-muted">Notes</th>
                {[a, b].map((o) => (
                  <td key={o.id} className="py-3 pr-3 text-xs text-muted">
                    {o.caveat ?? "No special caveat recorded."}
                    <ul className="mt-2 space-y-1">
                      {o.sources.map((s) => (
                        <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">{s.label}</a></li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
