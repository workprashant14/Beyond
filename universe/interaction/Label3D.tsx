"use client";

import { useMemo } from "react";
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PerspectiveCamera } from "three";

export type LabelState = "dim" | "normal" | "selected";

const COLORS: Record<LabelState, string> = {
  dim: "rgba(232,236,255,0.55)",
  normal: "rgba(232,236,255,1)",
  selected: "rgba(82,224,255,1)",
};

interface Entry {
  texture: THREE.CanvasTexture;
  aspect: number;
}
const cache = new Map<string, Entry>();

function getEntry(text: string, state: LabelState): Entry {
  const key = `${state}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const H = 48;
  const probe = document.createElement("canvas").getContext("2d")!;
  const font = `500 28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  probe.font = font;
  const label = text.toUpperCase();
  const spacing = 5;
  const W = Math.ceil(probe.measureText(label).width + spacing * label.length + 24);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = COLORS[state];
  ctx.fillText(label, W / 2 + spacing / 2, H / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const entry = { texture, aspect: W / H };
  cache.set(key, entry);
  return entry;
}

/**
 * Constant-screen-size text label drawn as a sprite (no DOM, no React roots).
 * Always on top, never intercepts clicks. Sits just below its parent's origin.
 */
export default function Label3D({
  text,
  state,
  pixelHeight = 13,
  anchorY = 2.4,
}: {
  text: string;
  state: LabelState;
  pixelHeight?: number;
  /** Vertical anchor: 0.5 centres the text on its parent, larger values push it below. */
  anchorY?: number;
}) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { texture, aspect } = useMemo(() => getEntry(text, state), [text, state]);
  const ref = useRef<THREE.Sprite>(null);
  const heightFor = (fov: number) => (pixelHeight / size.height) * 2 * Math.tan((fov * Math.PI) / 360);
  const h = heightFor(camera.fov ?? 55);

  // Keep the label a constant number of pixels tall even when the camera zooms (field of view changes).
  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const hh = heightFor((camera as PerspectiveCamera).fov ?? 55);
    s.scale.set(hh * aspect, hh, 1);
  });

  return (
    <sprite ref={ref} scale={[h * aspect, h, 1]} center={new THREE.Vector2(0.5, anchorY)} renderOrder={20} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} />
    </sprite>
  );
}
