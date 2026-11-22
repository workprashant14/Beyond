"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import ProvenanceBadge from "./ProvenanceBadge";
import type { DataKind } from "@/types/provenance";
import Link from "next/link";
import { useDsoLive, useStarLive, type SimbadLive } from "@/hooks/useStarLive";
import type { LiveState } from "@/hooks/useLiveJson";
import { loadConstellationAreas, loadStarPhys, type ConstellationAreas, type Constellation, type DsoSet, type SkyData } from "@/universe/sky/skyData";
import { dsoDistance } from "@/utils/dsoDistance";
import { areaRank, formatArea } from "@/utils/constellationArea";
import { riseSet } from "@/utils/riseSet";
import { precessToDate } from "@/utils/precession";
import { centuriesSinceJ2000 } from "@/utils/skyTime";
import type { DsoType } from "@/utils/dso";
import { PC_LY, absoluteMagnitude, distanceClass, distanceSourceLabel, formatLuminosity, motionSourceLabel, tangentialVelocityKms, totalProperMotion, visualLuminosity, type StarPhysFile } from "@/utils/starPhys";
import { dsoTitle, dsoTypeLabel, formatArcmin, messierName } from "@/utils/dso";
import { DSO_TO_CATALOGUE } from "@/data/dsoCatalogueLinks";
import { UNAVAILABLE } from "@/utils/format";
import {
  bayerName, estimateTempK, flamsteedName, formatDec, formatMag, formatRA, starDisplayName,
} from "@/utils/sky";

const shell =
  "glass absolute bottom-0 right-0 top-auto z-20 max-h-[65svh] w-full overflow-y-auto rounded-t-2xl p-6 sm:bottom-6 sm:right-6 sm:top-36 sm:max-h-none sm:w-96 sm:rounded-2xl";

/** Where and when the night-sky view is set (UT). */
export interface ObserverAt { lat: number; lon: number; when: Date }

const hhmm = (d: Date, from: Date) => {
  const day = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / 86400000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}${day > 0 ? ` (+${day} d)` : ""}`;
};

/** Rise, transit and set for the next day at the chosen place, from the catalogue position precessed to the chosen date. */
function RiseSetRow({ ra, dec, at }: { ra: number; dec: number; at: ObserverAt }) {
  const p = precessToDate(ra, dec, centuriesSinceJ2000(at.when));
  const r = riseSet(p.ra, p.dec, at.lat, at.lon, at.when);
  const v = r.kind === "never-rises" ? "Never rises here"
    : r.kind === "circumpolar" ? `Never sets here · highest at ${hhmm(r.transit, at.when)} UT`
    : `Rise ${hhmm(r.rise, at.when)} · Transit ${hhmm(r.transit, at.when)} · Set ${hhmm(r.set, at.when)} UT`;
  return <Row k="Rise · transit · set" v={v} kind="estimated" note="next 24 h from the chosen time, at the chosen place; geometric horizon (no refraction or terrain), proper motion not included" />;
}

function Row({ k, v, kind, note, why }: { k: string; v: string | null; kind?: DataKind; note?: string; /** shown under "Data unavailable" to explain why there is no value */ why?: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">
        <span className={v ? "text-ink" : "text-muted"}>{v ?? UNAVAILABLE}</span>
        {v && (kind || note) && (
          <span className="mt-1 flex flex-col items-end gap-1">
            {kind && <ProvenanceBadge kind={kind} />}
            {note && <span className="text-[11px] text-muted">{note}</span>}
          </span>
        )}
        {!v && why && <span className="mt-1 block max-w-xs text-[11px] text-muted">{why}</span>}
      </dd>
    </div>
  );
}

export interface FavProps { on: boolean; toggle: () => void }

function Header({ eyebrow, title, sub, onClose, fav }: { eyebrow: string; title: string; sub?: string; onClose: () => void; fav?: FavProps }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <span className="eyebrow !text-[0.62rem]">{eyebrow}</span>
        <span className="flex items-center gap-3">
          {fav && (
            <button type="button" onClick={fav.toggle} aria-pressed={fav.on} aria-label={fav.on ? "Remove from favorites" : "Add to favorites"} className={fav.on ? "text-cyan" : "text-muted hover:text-ink"}>
              <Star size={18} fill={fav.on ? "currentColor" : "none"} />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close panel" className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </span>
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </>
  );
}

function LiveRows({ live, label }: { live: { state: LiveState<SimbadLive>; retry: () => void }; label: string }) {
  const { state, retry } = live;
  if (state.status === "loading")
    return <p role="status" aria-label="Loading SIMBAD data" className="text-xs text-muted">Looking up SIMBAD…</p>;
  if (state.status === "error")
    return (
      <div role="alert" className="text-xs text-muted">
        {state.message}{" "}
        <button type="button" onClick={retry} className="underline underline-offset-4 hover:text-ink">Retry</button>
      </div>
    );
  const m = state.data.measurements;
  if (m.status === "unavailable")
    return <p className="text-xs leading-relaxed text-muted">SIMBAD lookup unavailable ({m.reason}). Live SIMBAD {label} are not shown; any values above come from the catalogue.</p>;
  return (
    <div>
      <h4 className="eyebrow !text-[0.62rem]">From SIMBAD (live)</h4>
      <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
        {m.data.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{r.label}</dt>
            <dd className={`text-right ${r.value === UNAVAILABLE ? "text-muted" : "text-ink"}`}>
              {r.value}
              {r.note && <span className="block text-[11px] text-muted">{r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted">
        {m.sources.map((src) => (
          <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">{src.label}</a>
        ))}{" "}
        · fetched {new Date(m.fetchedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
      </p>
    </div>
  );
}

function StarLiveRows({ hip }: { hip: number }) {
  return <LiveRows live={useStarLive(hip)} label="spectral type and distance" />;
}

function DsoLiveRows({ id }: { id: string }) {
  return <LiveRows live={useDsoLive(id)} label="object type, morphology and redshift" />;
}

interface Motion { pmra: number; pmdec: number; pms: string }
type PhysState = { status: "loading" } | { status: "error" } | { status: "ok"; d: number | null; ds: string; sp: string | null; motion: Motion | null; rv: { v: number; s: string } | null; hr: number | null; gl: string };

/** Distance and spectral type for the star at index i, loaded once when a star panel opens. */
function useStarPhys(i: number): PhysState {
  const [data, setData] = useState<StarPhysFile | "error" | null>(null);
  useEffect(() => {
    let alive = true;
    loadStarPhys().then((d) => alive && setData(d)).catch(() => alive && setData("error"));
    return () => { alive = false; };
  }, []);
  if (data === null) return { status: "loading" };
  if (data === "error") return { status: "error" };
  // Files built before the proper-motion enrichment have no such arrays: every one of these then stays unknown.
  const pa = data.pmra?.[i] ?? null, pd = data.pmdec?.[i] ?? null, rv = data.rv?.[i] ?? null;
  return {
    status: "ok", d: data.d[i] ?? null, ds: data.ds[i] ?? "", sp: data.sp[i] ?? null,
    motion: pa !== null && pd !== null ? { pmra: pa, pmdec: pd, pms: data.pms?.[i] ?? "" } : null,
    rv: rv !== null ? { v: rv, s: data.rvs?.[i] ?? "" } : null,
    hr: data.hr?.[i] ?? null, gl: data.gl?.[i] ?? "",
  };
}

export function StarPanel({ sky, hip, onClose, onOpenConstellation, fav, at }: {
  sky: SkyData; hip: number; onClose: () => void; onOpenConstellation: (id: string) => void; fav?: FavProps; at?: ObserverAt;
}) {
  const i = sky.indexOfHip.get(hip)!;
  const nm = sky.names[String(hip)];
  const conId = sky.con[i] || nm?.c;
  const con = conId ? sky.conById.get(conId) : undefined;
  const bv = Number.isNaN(sky.bv[i]) ? null : sky.bv[i];
  const temp = estimateTempK(bv);
  const title = starDisplayName(hip, nm, con?.gen, con?.id);
  const phys = useStarPhys(i);
  const pc = phys.status === "ok" ? phys.d : null;
  const src = phys.status === "ok" ? phys.ds : "";
  const klass = distanceClass(pc, src);
  const absM = pc !== null && klass !== null && !Number.isNaN(sky.mag[i]) ? absoluteMagnitude(sky.mag[i], pc) : null;
  const mot = phys.status === "ok" ? phys.motion : null;
  const rad = phys.status === "ok" ? phys.rv : null;
  const vt = mot && pc !== null && klass === "observed" ? tangentialVelocityKms(totalProperMotion(mot.pmra, mot.pmdec), pc) : null;
  const dist = {
    kind: klass,
    text: pc !== null && klass !== null ? `${Number((pc * PC_LY).toPrecision(pc * PC_LY < 100 ? 3 : 2)).toLocaleString("en-US")} light-years` : null,
    note:
      klass === "observed" ? `from ${distanceSourceLabel(src)} parallax, converted from parsecs` :
      klass === "estimated" ? `low precision: a faint parallax measured by ${distanceSourceLabel(src)}; treat as rough` :
      pc !== null ? "too far for a reliable parallax distance" : undefined,
  };
  const ids = [
    `HIP ${hip}`,
    nm?.h ? `HD ${nm.h}` : null,
    phys.status === "ok" && phys.hr ? `HR ${phys.hr}` : null,
    phys.status === "ok" && phys.gl ? phys.gl : null,
    bayerName(nm?.b, con?.gen, true),
    flamsteedName(nm?.f, con?.gen),
    nm?.v && con ? `${nm.v} ${con.id}` : null,
  ].filter((x): x is string => !!x && x !== title);

  return (
    <aside aria-label="Star information" className={shell}>
      <Header eyebrow="Star" title={title} sub={ids.join(" · ")} onClose={onClose} fav={fav} />
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <Row k="Constellation" v={con?.name ?? null} kind="artistic" note="IAU boundary region (near-boundary stars can differ by a few arcminutes)" />
        <Row k="Right ascension" v={formatRA(sky.ra[i])} kind="observed" note="J2000" />
        <Row k="Declination" v={formatDec(sky.dec[i])} kind="observed" note="J2000" />
        {at && <RiseSetRow ra={sky.ra[i]} dec={sky.dec[i]} at={at} />}
        <Row k="Apparent magnitude" v={formatMag(sky.mag[i])} kind="observed" note="lower = brighter; as packaged in the Hipparcos-based dataset" />
        <Row k="Colour index (B−V)" v={bv === null ? null : bv.toFixed(2)} kind="observed" />
        <Row
          k="Surface temperature"
          v={temp === null ? null : `≈ ${Math.round(temp / 100) * 100} K`}
          kind="estimated"
          note="from B−V (Ballesteros 1997); rough, ignores dust reddening"
        />
        <Row k="Spectral type" v={phys.status === "ok" ? phys.sp : null} kind="observed" note="as catalogued in AT-HYG" />
        <Row
          k="Distance"
          v={dist.text}
          kind={dist.kind ?? undefined}
          note={dist.note}
        />
        <Row
          k="Proper motion"
          v={mot ? `${mot.pmra.toFixed(1)} mas/yr in RA, ${mot.pmdec.toFixed(1)} mas/yr in Dec (total ${totalProperMotion(mot.pmra, mot.pmdec).toFixed(1)})` : null}
          kind="observed"
          note={mot ? `as catalogued, from ${motionSourceLabel(mot.pms)}; the table gives no uncertainty. The positions on the sky map are not moved by it` : undefined}
        />
        <Row
          k="Radial velocity"
          v={rad ? `${rad.v > 0 ? "+" : ""}${rad.v.toFixed(1)} km/s` : null}
          kind="observed"
          note={rad ? `positive = moving away from the Sun; from ${motionSourceLabel(rad.s)}${rad.s === "HYG" ? ", usually lower precision than Gaia" : ""}; the table gives no uncertainty` : undefined}
        />
        <Row
          k="Speed across the sky"
          v={vt === null ? null : `≈ ${vt.toFixed(1)} km/s`}
          kind="estimated"
          note="calculated from the proper motion and the distance above (4.74 × motion in arcsec/yr × distance in pc); shown only when the distance is a reliable parallax"
        />
        <Row k="Absolute magnitude" v={absM === null ? null : absM.toFixed(2)} kind="estimated" note="apparent magnitude corrected for distance only; dust dimming is ignored" />
        <Row
          k="Visible-light luminosity"
          v={absM === null ? null : formatLuminosity(visualLuminosity(absM))}
          kind="estimated"
          note="visible light only, not total (bolometric) output; very hot and very cool stars radiate much of their energy elsewhere, so their total luminosity is far higher"
        />
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted" aria-live="polite">
        {phys.status === "loading" ? "Loading distance data…" : phys.status === "error" ? "Distance data could not be loaded." : "Distance, spectral type, proper motion and radial velocity come from the AT-HYG catalogue (Gaia DR3 where available, Hipparcos-era values for the brightest stars). It carries no per-star error, so trust is judged by source and distance. SIMBAD below gives an independent live lookup when it can be reached."}
      </p>
      {con && (
        <button type="button" onClick={() => onOpenConstellation(con.id)} className="mt-4 rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60">
          Show {con.name}
        </button>
      )}
      <div className="mt-6"><StarLiveRows hip={hip} /></div>
      <div className="mt-6">
        <h3 className="eyebrow !text-[0.62rem]">Sources</h3>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          <li>Positions, magnitude and colour: Hipparcos catalogue numbers via the open d3-celestial dataset (BSD-3-Clause)</li>
          <li>Distance, spectral type, proper motion, radial velocity and HR/Gliese numbers: <a className="underline-offset-4 hover:text-ink hover:underline" target="_blank" rel="noreferrer" href="https://github.com/astronexus/hyg-database">AT-HYG (HYGLike v3.2)</a> (CC BY-SA 4.0)</li>
          <li><a className="underline-offset-4 hover:text-ink hover:underline" target="_blank" rel="noreferrer" href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=HIP+${hip}`}>SIMBAD entry for HIP {hip}</a></li>
        </ul>
      </div>
    </aside>
  );
}

function useConstellationAreas(): ConstellationAreas | "error" | null {
  const [data, setData] = useState<ConstellationAreas | "error" | null>(null);
  useEffect(() => {
    let alive = true;
    loadConstellationAreas().then((d) => alive && setData(d)).catch(() => alive && setData("error"));
    return () => { alive = false; };
  }, []);
  return data;
}

export function ConstellationPanel({ sky, con, onClose, onOpenStar, fav }: {
  sky: SkyData; con: Constellation; onClose: () => void; onOpenStar: (hip: number) => void; fav?: FavProps;
}) {
  const members: number[] = [];
  for (let i = 0; i < sky.n; i++) if (sky.con[i] === con.id) members.push(i);
  members.sort((a, b) => sky.mag[a] - sky.mag[b]);
  const brightest = members[0];
  const named = members.filter((i) => sky.names[String(sky.hip[i])]?.n).slice(0, 10);
  const areaData = useConstellationAreas();
  const area = areaData && areaData !== "error" ? areaData.areas[con.id] ?? null : null;
  const rank = areaData && areaData !== "error" ? areaRank(areaData.areas, con.id) : null;

  return (
    <aside aria-label="Constellation information" className={shell}>
      <Header eyebrow="Constellation" title={con.name} sub={`IAU abbreviation ${con.id} · genitive ${con.gen}`} onClose={onClose} fav={fav} />
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <Row k="Brightest star" v={brightest === undefined ? null : starDisplayName(sky.hip[brightest], sky.names[String(sky.hip[brightest])], con.gen, con.id)} kind="observed" note="among the bundled magnitude ≤ 6 stars" />
        <Row k="Brightest magnitude" v={brightest === undefined ? null : formatMag(sky.mag[brightest])} kind="observed" />
        <Row k="Figure (stick lines)" v="Shown" kind="artistic" note="a traditional pattern, not a physical structure" />
        <Row k="Boundary" v="IAU region" kind="artistic" note="official sky region; a convention, not a physical edge" />
        <Row k="Stars in the bundled set" v={String(members.length)} kind="observed" note="magnitude ≤ 6 only, not the full catalogue" />
        <Row k="Area on the sky" v={area === null ? null : formatArea(area)} kind="artistic" note="area of the IAU region (a convention, not a physical size); published value" why={areaData === null ? "Loading…" : "The published area table could not be loaded."} />
        {rank && <Row k="Size rank" v={`${rank.rank} of ${rank.of}`} kind="artistic" note="by area of the IAU region" />}
      </dl>
      {named.length > 0 && (
        <div className="mt-6">
          <h3 className="eyebrow !text-[0.62rem]">Named stars here</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {named.map((i) => (
              <button key={sky.hip[i]} type="button" onClick={() => onOpenStar(sky.hip[i])} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60">
                {sky.names[String(sky.hip[i])].n}
              </button>
            ))}
          </div>
        </div>
      )}
      {members.length > 0 && (
        <details className="mt-6" data-testid="con-star-list">
          <summary className="eyebrow !text-[0.62rem] cursor-pointer">All {members.length} bundled stars, brightest first</summary>
          <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto border-y border-line text-xs">
            {members.map((i) => (
              <li key={sky.hip[i]}>
                <button type="button" onClick={() => onOpenStar(sky.hip[i])} className="flex w-full items-center justify-between px-1 py-1.5 text-left hover:text-cyan">
                  <span>{starDisplayName(sky.hip[i], sky.names[String(sky.hip[i])], con.gen, con.id)}</span>
                  <span className="text-muted">mag {formatMag(sky.mag[i])}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-6 text-xs leading-relaxed text-muted">
        Figure lines and boundaries come from the open d3-celestial dataset (IAU boundaries). Only stars in the bundled magnitude ≤ 6 set are listed; each star’s constellation comes from the IAU boundaries.
      </p>
    </aside>
  );
}

export function DsoPanel({ sky, dso, id, onClose, onOpenConstellation, fav, at }: {
  sky: SkyData; dso: DsoSet; id: string; onClose: () => void; onOpenConstellation: (id: string) => void; fav?: FavProps; at?: ObserverAt;
}) {
  const i = dso.indexOfId.get(id)!;
  const name = dso.names[id];
  const desig = dso.desig[i];
  const title = dsoTitle(name, desig, id);
  const con = dso.con[i] ? sky.conById.get(dso.con[i]) : undefined;
  const mag = dso.mag[i];
  const velo = dso.radVel[i];
  const zv = dso.redshift[i], pax = dso.parallax[i]; // Float64: the catalogue's decimals print exactly (Float32 would show 5.370999…)
  const dist = dsoDistance(dso.type[i] as DsoType, Number.isNaN(zv) ? null : zv, Number.isNaN(pax) ? null : pax);
  const isGalaxy = ["g", "e", "s0", "s", "i", "sd", "gg", "gp", "gt"].includes(dso.type[i]);
  const ids = [id, desig !== id ? desig : null, name ? messierName(desig) : null].filter((x): x is string => !!x && x !== title);
  const link = DSO_TO_CATALOGUE[id];

  return (
    <aside aria-label="Deep-sky object information" className={shell}>
      <Header eyebrow="Deep-sky object" title={title} sub={ids.join(" · ")} onClose={onClose} fav={fav} />
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <Row k="Type" v={dsoTypeLabel(dso.type[i])} kind="observed" note="classification as catalogued" />
        <Row k="Constellation" v={con?.name ?? null} kind="artistic" note="IAU boundary region" />
        <Row k="Right ascension" v={formatRA(dso.ra[i])} kind="observed" note="J2000" />
        <Row k="Declination" v={formatDec(dso.dec[i])} kind="observed" note="J2000" />
        {at && <RiseSetRow ra={dso.ra[i]} dec={dso.dec[i]} at={at} />}
        <Row k="Magnitude" v={Number.isNaN(mag) ? null : formatMag(mag)} kind="observed" note={dso.magBand[i] ? `${dso.magBand[i]}-band, total for the whole object` : undefined} />
        <Row k="Apparent size" v={formatArcmin(Number.isNaN(dso.a[i]) ? null : dso.a[i], Number.isNaN(dso.b[i]) ? null : dso.b[i])} kind="observed" note="on the sky, not physical size" />
        {dso.hubble[i] && <Row k="Hubble type" v={dso.hubble[i]} kind="observed" />}
        <Row k="Radial velocity" v={Number.isNaN(velo) ? null : `${velo < 0 ? "−" : "+"}${Math.abs(Math.round(velo)).toLocaleString("en-US")} km/s`} kind="observed" note="positive = receding" />
        {isGalaxy && <Row k="Redshift (z)" v={Number.isNaN(zv) ? null : zv.toFixed(6)} kind="observed" note="as catalogued (SIMBAD's main value); the table gives no uncertainty" />}
        {!isGalaxy && !Number.isNaN(pax) && <Row k="Parallax" v={`${Number(pax.toPrecision(5))} mas`} kind="observed" note="as catalogued (SIMBAD's main value); the table gives no uncertainty" />}
        <Row k="Distance" v={dist.text} kind={dist.kind ?? undefined} note={dist.note} why={dist.note} />
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Distances are shown only where the catalogue supports one: a large parallax for clusters and nebulae, a redshift of 0.01 or more for galaxies (an estimate that depends on the cosmological model). Nothing is shown otherwise. The symbol on the sky is an artistic marker for the object type; its size is not physical.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {con && (
          <button type="button" onClick={() => onOpenConstellation(con.id)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60">
            Show {con.name}
          </button>
        )}
        {link && (
          <Link href={`/explore?object=${link}`} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60">
            Open the 3D scene (artistic)
          </Link>
        )}
      </div>
      <div className="mt-6"><DsoLiveRows id={id} /></div>
      <div className="mt-6">
        <h3 className="eyebrow !text-[0.62rem]">Sources</h3>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          <li>Catalogue data: OpenNGC (CC-BY-SA-4.0), compiled by Mattia Verga and contributors</li>
          <li><a className="underline-offset-4 hover:text-ink hover:underline" target="_blank" rel="noreferrer" href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(id)}`}>SIMBAD entry for {id}</a></li>
        </ul>
      </div>
    </aside>
  );
}
