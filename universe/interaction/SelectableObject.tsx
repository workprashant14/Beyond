"use client";

import { useEffect, useState } from "react";
import { Billboard } from "@react-three/drei";
import Label3D from "./Label3D";
import type { ThreeEvent } from "@react-three/fiber";

interface Props {
  position: [number, number, number];
  hitRadius: number;
  ringRadius: number;
  label: string;
  selected: boolean;
  /** When true the invisible click target is removed so objects inside can be picked. */
  hitDisabled?: boolean;
  /** Hide the text label (e.g. when the user turns labels off). */
  showLabel?: boolean;
  /** World-unit distance to push the label below the object (screen-down), e.g. a galaxy's radius. */
  labelOffset?: number;
  onSelect: () => void;
  children: React.ReactNode;
}

function HitTarget({
  radius,
  onSelect,
  onHover,
}: {
  radius: number;
  onSelect: () => void;
  onHover: (v: boolean) => void;
}) {
  useEffect(() => () => onHover(false), [onHover]);
  return (
    <mesh
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return; // it was a drag, not a click
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function SelectableObject({
  position,
  hitRadius,
  ringRadius,
  label,
  selected,
  hitDisabled = false,
  showLabel = true,
  labelOffset = 0,
  onSelect,
  children,
}: Props) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const highlighted = hovered || selected;

  return (
    <group position={position}>
      {children}
      {!hitDisabled && <HitTarget radius={hitRadius} onSelect={onSelect} onHover={setHovered} />}
      {highlighted && (
        <Billboard>
          <mesh>
            <ringGeometry args={[ringRadius, ringRadius + Math.max(ringRadius * 0.012, 0.06), 96]} />
            <meshBasicMaterial color={selected ? "#52e0ff" : "#8b6cff"} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
      {(showLabel || highlighted) && (
        <Billboard position={[0, -labelOffset, 0]}>
          <Label3D text={label} state={selected ? "selected" : highlighted ? "normal" : "dim"} />
        </Billboard>
      )}
    </group>
  );
}
