"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Compass, Layers, List, Moon, X } from "lucide-react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import { StarPanel, ConstellationPanel, DsoPanel } from "./SkyPanels";
import SkyBrowse from "./SkyBrowse";
import SkyNight, { type Place } from "./SkyNight";
import { ProvenanceLegend } from "./ProvenanceBadge";
import { useWebGLSupport } from "@/hooks/useWebGLSupport";
import { loadSky, loadDso, mergeDso, type DsoSet, type SkyData } from "@/universe/sky/skyData";
import type { MotionStatus, SkyFocus, SkyPick, SkySettings } from "@/universe/sky/SkyScene";
import { DSO_GROUPS, dsoFocusFov, dsoTitle } from "@/utils/dso";
import { addRecent, toggleFavorite, useSaved, type SavedItem } from "@/utils/savedSky";
import { starDisplayName } from "@/utils/sky";
import { centuriesSinceJ2000, equatorialToHorizon, horizonToEquatorial, lstDeg as localSiderealDeg } from "@/utils/skyTime";
import { precessToDate, precessToJ2000 } from "@/utils/precession";

const SkyScene = dynamic(() => import("@/universe/sky/SkyScene"), { ssr: false });

const chip = (on: boolean) =>
  `glass shrink-0 rounded-full px-3.5 py-1.5 text-xs transition hover:border-cyan/60 ${on ? "!border-cyan/70 text-cyan" : "text-muted"}`;

export default function SkyShell() {
  const router = useRouter();
  const params = useSearchParams();
  const webgl = useWebGLSupport();
  const [sky, setSky] = useState<SkyData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [dsoMenu, setDsoMenu] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const saved = useSaved();
  const [nightOpen, setNightOpen] = useState(false);
  const [motion, setMotion] = useState<MotionStatus | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [baseMs, setBaseMs] = useState(0);
  const [offsetH, setOffsetH] = useState(0);
  const [nightLook, setNightLook] = useState<SkyFocus | null>(null);
  const [faintOn, setFaintOn] = useState(false);
  const [dsoBright, setDsoBright] = useState<DsoSet | null>(null);
  const [dsoFaint, setDsoFaint] = useState<DsoSet | null>(null);
  const [dsoNote, setDsoNote] = useState<string | null>(null);
  const [settings, setSettings] = useState<SkySettings>({
    lines: true, bounds: false, conLabels: true, starNames: true, magLimit: 6.5, dsoGroups: DSO_GROUPS.map(() => true),
  });

  useEffect(() => {
    let alive = true;
    loadSky().then((s) => alive && setSky(s)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const dsoParam = params.get("dso");
  // Deep-sky objects load in two tiers: the small bright tier at once, the large faint tier only when asked for.
  useEffect(() => {
    let alive = true;
    loadDso("bright").then((d) => alive && setDsoBright(d)).catch(() => alive && setDsoNote("Deep-sky catalogue could not be loaded."));
    return () => { alive = false; };
  }, [attempt]);
  const needFaint = !!dsoParam && !!dsoBright && !dsoBright.indexOfId.has(dsoParam);
  const wantFaint = faintOn || needFaint;
  useEffect(() => {
    if (!wantFaint) return;
    let alive = true;
    loadDso("faint").then((d) => alive && setDsoFaint(d)).catch(() => alive && setDsoNote("The faint-object catalogue could not be loaded."));
    return () => { alive = false; };
  }, [wantFaint, attempt]);
  const dso = useMemo(() => (dsoBright ? mergeDso(dsoBright, wantFaint ? dsoFaint : null) : null), [dsoBright, dsoFaint, wantFaint]);

  const starParam = params.get("star");
  const conParam = params.get("con");
  const hip = starParam && /^\d{1,6}$/.test(starParam) ? Number(starParam) : null;
  const selectedHip = sky && hip !== null && sky.indexOfHip.has(hip) ? hip : null;
  const selectedCon = sky && conParam && sky.conById.has(conParam) ? conParam : null;
  const selectedDso = dso && dsoParam && dso.indexOfId.has(dsoParam) ? dsoParam : null;

  const go = (q: string) => router.push(q ? `/sky?${q}` : "/sky", { scroll: false });
  const onPick = (pick: SkyPick | null) =>
    go(!pick ? "" : pick.kind === "star" ? `star=${pick.hip}` : `dso=${encodeURIComponent(pick.id)}`);
  const selectCon = (id: string) => { go(`con=${encodeURIComponent(id)}`); setListOpen(false); };

  // The camera flies to whatever is selected (derived from the URL, so Back/Forward work too).
  const focus = useMemo<SkyFocus | null>(() => {
    if (!sky) return null;
    if (selectedHip !== null) {
      const i = sky.indexOfHip.get(selectedHip)!;
      return { ra: sky.ra[i], dec: sky.dec[i], fov: 30, mode: "min", key: `star-${selectedHip}` };
    }
    if (selectedDso && dso) {
      const j = dso.indexOfId.get(selectedDso)!;
      return { ra: dso.ra[j], dec: dso.dec[j], fov: dsoFocusFov(Number.isNaN(dso.a[j]) ? null : dso.a[j]), mode: "exact", key: `dso-${selectedDso}` };
    }
    if (selectedCon) {
      const c = sky.conById.get(selectedCon)!;
      return { ra: c.labels[0][0], dec: c.labels[0][1], fov: 55, mode: "exact", key: `con-${selectedCon}` };
    }
    return nightLook;
  }, [sky, dso, selectedHip, selectedDso, selectedCon, nightLook]);

  const shownCons = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (sky?.constellations ?? []).filter((c) => !f || c.name.toLowerCase().includes(f) || c.id.toLowerCase() === f);
  }, [sky, filter]);

  const when = place ? new Date(baseMs + offsetH * 3600000) : null;
  const lst = place && when ? localSiderealDeg(when, place.lon) : null;
  const T = when ? centuriesSinceJ2000(when) : 0;
  const at = place && when ? { lat: place.lat, lon: place.lon, when } : undefined;
  const night = place && lst !== null ? { lat: place.lat, lst, T } : null;
  const startNight = (p: Place) => {
    const now = Date.now();
    setBaseMs(now); setOffsetH(0); setPlace(p);
    // Look toward the part of the sky that is usually most interesting: the equator-facing side, a third of the way up.
    const d = horizonToEquatorial(35, p.lat >= 0 ? 180 : 0, p.lat, localSiderealDeg(new Date(now), p.lon));
    const e = precessToJ2000(d.ra, d.dec, centuriesSinceJ2000(new Date(now)));
    setNightLook({ ra: e.ra, dec: e.dec, fov: 80, mode: "exact", key: `night-${now}` });
  };
  const stopNight = () => { setPlace(null); setNightLook(null); };

  // What is selected, as a saveable item (name stored so favorites list without loading catalogues).
  const current = useMemo<SavedItem | null>(() => {
    if (!sky) return null;
    if (selectedHip !== null) {
      const i = sky.indexOfHip.get(selectedHip)!;
      const nm = sky.names[String(selectedHip)];
      const con = sky.conById.get(sky.con[i] || nm?.c || "");
      return { k: "star", id: String(selectedHip), name: starDisplayName(selectedHip, nm, con?.gen, con?.id) };
    }
    if (selectedDso && dso) {
      const j = dso.indexOfId.get(selectedDso)!;
      return { k: "dso", id: selectedDso, name: dsoTitle(dso.names[selectedDso], dso.desig[j], selectedDso) };
    }
    if (selectedCon) return { k: "con", id: selectedCon, name: sky.conById.get(selectedCon)!.name };
    return null;
  }, [sky, dso, selectedHip, selectedDso, selectedCon]);
  useEffect(() => { if (current) addRecent(current); }, [current]);
  const selectedHorizon = useMemo(() => {
    if (!place || lst === null || !current || !sky) return null;
    let ra: number | undefined, dec: number | undefined;
    if (current.k === "star") { const i = sky.indexOfHip.get(Number(current.id)); if (i !== undefined) { ra = sky.ra[i]; dec = sky.dec[i]; } }
    else if (current.k === "dso" && dso) { const j = dso.indexOfId.get(current.id); if (j !== undefined) { ra = dso.ra[j]; dec = dso.dec[j]; } }
    else if (current.k === "con") { const c = sky.conById.get(current.id); if (c) { ra = c.labels[0][0]; dec = c.labels[0][1]; } }
    if (ra === undefined || dec === undefined) return null;
    const p = precessToDate(ra, dec, T);
    return { name: current.name, ...equatorialToHorizon(p.ra, p.dec, place.lat, lst) };
  }, [place, lst, T, current, sky, dso]);
  const fav = current ? { on: saved.fav.some((f) => f.k === current.k && f.id === current.id), toggle: () => toggleFavorite(current) } : undefined;
  const openItem = (it: SavedItem) => go(it.k === "star" ? `star=${it.id}` : `${it.k}=${encodeURIComponent(it.id)}`);

  const toggle = (k: "lines" | "bounds" | "conLabels" | "starNames") => setSettings((s) => ({ ...s, [k]: !s[k] }));
  const showList = listOpen || webgl === false;

  return (
    <div className="relative h-svh w-full overflow-hidden bg-void">
      <div className="absolute inset-0">
        {webgl === false ? (
          <div className="grid h-full w-full place-items-center p-6 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Your browser or device can’t run the 3D renderer. The constellation list still works and shows each constellation’s data.
            </p>
          </div>
        ) : failed ? (
          <div className="grid h-full w-full place-items-center p-6 text-center">
            <div role="alert">
              <p className="text-sm text-muted">The star catalogue could not be loaded.</p>
              <button type="button" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }} className="mt-4 rounded-full border border-line px-4 py-2 text-xs hover:border-cyan/60">Retry</button>
            </div>
          </div>
        ) : !sky || webgl === null ? (
          <div className="grid h-full w-full place-items-center"><p className="eyebrow">Loading star catalogue…</p></div>
        ) : (
          <SkyScene sky={sky} dso={dso} settings={settings} selectedHip={selectedHip} selectedDso={selectedDso} selectedCon={selectedCon} focus={focus} onPick={onPick} night={night} onMotion={setMotion} />
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-4">
          <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
          <Logo className="hidden sm:inline-flex" />
        </div>
        <div className="pointer-events-auto w-full max-w-lg"><SearchBar /></div>
      </header>

      <div role="toolbar" aria-label="Sky display options" className="absolute inset-x-0 top-20 z-20 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:top-24 sm:px-6">
        <button type="button" onClick={() => { setListOpen((o) => !o); setDsoMenu(false); setBrowseOpen(false); setNightOpen(false); }} aria-expanded={showList} className={`${chip(showList)} inline-flex items-center gap-1.5`}>
          <List size={13} /> Constellations
        </button>
        <button type="button" onClick={() => { setDsoMenu((o) => !o); setListOpen(false); setBrowseOpen(false); setNightOpen(false); }} aria-expanded={dsoMenu} className={`${chip(dsoMenu)} inline-flex items-center gap-1.5`}>
          <Layers size={13} /> Deep sky
        </button>
        <button type="button" onClick={() => { setBrowseOpen((o) => !o); setListOpen(false); setDsoMenu(false); setNightOpen(false); }} aria-expanded={browseOpen} className={`${chip(browseOpen)} inline-flex items-center gap-1.5`}>
          <Compass size={13} /> Browse &amp; saved
        </button>
        <button type="button" onClick={() => { setNightOpen((o) => !o); setListOpen(false); setDsoMenu(false); setBrowseOpen(false); }} aria-expanded={nightOpen} className={`${chip(nightOpen || !!place)} inline-flex items-center gap-1.5`}>
          <Moon size={13} /> Night sky{place ? " (on)" : ""}
        </button>
        <button type="button" aria-pressed={settings.lines} onClick={() => toggle("lines")} className={chip(settings.lines)}>Figures</button>
        <button type="button" aria-pressed={settings.bounds} onClick={() => toggle("bounds")} className={chip(settings.bounds)}>Boundaries</button>
        <button type="button" aria-pressed={settings.conLabels} onClick={() => toggle("conLabels")} className={chip(settings.conLabels)}>Constellation names</button>
        <button type="button" aria-pressed={settings.starNames} onClick={() => toggle("starNames")} className={chip(settings.starNames)}>Star names</button>
        <label className="glass flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted">
          Faintest star
          <input
            type="range" min={2} max={6.5} step={0.5} value={settings.magLimit}
            onChange={(e) => setSettings((s) => ({ ...s, magLimit: Number(e.target.value) }))}
            aria-valuetext={`magnitude ${settings.magLimit}`}
            className="w-24 accent-cyan"
          />
          <span className="w-6 text-ink">{settings.magLimit}</span>
        </label>
      </div>

      {dsoMenu && !showList && (
        <div role="group" aria-label="Deep-sky object types" className="glass absolute left-4 top-32 z-20 w-72 rounded-2xl p-4 sm:left-6 sm:top-36">
          <div className="flex items-center justify-between">
            <span className="eyebrow !text-[0.62rem]">Deep-sky types</span>
            <button type="button" aria-label="Close deep-sky menu" onClick={() => setDsoMenu(false)} className="text-muted hover:text-ink"><X size={16} /></button>
          </div>
          <ul className="mt-3 space-y-1">
            {DSO_GROUPS.map((g, i) => (
              <li key={g.key}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                  <input
                    type="checkbox" className="accent-cyan" checked={settings.dsoGroups[i]}
                    onChange={() => setSettings((st) => ({ ...st, dsoGroups: st.dsoGroups.map((v, k) => (k === i ? !v : v)) }))}
                  />
                  <span aria-hidden className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: g.color, borderRadius: g.shape === 0 || g.shape === 4 || g.shape === 5 ? "999px" : g.shape === 3 ? "50%" : "2px", transform: g.shape === 2 ? "rotate(45deg)" : undefined }} />
                  {g.label}
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5 accent-cyan" checked={faintOn} onChange={() => setFaintOn((v) => !v)} />
            <span>
              Include faint objects
              <span className="block text-[11px]">{faintOn && !dsoFaint ? "Loading about 250 KB…" : `About 11,500 more; they appear as you zoom in.${dsoFaint ? ` ${dso?.n.toLocaleString("en-US")} objects loaded.` : ""}`}</span>
            </span>
          </label>
          <p className="mt-3 text-[11px] leading-snug text-muted">Symbols are artistic markers by type. Positions and catalogue values are from OpenNGC.</p>
          {dsoNote && <p role="alert" className="mt-2 text-[11px] text-muted">{dsoNote}</p>}
        </div>
      )}

      {place && motion && motion.state !== "off" && (
        <p data-testid="pm-note" role="status" className="glass pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-[11px] text-muted sm:bottom-6">
          {motion.state === "loading" && "Loading star motions…"}
          {motion.state === "unavailable" && "Star motions unavailable: stars are drawn at their J2000 places."}
          {motion.state === "ready" && (
            <>
              <span className="text-cyan">Estimated</span> · stars moved by proper motion for {Math.abs(motion.years).toLocaleString("en-US")} yr {motion.years < 0 ? "before" : "after"} 2000
              {motion.maxDeg < 0.02 ? " (shift too small to see)" : ""}. Boundaries stay fixed; figures follow their stars.
            </>
          )}
        </p>
      )}

      {nightOpen && !showList && (
        <SkyNight place={place} offsetH={offsetH} lstDeg={lst} when={when} selected={selectedHorizon}
          onPlace={startNight} onOffset={setOffsetH} onSetTime={(ms) => { setBaseMs(ms); setOffsetH(0); }} onNow={() => { setBaseMs(Date.now()); setOffsetH(0); }} onOff={stopNight} onClose={() => setNightOpen(false)} />
      )}

      {browseOpen && !showList && sky && <SkyBrowse sky={sky} dso={dso} onClose={() => setBrowseOpen(false)} onOpen={openItem} />}

      {showList && (
        <nav aria-label="Constellations" className="glass absolute bottom-4 left-4 top-32 z-20 flex w-64 flex-col overflow-hidden rounded-2xl sm:bottom-6 sm:left-6 sm:top-36">
          <div className="flex items-center gap-2 p-3">
            <input
              type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter 88 constellations"
              aria-label="Filter constellations"
              className="min-w-0 flex-1 rounded-full border border-line bg-transparent px-3 py-1.5 text-xs placeholder:text-muted/70 focus:border-cyan/50"
            />
            {webgl !== false && (
              <button type="button" aria-label="Close constellation list" onClick={() => setListOpen(false)} className="text-muted hover:text-ink"><X size={16} /></button>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto px-2 pb-3">
            {shownCons.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => selectCon(c.id)} aria-current={c.id === selectedCon ? "true" : undefined}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm hover:bg-white/5 ${c.id === selectedCon ? "text-cyan" : "text-ink"}`}>
                  <span>{c.name}</span><span className="text-[10px] text-muted">{c.id}</span>
                </button>
              </li>
            ))}
            {sky && shownCons.length === 0 && <li className="px-3 py-2 text-xs text-muted">No constellation matches “{filter}”.</li>}
          </ul>
        </nav>
      )}

      {!(selectedHip !== null || selectedCon || selectedDso) && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs sm:bottom-6 sm:left-6">
          {!showList && !browseOpen && !nightOpen && (
            <div className="glass pointer-events-auto rounded-xl px-4 py-3 text-xs leading-relaxed text-muted">
              <span className="eyebrow !text-[0.6rem]">What you are looking at</span>
              <p className="mt-1">Stars and deep-sky objects are catalogued positions seen from inside the celestial sphere (not your local sky). Drag to look, scroll to zoom, click a star or a symbol.</p>
              <ProvenanceLegend />
            </div>
          )}
        </div>
      )}

      {sky && selectedHip !== null && (
        <StarPanel sky={sky} hip={selectedHip} onClose={() => go("")} onOpenConstellation={selectCon} fav={fav} at={at} />
      )}
      {sky && dso && selectedHip === null && selectedDso && (
        <DsoPanel sky={sky} dso={dso} id={selectedDso} onClose={() => go("")} onOpenConstellation={selectCon} fav={fav} at={at} />
      )}
      {sky && selectedHip === null && !selectedDso && selectedCon && (
        <ConstellationPanel sky={sky} con={sky.conById.get(selectedCon)!} onClose={() => go("")} onOpenStar={(h) => go(`star=${h}`)} fav={fav} />
      )}
    </div>
  );
}
