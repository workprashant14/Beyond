"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/utils/random";
import { getGlowTexture } from "./textures";

/** Artistic gas-cloud: soft additive point sprites clustered in a gaussian blob. */
export default function NebulaCloud({
  radius,
  seed,
  color = "#ff7ab6",
  count = 350,
}: {
  radius: number;
  seed: number;
  color?: string;
  count?: number;
}) {
  const geometry = useMemo(() => {
    const rand = mulberry32(seed);
    const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2;
    const base = new THREE.Color(color);
    const alt = new THREE.Color("#8b6cff");
    const c = new THREE.Color();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set([gauss() * radius, gauss() * radius * 0.7, gauss() * radius], i * 3);
      c.copy(base).lerp(alt, rand() * 0.6).multiplyScalar(0.5 + rand() * 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [radius, seed, color, count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={getGlowTexture()}
        size={22}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.07}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
