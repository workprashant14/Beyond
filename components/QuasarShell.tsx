"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import ProvenanceBadge from "./ProvenanceBadge";
import QuasarCatalogView from "./QuasarCatalogView";
import { isChunkedMeta, type CatalogMeta } from "@/utils/quasarCatalog";
import { queryQuasars, type Quasar, type QuasarMeta, type QuasarQuery } from "@/utils/quasars";
import { UNAVAILABLE } from "@/utils/format";

type Load = { state: "loading" } | { state: "chunked"; meta: CatalogMeta } | { state: "missing" } | { state: "error" } | { state: "ok"; quasars: Quasar[]; meta: QuasarMeta };
const PAGE = 100;

function Detail({ x, meta }: { x: Quasar; meta: QuasarMeta }) {
  const rows: { k: string; v: string | null; kind?: "observed"; note?: string }[] = [
    { k: "Redshift", v: x.z === null ? null : String(Number(x.z.toPrecision(5))), kind: "observed", note: "as catalogued; it measures how much the light was stretched. Converting it to a distance needs a cosmological model, so no distance is shown" },
    { k: meta.band ? `Magnitude (${meta.band} band)` : "Magnitude", v: meta.band && x.m !== null ? String(Number(x.m.toPrecision(4))) : null, kind: "observed", note: "as catalogued; lower is brighter" },
    { k: "Position (J2000)", v: `RA ${x.ra.toFixed(4)}°, Dec ${x.dec.toFixed(4)}°`, kind: "observed" },
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
      <p className="mt-3 text-xs text-muted">Source: {meta.source}. A quasar is the extremely bright core of a distant galaxy; none is photographed here.</p>
    </div>
  );
}

export default function QuasarShell() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("quasar");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [q, setQ] = useState<QuasarQuery>({ text: "", sort: "redshift-high" });
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    // meta.json decides the format: "chunked" (FITS pipeline) or the older single-file CSV subset
    fetch("/quasars/meta.json")
      .then(async (m) => {
        if (m.status === 404) return alive && setLoad({ state: "missing" });
        if (!m.ok) throw new Error(String(m.status));
        const metaJson: unknown = await m.json();
        if (isChunkedMeta(metaJson)) return alive && setLoad({ state: "chunked", meta: metaJson });
        const r = await fetch("/quasars/quasars.json");
        if (r.status === 404) return alive && setLoad({ state: "missing" });
        if (!r.ok) throw new Error(String(r.status));
        const quasars = (await r.json()) as Quasar[];
        if (alive) setLoad({ state: "ok", quasars, meta: metaJson as QuasarMeta });
      })
      .catch(() => alive && setLoad({ state: "error" }));
    return () => { alive = false; };
  }, []);

  const quasars = load.state === "ok" ? load.quasars : null;
  const meta = load.state === "ok" ? load.meta : null;
  const list = useMemo(() => (quasars ? queryQuasars(quasars, q) : []), [quasars, q]);
  const target = quasars && open ? quasars.find((p) => p.n === open) : undefined;
  useEffect(() => { if (target) document.getElementById(`q-${target.n}`)?.scrollIntoView({ block: "center" }); }, [target]);
  const visible = useMemo(() => {
    const v = list.slice(0, shown);
    return target && !v.includes(target) ? [target, ...v] : v;
  }, [list, shown, target]);

  const update = (next: Partial<QuasarQuery>) => { setQ((s) => ({ ...s, ...next })); setShown(PAGE); };
  const toggle = (x: Quasar) => router.replace(open === x.n ? "/quasars" : `/quasars?quasar=${encodeURIComponent(x.n)}`, { scroll: false });

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Quasar Atlas</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Built by you from a quasar catalogue file: either the full SDSS DR16Q FITS pipeline or a smaller CSV subset (the page says which). Redshift and magnitude are catalogue values; no distance is derived and nothing here is a picture of the quasar.
      </p>

      {load.state === "chunked" && <QuasarCatalogView meta={load.meta} />}
      {load.state === "loading" && <p className="eyebrow mt-10">Loading quasars…</p>}
      {load.state === "error" && <p role="alert" className="mt-10 text-sm text-muted">The quasar file could not be loaded. Reload the page to try again.</p>}
      {load.state === "missing" && (
        <section className="glass mt-10 rounded-2xl p-6" aria-labelledby="q-missing">
          <h2 id="q-missing" className="text-lg font-medium">The quasar data has not been built yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            BEYOND does not ship quasar numbers it could not verify. With the original SDSS DR16Q FITS file (kept outside the project) run the FITS pipeline once on your own computer (needs Python with astropy). It writes the whole catalogue as small chunks that load as you browse. Check the licence of the catalogue you use.
          </p>
          <pre tabIndex={0} aria-label="Command to run" className="mt-3 overflow-x-auto rounded-lg border border-line px-3 py-2 text-xs text-ink"><code>pip install astropy numpy{"\n"}npm run build:quasars:fits -- --fits &quot;..\Beyond Data\Quasars\DR16Q_v4.fits&quot;</code></pre>
          <p className="mt-3 text-sm leading-relaxed text-muted">A smaller CSV subset (100 to 50,000 rows) still works: <code className="text-ink">npm run build:quasars -- --file q.csv --source &quot;SDSS DR16Q&quot; --band i</code>.</p>
          <p className="mt-3 text-sm text-muted">Then reload this page. Meanwhile, 3C 273 is in the <Link href="/explore" prefetch={false} className="underline hover:text-ink">main catalogue</Link>.</p>
        </section>
      )}

      {quasars && meta && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input type="search" value={q.text} onChange={(e) => update({ text: e.target.value })} aria-label="Search quasars by name" placeholder="Search by name"
              className="w-72 rounded-full border border-line bg-transparent px-4 py-2 text-sm placeholder:text-muted focus:border-cyan/50" />
            <label className="flex items-center gap-2 text-xs text-muted">Sort by
              <select value={q.sort} onChange={(e) => update({ sort: e.target.value as QuasarQuery["sort"] })} className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs">
                <option value="redshift-high">Highest redshift</option>
                <option value="redshift-low">Lowest redshift</option>
                <option value="bright">Brightest</option>
                <option value="name">Name</option>
              </select>
            </label>
            <span className="text-xs text-muted" aria-live="polite">{list.length.toLocaleString("en-US")} of {quasars.length.toLocaleString("en-US")} quasars</span>
          </div>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {visible.map((x) => {
              const isOpen = open === x.n;
              return (
                <li key={x.n} id={`q-${x.n}`}>
                  <button type="button" onClick={() => toggle(x)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-2 py-3 text-left hover:bg-white/5">
                    <span className="text-base text-ink">{x.n}</span>
                    <span className="shrink-0 text-xs text-muted">{x.z === null ? UNAVAILABLE : `z = ${Number(x.z.toPrecision(4))}`}</span>
                  </button>
                  {isOpen && <div className="px-2 pb-5"><Detail x={x} meta={meta} /></div>}
                </li>
              );
            })}
            {list.length === 0 && <li className="px-2 py-6 text-sm text-muted">No quasar matches this search.</li>}
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
