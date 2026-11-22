"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Box, Map as MapIcon } from "lucide-react";
import Logo from "./Logo";
import { getAllObjects } from "@/services/catalogue";
import { searchObjects } from "@/utils/search";
import { CATEGORY_LABEL, type CelestialObject, type ObjectCategory } from "@/types/celestial";
import { getSceneObject } from "@/universe/objects/sceneConfig";
import { isSolarId } from "@/data/solarSystem";
import { getObjectLevel } from "@/universe/map/mapConfig";
import { orUnavailable } from "@/utils/format";
import { searchMoons, type Moon } from "@/utils/moons";
import { loadMoons } from "@/utils/moonData";
import { loadSky, loadDso, mergeDso, type DsoSet, type SkyData } from "@/universe/sky/skyData";
import { searchSky } from "@/utils/skySearch";
import { norm } from "@/utils/search";

const pill = "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-cyan/60 hover:text-ink";

function Row({ o }: { o: CelestialObject }) {
  const has3D = isSolarId(o.id) || !!getSceneObject(o.id);
  const onMap = !!getObjectLevel(o.id);
  return (
    <li className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h3 className="text-lg font-medium tracking-tight">{o.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{o.summary}</p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div className="flex gap-2"><dt className="text-muted">Distance</dt><dd>{orUnavailable(o.distance)}</dd></div>
            <div className="flex gap-2"><dt className="text-muted">Diameter</dt><dd>{orUnavailable(o.diameter)}</dd></div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {has3D && (
            <Link href={`/explore?object=${o.id}`} prefetch={false} className={pill}>
              <Box size={13} /> 3D
            </Link>
          )}
          {onMap && (
            <Link href={`/map?object=${o.id}`} prefetch={false} className={pill}>
              <MapIcon size={13} /> Map
            </Link>
          )}
          {!has3D && !onMap && (
            <Link href={`/explore?object=${o.id}`} prefetch={false} className={pill}>
              Data
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export default function SearchResults() {
  const q = useSearchParams().get("q")?.slice(0, 80) ?? "";
  const results = searchObjects(getAllObjects(), q, 60);
  const [sky, setSky] = useState<SkyData | null>(null);
  useEffect(() => {
    let alive = true;
    if (q.trim()) loadSky().then((s) => alive && setSky(s)).catch(() => {});
    return () => { alive = false; };
  }, [q]);
  const [moons, setMoons] = useState<Moon[] | null>(null);
  useEffect(() => { if (q.trim()) loadMoons().then(setMoons).catch(() => {}); }, [q]);
  const [dsoSet, setDsoSet] = useState<DsoSet | null>(null);
  useEffect(() => {
    let alive = true;
    if (q.trim()) {
      const faint = /^(ngc|ic|pgc|mel|ugc|eso)\s?\d/i.test(q.trim());
      Promise.all([loadDso("bright"), faint ? loadDso("faint") : Promise.resolve(null)])
        .then(([b, f]) => alive && setDsoSet(mergeDso(b, f)))
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [q]);
  const skyHits = sky && q.trim() ? searchSky(sky, q, 30, new Set(getAllObjects().map((o) => norm(o.name))), dsoSet) : [];
  const moonHits = moons && q.trim() ? searchMoons(moons, q, 30, new Set(getAllObjects().map((o) => o.name.toLowerCase()))) : [];
  const groups = (Object.keys(CATEGORY_LABEL) as ObjectCategory[])
    .map((c) => ({ c, items: results.filter((r) => r.category === c) }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full">
          <ArrowLeft size={16} />
        </Link>
        <Logo />
      </header>

      <h1 className="sr-only">Search results</h1>
      <form action="/search" role="search" className="mt-10">
        <label htmlFor="q" className="eyebrow">Search the catalogue</label>
        <div className="mt-3 flex gap-3">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={!q}
            placeholder="Earth, Andromeda, black holes, nebulae…"
            className="glass min-w-0 flex-1 rounded-full px-5 py-3 text-sm placeholder:text-muted/70 focus:border-cyan/50"
          />
          <button type="submit" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-void">Search</button>
        </div>
      </form>

      <section className="mt-10" aria-live="polite">
        {!q.trim() ? (
          <p className="text-sm text-muted">Type a name, a type (planet, galaxy, nebula…) or a keyword.</p>
        ) : results.length === 0 && skyHits.length === 0 && moonHits.length === 0 ? (
          <p className="text-sm text-muted">No catalogued object matches “{q}”. Check the spelling, or try a type such as “planet” or “galaxy”.</p>
        ) : (
          <>
            <p className="text-sm text-muted">{results.length + skyHits.length + moonHits.length} result{results.length + skyHits.length + moonHits.length === 1 ? "" : "s"} for “{q}”</p>
            <div className="mt-6 space-y-10">
              {groups.map((g) => (
                <div key={g.c}>
                  <h2 className="eyebrow mb-4">{CATEGORY_LABEL[g.c]}</h2>
                  <ul className="space-y-3">
                    {g.items.map((o) => (
                      <Row key={o.id} o={o} />
                    ))}
                  </ul>
                </div>
              ))}
              {moonHits.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-4">Moons Atlas</h2>
                  <ul className="space-y-3">
                    {moonHits.map((h) => (
                      <li key={h.id} className="glass rounded-2xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-medium tracking-tight">{h.name}</h3>
                            <p className="mt-1 text-sm text-muted">{h.sub}</p>
                          </div>
                          <Link href={`/moons?m=${encodeURIComponent(h.id)}`} className={pill}>Moons Atlas</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {skyHits.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-4">Sky Atlas: stars, constellations and deep-sky objects</h2>
                  <ul className="space-y-3">
                    {skyHits.map((h) => (
                      <li key={`${h.kind}-${h.id}`} className="glass rounded-2xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-medium tracking-tight">{h.name}</h3>
                            <p className="mt-1 text-sm text-muted">{h.sub}</p>
                          </div>
                          <Link href={h.kind === "con" ? `/sky?con=${encodeURIComponent(h.id)}` : h.kind === "dso" ? `/sky?dso=${encodeURIComponent(h.id)}` : `/sky?star=${h.id}`} className={pill}>
                            <Box size={13} /> Sky
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
