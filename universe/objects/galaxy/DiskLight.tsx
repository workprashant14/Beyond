"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vXZ;
  void main() { vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/**
 * Unresolved light of a disk galaxy: a quad lying in the galaxy's XZ plane (galaxy-local units, radius 1) whose
 * fragment shader paints the diffuse light. Static geometry, no per-frame work; additive, no depth write.
 */
export default function DiskLight({ fragment, uniforms, radius }: { fragment: string; uniforms: Record<string, { value: unknown }>; radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const wp = useRef(new THREE.Vector3());
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), []);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uDetail: { value: 1 } }, vertexShader: VERT, fragmentShader: fragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
    [fragment, uniforms],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    m.getWorldPosition(wp.current);
    // full noise inside 6 galaxy radii, single octave beyond (hysteresis-free: the switch happens far from the focus distance)
    (m.material as THREE.ShaderMaterial).uniforms.uDetail.value = camera.position.distanceTo(wp.current) / radius < 6 ? 1 : 0;
  });
  return <mesh ref={ref} geometry={geometry} material={material} raycast={() => null} />;
}
