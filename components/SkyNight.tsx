"use client";

import { useState } from "react";
import { X } from "lucide-react";
import ProvenanceBadge from "./ProvenanceBadge";
import { compassPoint, formatUt, MAX_YEAR, MIN_YEAR, partsFromDate, utcFromParts, validLat, validLon } from "@/utils/skyTime";

export interface Place { lat: number; lon: number }

const field = "w-full rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs focus:border-cyan/50";
const btn = "rounded-full border border-line px-3 py-1.5 text-xs hover:border-cyan/60";

function hms(deg: number) {
  const h = deg / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export default function SkyNight({ place, offsetH, lstDeg, when, selected, onPlace, onOffset, onSetTime, onNow, onOff, onClose }: {
  place: Place | null; offsetH: number; lstDeg: number | null; when: Date | null;
  selected: { name: string; alt: number; az: number } | null;
  onPlace: (p: Place) => void; onOffset: (h: number) => void; onSetTime: (ms: number) => void; onNow: () => void; onOff: () => void; onClose: () => void;
}) {
  const [tp, setTp] = useState({ year: "", month: "", day: "", hour: "", minute: "" });
  const [tmsg, setTmsg] = useState<string | null>(null);
  const applyTime = () => {
    const d = utcFromParts({ year: Number(tp.year), month: Number(tp.month), day: Number(tp.day), hour: Number(tp.hour || 0), minute: Number(tp.minute || 0) });
    if ([tp.year, tp.month, tp.day].some((v) => v.trim() === "") || !d) {
      setTmsg(`Enter a real date in universal time: year ${MIN_YEAR} to ${MAX_YEAR}, month 1–12, a day that exists, hour 0–23, minute 0–59.`);
      return;
    }
    setTmsg(null);
    onSetTime(d.getTime());
  };
  const fillNow = () => {
    const p = partsFromDate(new Date());
    setTp({ year: String(p.year), month: String(p.month), day: String(p.day), hour: String(p.hour), minute: String(p.minute) });
    setTmsg(null);
    onNow();
  };
  const [lat, setLat] = useState(place ? String(place.lat) : "");
  const [lon, setLon] = useState(place ? String(place.lon) : "");
  const [msg, setMsg] = useState<string | null>(null);

  const apply = () => {
    const la = Number(lat), lo = Number(lon);
    if (lat.trim() === "" || lon.trim() === "" || !validLat(la) || !validLon(lo)) {
      setMsg("Enter latitude between −90 and 90 and longitude between −180 and 180 (east positive).");
      return;
    }
    setMsg(null);
    onPlace({ lat: la, lon: lo });
  };
  const locate = () => {
    if (!("geolocation" in navigator)) { setMsg("This browser has no location support. Type your coordinates instead."); return; }
    setMsg("Asking your browser for permission…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const la = Math.round(p.coords.latitude * 100) / 100, lo = Math.round(p.coords.longitude * 100) / 100;
        setLat(String(la)); setLon(String(lo)); setMsg(null); onPlace({ lat: la, lon: lo });
      },
      () => setMsg("Location was not shared. Type your coordinates instead."),
      { maximumAge: 600000, timeout: 15000 },
    );
  };

  return (
    <aside aria-label="Night sky" className="glass absolute bottom-4 left-4 top-32 z-20 w-72 overflow-y-auto rounded-2xl p-4 sm:bottom-6 sm:left-6 sm:top-36">
      <div className="flex items-center justify-between">
        <span className="eyebrow !text-[0.62rem]">Night sky from your place</span>
        <button type="button" aria-label="Close night-sky panel" onClick={onClose} className="text-muted hover:text-ink"><X size={16} /></button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        Shows the horizon, which way is north/east/south/west, and what is above it for a place and time. Your coordinates stay in your browser; nothing is sent anywhere.
      </p>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={locate} className={btn}>Use my location</button>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted">Latitude °N
            <input className={field} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.61" />
          </label>
          <label className="text-[11px] text-muted">Longitude °E
            <input className={field} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="77.21" />
          </label>
        </div>
        <button type="button" onClick={apply} className={btn}>Show this sky</button>
        {msg && <p role="status" className="text-[11px] text-muted">{msg}</p>}
      </div>

      {place && when && lstDeg !== null && (
        <div className="mt-4 border-t border-line pt-3 text-xs">
          <label className="block text-[11px] text-muted">
            Time: {offsetH === 0 ? "the chosen moment" : `${offsetH > 0 ? "+" : "−"}${Math.abs(offsetH)} h from the chosen moment`}
            <input type="range" min={-12} max={12} step={0.5} value={offsetH} onChange={(e) => onOffset(Number(e.target.value))} className="w-full accent-cyan" aria-valuetext={offsetH === 0 ? "now" : `${offsetH} hours from now`} />
          </label>
          <button type="button" onClick={() => onOffset(0)} className="mt-1 text-[11px] text-muted underline hover:text-ink">Back to the chosen moment</button>
          <fieldset className="mt-3 border-t border-line pt-3">
            <legend className="text-[11px] text-muted">Go to a date (universal time)</legend>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {(["year", "month", "day", "hour", "minute"] as const).map((k) => (
                <label key={k} className="text-[10px] text-muted">{k === "minute" ? "min" : k}
                  <input className={field} inputMode="numeric" value={tp[k]} onChange={(e) => setTp((s) => ({ ...s, [k]: e.target.value }))} placeholder={k === "year" ? "1969" : k === "month" ? "7" : k === "day" ? "20" : "0"} aria-label={`${k} (universal time)`} />
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={applyTime} className={btn}>Show this date</button>
              <button type="button" onClick={fillNow} className={btn}>Now</button>
            </div>
            {tmsg && <p role="status" className="mt-1 text-[11px] text-muted">{tmsg}</p>}
            <p className="mt-1 text-[10px] leading-snug text-muted">Year 0 is 1 BCE, so 44 BCE is −43. Dates use the Gregorian calendar throughout, even before 1582.</p>
          </fieldset>
          <dl className="mt-3 space-y-1 text-[11px] text-muted">
            <div className="flex justify-between"><dt>Universal time</dt><dd className="text-ink">{formatUt(when)}</dd></div>
            <div className="flex justify-between"><dt>Local sidereal time</dt><dd className="text-ink">{hms(lstDeg)}</dd></div>
          </dl>
          {selected && (
            <p className="mt-3 text-[11px] text-muted" aria-live="polite">
              <span className="text-ink">{selected.name}</span>{" "}
              {selected.alt >= 0
                ? `is ${Math.round(selected.alt)}° above the horizon, toward ${compassPoint(selected.az)} (${Math.round(selected.az)}°).`
                : `is ${Math.round(-selected.alt)}° below the horizon (not visible from here at this time).`}
            </p>
          )}
          <div className="mt-2"><ProvenanceBadge kind="estimated" /></div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Approximate: catalogue positions are precessed to the chosen date and moved by each star&apos;s catalogue proper motion (a straight-line model; stars with no catalogued motion stay where they are today, and figure lines follow their stars while the constellation boundaries stay fixed). Nutation and aberration are not applied, there is no atmospheric refraction, and the time is taken as universal time. Far from today the sky is a good guide for the old patterns, not for aiming a telescope. Planets and the Moon are not shown here.
          </p>
          <button type="button" onClick={onOff} className={`${btn} mt-3`}>Turn night sky off</button>
        </div>
      )}
    </aside>
  );
}
