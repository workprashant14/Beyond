"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProvenanceBadge from "./ProvenanceBadge";
import { QuasarCatalog, browserFetchers, normaliseDesignation, sentinelFor, type CatalogMeta, type CatalogRecord, type CatalogSort } from "@/utils/quasarCatalog";
import { UNAVAILABLE } from "@/utils/format";

const PAGE = 50;
type View = { kind: "browse"; sort: CatalogSort; offset: number } | { kind: "search"; text: string } | { kind: "cone"; ra: number; dec: number; r: number };
type Rows = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; rows: (CatalogRecord & { sepDeg?: number })[]; total: number | null; note?: string };

const fmt = (v: number | null, d: number) => (v === null ? UNAVAILABLE : String(Number(v.toPrecision(d))));
const show = (v: unknown): string => (v === null || v === undefined ? "null" : Array.isArray(v) ? `[${v.map(show).join(", ")}]` : String(v));

function Detail({ cat, rec }: { cat: QuasarCatalog; rec: CatalogRecord }) {
  const [full, setFull] = useState<{ pos: number; state: "loading" | "error" | "ok"; rows: { column: { name: string; unit: string | null; format: string }; value: unknown }[] }>({ pos: -1, state: "loading", rows: [] });
  useEffect(() => {
    let alive = true;
    cat.detail(rec.pos).then((rows) => alive && setFull({ pos: rec.pos, state: "ok", rows })).catch(() => alive && setFull({ pos: rec.pos, state: "error", rows: [] }));
    return () => { alive = false; };
  }, [cat, rec.pos]);
  const state = full.pos === rec.pos ? full.state : "loading";
  const placed = rec.ra !== null && rec.dec !== null;
  return (
    <div className="px-2 pb-5">
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {[
          { k: "Redshift (Z)", v: rec.z === null ? null : fmt(rec.z, 6), note: "as catalogued; converting it to a distance needs a cosmological model, so no distance is shown" },
          { k: cat.meta.band ? `Magnitude (PSFMAG, ${cat.meta.band} band)` : "Magnitude", v: rec.m === null ? null : fmt(rec.m, 5), note: "as catalogued; lower is brighter" },
          { k: "Position", v: placed ? `RA ${rec.ra!.toFixed(5)}°, Dec ${rec.dec!.toFixed(5)}°` : null, note: "J2000 degrees as catalogued" },
          { k: "IS_QSO_FINAL", v: rec.flag === null ? null : String(rec.flag), note: sentinelFor(cat.meta, "IS_QSO_FINAL") ?? undefined },
        ].map((r) => (
          <div key={r.k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
            <dt className="text-muted">{r.k}</dt>
            <dd className="text-right"><span className={r.v ? "text-ink" : "text-muted"}>{r.v ?? UNAVAILABLE}</span>
              {r.v && <span className="mt-1 flex flex-col items-end gap-1"><ProvenanceBadge kind="observed" />{r.note && <span className="max-w-xs text-[11px] text-muted">{r.note}</span>}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {placed && <button type="button" onClick={() => navigator.clipboard?.writeText(`${rec.ra!.toFixed(5)} ${rec.dec!.toFixed(5)}`).catch(() => undefined)} className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs hover:border-cyan/60">Copy coordinates (RA Dec, degrees)</button>}
      {!placed && <p className="mt-3 text-xs text-muted">This record has no valid RA/Dec in the catalogue, so it cannot be placed on the sky.</p>}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-ink">Full catalogue record ({cat.meta.columns.length} columns)</summary>
        {!cat.meta.hasDetail && <p className="mt-2 text-xs text-muted">This build has no detail files.</p>}
        {cat.meta.hasDetail && state === "loading" && <p className="eyebrow mt-3">Loading record…</p>}
        {state === "error" && <p role="alert" className="mt-3 text-xs text-muted">The full record could not be loaded. Detail files may not be deployed (see BEYOND_DEPLOYMENT.md).</p>}
        {state === "ok" && (
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-black/80 text-muted"><tr><th className="px-2 py-1.5">Column</th><th className="px-2 py-1.5">Value as stored</th><th className="px-2 py-1.5">Unit</th></tr></thead>
              <tbody>{full.rows.map(({ column, value }) => {
                const note = sentinelFor(cat.meta, column.name);
                return <tr key={column.name} className="border-t border-line align-top"><td className="px-2 py-1 font-mono">{column.name}</td><td className="break-all px-2 py-1">{show(value)}{note && <span className="mt-0.5 block text-[11px] text-muted">SDSS note: {note}</span>}</td><td className="px-2 py-1 text-muted">{column.unit ?? ""}</td></tr>;
              })}</tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">Values are shown exactly as stored (NaN and FITS null appear as null). Negative numbers are not treated as missing unless SDSS documents that for the column.</p>
      </details>
      <p className="mt-3 text-xs text-muted">Source: {cat.meta.source}. A quasar is the extremely bright core of a distant galaxy; none is photographed here.</p>
    </div>
  );
}

export default function QuasarCatalogView({ meta }: { meta: CatalogMeta }) {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("quasar");
  const cat = useMemo(() => new QuasarCatalog(meta, browserFetchers("/quasars", process.env.NEXT_PUBLIC_QUASAR_DETAIL_BASE)), [meta]);
  const [view, setView] = useState<View>({ kind: "browse", sort: "z-high", offset: 0 });
  const [rows, setRows] = useState<Rows>({ state: "loading" });
  const [text, setText] = useState("");
  const [cone, setCone] = useState({ ra: "", dec: "", r: "1" });
  const [formError, setFormError] = useState<string | null>(null);
  const [opened, setOpened] = useState<CatalogRecord | null>(null);

  useEffect(() => {
    let alive = true;
    const done = (r: Rows) => { if (alive) setRows(r); };
    const work = async (): Promise<Rows> => {
      if (view.kind === "browse") return { state: "ok", rows: await cat.page(view.sort, view.offset, PAGE), total: await cat.sortedCount(view.sort) };
      if (view.kind === "search") {
        const r = await cat.searchDesignation(view.text, 200);
        return r === null ? { state: "ok", rows: [], total: 0, note: "Search by designation digits, e.g. 0012 or 001234.56+012345.6 (the SDSS J prefix is optional). Free-text names are not indexed for this catalogue." } : { state: "ok", rows: r, total: r.length };
      }
      const r = await cat.cone(view.ra, view.dec, view.r, 200);
      return { state: "ok", rows: r, total: r.length, note: r.length === 200 ? "Showing the 200 nearest." : undefined };
    };
    work().then(done).catch((e) => done({ state: "error", message: e instanceof Error ? e.message : "load failed" }));
    return () => { alive = false; };
  }, [cat, view]);

  // open the record named in the URL
  useEffect(() => {
    let alive = true;
    if (!open) { Promise.resolve().then(() => alive && setOpened(null)); return () => { alive = false; }; }
    cat.searchDesignation(open, 20).then((r) => { if (alive) setOpened(r?.find((x) => normaliseDesignation(x.name) === normaliseDesignation(open)) ?? null); }).catch(() => alive && setOpened(null));
    return () => { alive = false; };
  }, [cat, open]);

  const select = (r: CatalogRecord) => router.replace(open === r.name ? "/quasars" : `/quasars?quasar=${encodeURIComponent(r.name)}`, { scroll: false });
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const runCone = (e: React.FormEvent) => {
    e.preventDefault();
    const ra = num(cone.ra), dec = num(cone.dec), r = num(cone.r);
    if (!(ra >= 0 && ra < 360) || !(dec >= -90 && dec <= 90) || !(r > 0 && r <= 180)) return setFormError("Enter RA 0 to <360, Dec -90 to 90 (decimal degrees) and a radius above 0 up to 180.");
    setFormError(null); setView({ kind: "cone", ra, dec, r });
  };
  const sortCount = rows.state === "ok" ? rows.total : null;
  const sorts: [CatalogSort, string][] = [["z-high", "Highest redshift"], ["z-low", "Lowest redshift"], ["bright", "Brightest"], ["position", "Sky position (declination band, RA)"]];

  return (
    <>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        {meta.count.toLocaleString("en-US")} records from {meta.source}, loaded in small pieces as you browse. Redshift and magnitude are catalogue values; no distance is derived and nothing here is a picture of the quasar.
        {meta.input.test_limit !== null && <strong className="text-ink"> TEST BUILD: only the first {meta.input.test_limit} rows of the file.</strong>}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) setView({ kind: "search", text }); }} className="flex w-full gap-2 sm:w-auto">
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search quasars by designation" placeholder="Designation, e.g. 0012 or 001234.5+0123" className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 py-2 text-sm placeholder:text-muted focus:border-cyan/50 sm:w-72 sm:flex-none" />
          <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm hover:border-cyan/60">Search</button>
        </form>
        <label className="flex items-center gap-2 text-xs text-muted">Sort by
          <select value={view.kind === "browse" ? view.sort : ""} onChange={(e) => setView({ kind: "browse", sort: e.target.value as CatalogSort, offset: 0 })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
            {view.kind !== "browse" && <option value="" disabled>(search results)</option>}
            {sorts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <form onSubmit={runCone} className="mt-3 flex flex-wrap items-end gap-2 text-xs text-muted" aria-label="Search around a position">
        {(["ra", "dec", "r"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1">{k === "ra" ? "RA (deg)" : k === "dec" ? "Dec (deg)" : "Radius (deg)"}
            <input value={cone[k]} onChange={(e) => setCone((c) => ({ ...c, [k]: e.target.value }))} inputMode="decimal" className="w-28 rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm text-ink focus:border-cyan/50" />
          </label>
        ))}
        <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-cyan/60">Search around position</button>
        {formError && <span role="alert" className="text-xs text-ink">{formError}</span>}
      </form>

      {rows.state === "loading" && <p className="eyebrow mt-8">Loading…</p>}
      {rows.state === "error" && <p role="alert" className="mt-8 text-sm text-muted">Could not load this part of the catalogue ({rows.message}). Try again.</p>}
      {rows.state === "ok" && (
        <>
          <p className="mt-6 text-xs text-muted" aria-live="polite">
            {view.kind === "browse" ? `${sortCount === 0 ? 0 : view.offset + 1} to ${Math.min(view.offset + PAGE, sortCount ?? 0)} of ${(sortCount ?? 0).toLocaleString("en-US")}${view.sort === "position" ? "" : " (records that have this value)"}` : `${rows.rows.length} result${rows.rows.length === 1 ? "" : "s"}`}
            {rows.note ? ` · ${rows.note}` : ""}
          </p>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {opened && !rows.rows.some((r) => r.pos === opened.pos) && <li key={`o-${opened.pos}`}><div className="px-2 py-3 text-base text-ink">{opened.name}</div><Detail cat={cat} rec={opened} /></li>}
            {rows.rows.map((r) => {
              const isOpen = open === r.name;
              return (
                <li key={r.pos}>
                  <button type="button" onClick={() => select(r)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5">
                    <span className="text-base text-ink">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted">{r.sepDeg !== undefined ? `${r.sepDeg.toFixed(3)}° · ` : ""}{r.z === null ? UNAVAILABLE : `z = ${fmt(r.z, 4)}`}</span>
                  </button>
                  {isOpen && <Detail cat={cat} rec={r} />}
                </li>
              );
            })}
            {rows.rows.length === 0 && <li className="px-2 py-6 text-sm text-muted">No quasar matches.</li>}
          </ul>
          {view.kind === "browse" && (
            <div className="mt-4 flex gap-3">
              <button type="button" disabled={view.offset === 0} onClick={() => setView({ ...view, offset: Math.max(0, view.offset - PAGE) })} className="rounded-full border border-line px-5 py-2 text-sm hover:border-cyan/60 disabled:opacity-40">Previous</button>
              <button type="button" disabled={view.offset + PAGE >= (sortCount ?? 0)} onClick={() => setView({ ...view, offset: view.offset + PAGE })} className="rounded-full border border-line px-5 py-2 text-sm hover:border-cyan/60 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
