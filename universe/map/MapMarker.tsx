"use client";

import type { ObjectCategory } from "@/types/celestial";

interface Props {
  id: string;
  name: string;
  category: ObjectCategory;
  x: number;
  y: number;
  r: number;
  color: string;
  selected: boolean;
  hovered: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function Shape({ category, r, color }: { category: ObjectCategory; r: number; color: string }) {
  switch (category) {
    case "galaxy":
      return (
        <>
          <ellipse rx={r * 1.15} ry={r * 0.5} transform="rotate(-25)" fill="none" stroke={color} strokeWidth={1.4} opacity={0.9} />
          <ellipse rx={r * 0.7} ry={r * 0.3} transform="rotate(-25)" fill={color} opacity={0.25} />
          <circle r={2.2} fill="#fff1d6" />
        </>
      );
    case "nebula":
      return (
        <>
          <circle cx={-r * 0.3} cy={-r * 0.1} r={r * 0.7} fill={color} opacity={0.35} />
          <circle cx={r * 0.35} cy={r * 0.2} r={r * 0.6} fill={color} opacity={0.35} />
          <circle r={r * 0.3} fill={color} />
        </>
      );
    case "black-hole":
      return (
        <>
          <circle r={r * 1.25} fill="none" stroke={color} strokeWidth={1.2} opacity={0.8} />
          <circle r={r * 0.6} fill="#000" stroke={color} strokeWidth={1.2} />
        </>
      );
    case "exoplanet":
      return <path d={`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`} fill={color} opacity={0.95} />;
    case "star":
    case "system":
      return (
        <>
          <circle r={r * 1.7} fill={color} opacity={0.18} />
          <circle r={r} fill={color} />
        </>
      );
    default:
      return <circle r={r} fill={color} />;
  }
}

export default function MapMarker({
  id,
  name,
  category,
  x,
  y,
  r,
  color,
  selected,
  hovered,
  showLabel,
  onSelect,
  onHover,
}: Props) {
  const ringR = Math.max(r * 1.7, 11);
  return (
    <g
      className="map-marker"
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${category.replace("-", " ")}`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      onPointerEnter={() => onHover(id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
    >
      {/* Tight hit area so neighbouring markers (Earth / Moon) stay individually clickable. */}
      <circle r={r <= 3.5 ? r + 3 : Math.max(r + 5, 10)} fill="transparent" />
      <Shape category={category} r={r} color={color} />
      {(selected || hovered) && (
        <circle r={ringR} fill="none" stroke={selected ? "#52e0ff" : "#8b6cff"} strokeWidth={1.5} opacity={0.9} pointerEvents="none" />
      )}
      <circle className="marker-focus" r={ringR + 3} fill="none" stroke="#52e0ff" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
      {showLabel && (
        <text
          y={ringR + 13}
          textAnchor="middle"
          className="pointer-events-none select-none"
          fill={selected ? "#52e0ff" : hovered ? "#e8ecff" : "rgba(232,236,255,0.72)"}
          fontSize={10.5}
          letterSpacing="0.16em"
          style={{ fontFamily: "var(--font-geist-mono), monospace", paintOrder: "stroke", stroke: "#02030a", strokeWidth: 3 }}
        >
          {name.toUpperCase()}
        </text>
      )}
    </g>
  );
}
