"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Maximize2, Minus, Plus } from "lucide-react";
import MapMarker from "./MapMarker";
import {
  LABEL_WEIGHT,
  MOON_ORBIT_POINTS,
  SOLAR_ORBIT_PATHS,
  boundsOf,
  dustFor,
  getMapItems,
  spiralArmPaths,
  type MapLevelId,
} from "./mapConfig";
import { getObject } from "@/services/catalogue";
import { daysSinceJ2000 } from "@/universe/objects/solarScale";
import type { CelestialObject } from "@/types/celestial";

/** "Now" in days since J2000, evaluated once when this client-only module loads. */
const BOOT_DAYS = daysSinceJ2000(Date.now());

interface View {
  k: number;
  x: number;
  y: number;
}
interface Props {
  level: MapLevelId;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Pixels at the right / bottom covered by the info panel, so the view centres in what's visible. */
  insetRight: number;
  insetBottom: number;
  showIllustrative: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function CosmicMap({ level, selectedId, onSelect, insetRight, insetBottom, showIllustrative }: Props) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [user, setUser] = useState<(View & { level: MapLevelId }) | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // ----- static data per level -----
  const items = useMemo(() => getMapItems(level, BOOT_DAYS), [level]);
  const bounds = useMemo(() => boundsOf(items, level), [items, level]);
  const dust = useMemo(() => dustFor(level), [level]);
  const arms = useMemo(() => (level === "galaxy" ? spiralArmPaths() : []), [level]);
  const catalog = useMemo(() => new Map(items.map((i) => [i.id, getObject(i.id)])), [items]);

  // ----- measure container -----
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size.w > 0 && size.h > 0;
  const visW = Math.max(size.w - insetRight, 120);
  const visH = Math.max(size.h - insetBottom, 120);
  const cx0 = visW / 2;
  const cy0 = visH / 2;

  // ----- default "fit everything" view -----
  const fit = useMemo<View>(() => {
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const pad = 70;
    // On a narrow window a marker at the edge has its label sticking out sideways (labels are about 110 px wide), so keep more room there.
    const padX = visW < 600 ? 160 : pad;
    const k = Math.max(0.01, Math.min((visW - padX) / bw, (visH - pad - 60) / bh));
    return { k, x: cx0 - ((bounds.minX + bounds.maxX) / 2) * k, y: cy0 + 20 - ((bounds.minY + bounds.maxY) / 2) * k };
  }, [bounds, visW, visH, cx0, cy0]);

  const view: View = user && user.level === level ? user : fit;
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  const kMin = fit.k * 0.6;
  const kMax = fit.k * 80;

  const animRef = useRef(0);
  const cancelAnim = () => cancelAnimationFrame(animRef.current);
  const commit = useCallback(
    (v: View) => {
      viewRef.current = v;
      setUser({ ...v, level });
    },
    [level],
  );

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor, kMin, kMax);
      const f = k / v.k;
      commit({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
    },
    [commit, kMin, kMax],
  );

  // ----- fly to the selected object -----
  useEffect(() => {
    if (!ready) return;
    const item = selectedId ? items.find((i) => i.id === selectedId) : undefined;
    if (!item) return;
    const from = viewRef.current;
    const k = Math.max(from.k, fit.k * (item.focusZoom ?? 2.2));
    const to: View = { k, x: cx0 - item.x * k, y: cy0 - item.y * k };
    if (reduce) {
      commit(to);
      return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - p, 3);
      commit({ k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (p < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return cancelAnim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, level, ready]);

  // ----- wheel zoom (needs a non-passive listener) -----
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnim();
      const r = svg.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ----- drag to pan, pinch to zoom -----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ sx: 0, sy: 0, moved: false });
  const dragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelAnim();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { sx: e.clientX, sy: e.clientY, moved: false };
      dragged.current = false;
    } else {
      dragged.current = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const svg = svgRef.current!;
    if (pointers.current.size === 1) {
      const g = gesture.current;
      if (!g.moved && Math.hypot(cur.x - g.sx, cur.y - g.sy) > 4) {
        g.moved = true;
        dragged.current = true;
        svg.setPointerCapture(e.pointerId); // capture only once it's a real drag, so taps still reach markers
      }
      if (g.moved) {
        const v = viewRef.current;
        commit({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y });
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const other = a === cur ? b : a;
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(cur.x - other.x, cur.y - other.y);
      if (before > 0) {
        const r = svg.getBoundingClientRect();
        zoomAt((cur.x + other.x) / 2 - r.left, (cur.y + other.y) / 2 - r.top, after / before);
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== svgRef.current) return;
    const step = 60;
    const v = viewRef.current;
    if (e.key === "ArrowLeft") commit({ ...v, x: v.x + step });
    else if (e.key === "ArrowRight") commit({ ...v, x: v.x - step });
    else if (e.key === "ArrowUp") commit({ ...v, y: v.y + step });
    else if (e.key === "ArrowDown") commit({ ...v, y: v.y - step });
    else if (e.key === "+" || e.key === "=") zoomAt(cx0, cy0, 1.4);
    else if (e.key === "-") zoomAt(cx0, cy0, 1 / 1.4);
    else if (e.key === "0") setUser(null);
    else return;
    e.preventDefault();
  };

  // ----- screen-space positions + label collision -----
  const placed = useMemo(() => {
    const all = items.map((i) => ({ item: i, sx: i.x * view.k + view.x, sy: i.y * view.k + view.y }));
    // Declutter: hide a satellite marker (e.g. the Moon) until it is clearly apart from its neighbour.
    const out = all.filter(({ item, sx, sy }) => {
      if (!item.declutterAgainst || item.id === selectedId) return true;
      const near = all.find((a) => a.item.id === item.declutterAgainst);
      return !near || Math.hypot(near.sx - sx, near.sy - sy) >= 14;
    });
    const rank = (id: string) => {
      if (id === selectedId) return 100;
      if (id === hoverId) return 90;
      return LABEL_WEIGHT[catalog.get(id)?.category ?? ""] ?? 0;
    };
    const shown: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const labelled = new Set<string>();
    [...out]
      .sort((a, b) => rank(b.item.id) - rank(a.item.id))
      .forEach(({ item, sx, sy }) => {
        const name = catalog.get(item.id)?.name ?? item.id;
        const w = name.length * 8.4 + 8;
        const ringR = Math.max(item.r * 1.7, 11);
        const box = { x0: sx - w / 2, x1: sx + w / 2, y0: sy + ringR + 2, y1: sy + ringR + 17 };
        const forced = item.id === selectedId || item.id === hoverId;
        const clash = shown.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
        if (forced || !clash) {
          labelled.add(item.id);
          shown.push(box);
        }
      });
    return { out, labelled };
  }, [items, view, selectedId, hoverId, catalog]);

  const dustScreen = useMemo(
    () => (showIllustrative ? dust.map((d) => ({ x: d.x * view.k + view.x, y: d.y * view.k + view.y, a: d.a })) : []),
    [dust, view, showIllustrative],
  );

  const select = useCallback((id: string) => onSelect(id), [onSelect]);
  const earthItem = items.find((i) => i.id === "earth");
  const sunItem = items.find((i) => i.id === "sun");
  const btn =
    "glass grid h-10 w-10 place-items-center rounded-full text-ink transition hover:border-cyan/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan";

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        role="application"
        aria-label={`Interactive ${level} map. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom, zero resets.`}
        tabIndex={0}
        className="h-full w-full cursor-grab touch-none select-none outline-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (!dragged.current) onSelect(null);
        }}
      >
        <rect width="100%" height="100%" fill="transparent" />

        {/* ILLUSTRATIVE layer: background dust */}
        <g aria-hidden>
          {dustScreen.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={0.9} fill="#cfd8ff" opacity={d.a} />
          ))}
        </g>

        {/* world-space layer (scaled) */}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} aria-hidden>
          {showIllustrative &&
            arms.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#8b6cff" strokeOpacity={0.28} strokeDasharray="4 6" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            ))}
          {level === "solar" &&
            SOLAR_ORBIT_PATHS.map((o) => (
              <polygon key={o.id} points={o.points} fill="none" stroke="#6f86ff" strokeOpacity={0.3} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          {level === "solar" && earthItem && (
            <polygon transform={`translate(${earthItem.x} ${earthItem.y})`} points={MOON_ORBIT_POINTS} fill="none" stroke="#cfcfd6" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
          {level === "solar" && sunItem && <circle cx={sunItem.x} cy={sunItem.y} r={0.01} fill="none" />}
        </g>

        {/* CATALOGUED layer: markers keep constant screen size */}
        {placed.out
          .filter(({ sx, sy }) => sx > -40 && sy > -40 && sx < size.w + 40 && sy < size.h + 40)
          .sort((a, b) => b.item.r - a.item.r) // small markers drawn last, so they win clicks on top of big neighbours
          .map(({ item, sx, sy }) => {
            const o: CelestialObject | undefined = catalog.get(item.id);
            return (
              <MapMarker
                key={item.id}
                id={item.id}
                name={o?.name ?? item.id}
                category={o?.category ?? "star"}
                x={sx}
                y={sy}
                r={item.r}
                color={item.color}
                selected={item.id === selectedId}
                hovered={item.id === hoverId}
                showLabel={placed.labelled.has(item.id)}
                onSelect={select}
                onHover={setHoverId}
              />
            );
          })}
      </svg>

      <div className="absolute left-4 top-[10.4rem] z-10 flex flex-col gap-2 sm:left-6 sm:top-1/2 sm:-translate-y-1/2">
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomAt(cx0, cy0, 1.5)}>
          <Plus size={16} />
        </button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomAt(cx0, cy0, 1 / 1.5)}>
          <Minus size={16} />
        </button>
        <button type="button" aria-label="Fit view" className={btn} onClick={() => setUser(null)}>
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
