"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { clearRecents, useSaved, type SavedItem } from "@/utils/savedSky";
import { DSO_GROUPS, dsoGroupIndex, dsoTitle } from "@/utils/dso";
import type { DsoSet, SkyData } from "@/universe/sky/skyData";

type Tab = "fav" | "rec" | "browse";
const MAX_ROWS = 100;
const field = "w-full rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs focus:border-cyan/50";

export default function SkyBrowse({ sky, dso, onClose, onOpen }: {
  sky: SkyData; dso: DsoSet | null; onClose: () => void; onOpen: (item: SavedItem) => void;
}) {
  const saved = useSaved();
  const [tab, setTab] = useState<Tab>("browse");
  const [group, setGroup] = useState(-1);
  const [con, setCon] = useState("");
  const [maxMag, setMaxMag] = useState(12);

  const rows = useMemo(() => {
    if (!dso) return { list: [] as SavedItem[], total: 0 };
    const hits: { i: number; mag: number }[] = [];
    for (let i = 0; i < dso.n; i++) {
      if (group >= 0 && dsoGroupIndex(dso.type[i]) !== group) continue;
      if (con && dso.con[i] !== con) continue;
      const m = dso.mag[i];
      // Objects without a catalogued magnitude are kept only when the limit is at its maximum.
      if (Number.isNaN(m) ? maxMag < 20 : m > maxMag) continue;
      hits.push({ i, mag: Number.isNaN(m) ? 99 : m });
    }
    hits.sort((a, b) => a.mag - b.mag);
    return {
      total: hits.length,
      list: hits.slice(0, MAX_ROWS).map<SavedItem>(({ i }) => ({ k: "dso", id: dso.id[i], name: dsoTitle(dso.names[dso.id[i]], dso.desig[i], dso.id[i]) })),
    };
  }, [dso, group, con, maxMag]);

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
      className={`flex-1 rounded-full px-2 py-1 text-xs ${tab === t ? "bg-white/10 text-cyan" : "text-muted hover:text-ink"}`}>{label}</button>
  );
  const list = (items: SavedItem[], empty: string) =>
    items.length === 0 ? <li className="px-3 py-2 text-xs text-muted">{empty}</li> : items.map((it) => (
      <li key={`${it.k}-${it.id}`}>
        <button type="button" onClick={() => onOpen(it)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-ink hover:bg-white/5">
          <span className="truncate">{it.name}</span>
          <span className="shrink-0 text-[10px] uppercase text-muted">{it.k === "dso" ? "deep sky" : it.k === "con" ? "constellation" : "star"}</span>
        </button>
      </li>
    ));

  return (
    <aside aria-label="Browse and saved" className="glass absolute bottom-4 left-4 top-32 z-20 flex w-72 flex-col overflow-hidden rounded-2xl sm:bottom-6 sm:left-6 sm:top-36">
      <div className="flex items-center gap-2 p-3">
        <div role="tablist" aria-label="Browse sections" className="flex flex-1 gap-1">{tabBtn("browse", "Browse")}{tabBtn("fav", `Favorites${saved.fav.length ? ` (${saved.fav.length})` : ""}`)}{tabBtn("rec", "Recent")}</div>
        <button type="button" aria-label="Close browse panel" onClick={onClose} className="text-muted hover:text-ink"><X size={16} /></button>
      </div>
      {tab === "browse" && (
        <div className="space-y-2 px-3 pb-2">
          <label className="block text-[11px] text-muted">Type
            <select className={field} value={group} onChange={(e) => setGroup(Number(e.target.value))}>
              <option value={-1}>All deep-sky types</option>
              {DSO_GROUPS.map((g, i) => <option key={g.key} value={i}>{g.label}</option>)}
            </select>
          </label>
          <label className="block text-[11px] text-muted">Constellation
            <select className={field} value={con} onChange={(e) => setCon(e.target.value)}>
              <option value="">All 88</option>
              {sky.constellations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-[11px] text-muted">Fainter than limit: magnitude {maxMag >= 20 ? "any" : maxMag}
            <input type="range" min={4} max={20} step={1} value={maxMag} onChange={(e) => setMaxMag(Number(e.target.value))} className="w-full accent-cyan" aria-valuetext={maxMag >= 20 ? "any magnitude" : `magnitude ${maxMag}`} />
          </label>
          <p className="text-[11px] text-muted" aria-live="polite">
            {rows.total.toLocaleString("en-US")} match{rows.total === 1 ? "" : "es"}{rows.total > MAX_ROWS ? `, brightest ${MAX_ROWS} shown` : ""}. Distance is not filterable: the deep-sky catalogue has no distances.
          </p>
        </div>
      )}
      <ul className="flex-1 overflow-y-auto px-2 pb-3">
        {tab === "browse" && (dso ? list(rows.list, "Nothing matches these filters. Turn on “Include faint objects” in the Deep sky menu to search the full catalogue.") : <li className="px-3 py-2 text-xs text-muted">Loading catalogue…</li>)}
        {tab === "fav" && list(saved.fav, "No favorites yet. Use the star button in any panel.")}
        {tab === "rec" && (
          <>
            {list(saved.rec, "Nothing viewed yet.")}
            {saved.rec.length > 0 && <li className="px-3 pt-2"><button type="button" onClick={clearRecents} className="text-xs text-muted underline hover:text-ink">Clear recent</button></li>}
          </>
        )}
      </ul>
    </aside>
  );
}
