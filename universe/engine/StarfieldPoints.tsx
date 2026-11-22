"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/utils/random";

/**
 * Single draw call: all stars are one THREE.Points buffer.
 * Positions are generated once on a spherical shell (artistic background, not a catalogue).
 */
export default function StarfieldPoints({ count = 4000, radius = 400 }: { count?: number; radius?: number }) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const rand = mulberry32(1337);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = radius * (0.6 + rand() * 0.4);
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
      c.setHSL(rand() < 0.2 ? 0.6 : rand() < 0.1 ? 0.72 : 0.58, 0.5, 0.75 + rand() * 0.25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count, radius]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={1.4} sizeAttenuation={false} vertexColors transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}
