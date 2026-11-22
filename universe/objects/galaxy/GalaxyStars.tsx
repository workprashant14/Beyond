"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { StarSet } from "@/utils/galaxyMorph";
import { STAR_FRAG, STAR_VERT } from "./glsl";

/**
 * Resolved stars of one galaxy: one Points draw call, per-star colour and brightness, perspective-scaled size.
 * Star order is random, so drawing only a prefix is a uniform thinning: distance LOD shrinks the draw range without
 * changing the look. Positions are in galaxy-local units; the parent group scales them by the galaxy radius.
 * Frustum culling is on (the bounding sphere comes from the positions).
 */
export default function GalaxyStars({ stars, radius }: { stars: StarSet; radius: number }) {
  const ref = useRef<THREE.Points>(null);
  const gl = useThree((s) => s.gl);
  const lastDraw = useRef(-1);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(stars.pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(stars.col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(stars.size, 1));
    g.computeBoundingSphere();
    return g;
  }, [stars]);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 }, uSize: { value: radius * 3.4 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
    [radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const wp = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    const pts = ref.current;
    if (!pts) return;
    (pts.material as THREE.ShaderMaterial).uniforms.uPx.value = gl.getPixelRatio();
    pts.getWorldPosition(wp.current);
    const d = camera.position.distanceTo(wp.current) / radius; // distance in galaxy radii
    // Far away individual stars are sub-pixel anyway: keep 25 % at >= 10.5 radii, everything inside 3.5 radii.
    const frac = THREE.MathUtils.clamp(1 - (d - 3.5) / 7, 0, 1) * 0.75 + 0.25;
    const n = Math.max(1, Math.ceil(stars.n * frac));
    if (Math.abs(n - lastDraw.current) > stars.n * 0.03) {
      pts.geometry.setDrawRange(0, n);
      lastDraw.current = n;
    }
  });

  return <points ref={ref} geometry={geometry} material={material} raycast={() => null} />;
}
