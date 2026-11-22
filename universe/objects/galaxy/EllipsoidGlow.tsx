"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NOISE } from "./glsl";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
  uniform vec3 uCinv;      // inverse of the projected covariance (xx, xy, yy)
  uniform float uExtent;   // half-size of the quad in galaxy-radius units
  uniform float uRe;       // effective radius, in units of the ellipsoid's own size
  uniform float uGain;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * uExtent;
    float rho = sqrt(max(0.0, uCinv.x * p.x * p.x + 2.0 * uCinv.y * p.x * p.y + uCinv.z * p.y * p.y));
    if (rho > 1.0) discard;
    // Sersic profile with n = 2.5 (b = 4.67): smooth falloff, finite core, no hard edge
    float I = exp(-4.67 * (pow((rho + 0.012) / uRe, 0.4) - 1.0));
    I *= smoothstep(1.0, 0.55, rho);
    vec3 col = mix(uColA, uColB, clamp(rho * 1.2, 0.0, 1.0));
    gl_FragColor = vec4(tone(col * I, uGain), 1.0);
  }
`;

export interface GlowProps {
  /** Semi-axes along the parent's local x, y, z, in units of the galaxy radius. */
  axes: [number, number, number];
  re: number;
  gain: number;
  colA?: string;
  colB?: string;
}

/**
 * Smooth unresolved light of an ellipsoidal body (elliptical galaxy, spiral bulge). It is a camera-facing quad whose
 * shader integrates an ellipsoid analytically: the projected 2x2 covariance is recomputed per frame, so the ellipse
 * shape stays correct from every viewing angle. No texture, no per-frame allocation.
 */
export default function EllipsoidGlow({ axes, re, gain, colA = "#ffd9a0", colB = "#ffc27a" }: GlowProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const scratch = useRef({ pq: new THREE.Quaternion(), e: new THREE.Vector3(), s1: new THREE.Vector3(), s2: new THREE.Vector3() });
  const ext0 = Math.max(...axes) * 1.02;
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        uCinv: { value: new THREE.Vector3(1, 0, 1) }, uExtent: { value: ext0 }, uRe: { value: re }, uGain: { value: gain },
        uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }),
    [ext0, re, gain, colA, colB],
  );
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m || !m.parent) return;
    const tmp = scratch.current;
    m.parent.getWorldQuaternion(tmp.pq);
    m.quaternion.copy(tmp.pq).invert().multiply(camera.quaternion); // face the camera
    tmp.s1.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmp.s2.set(0, 1, 0).applyQuaternion(camera.quaternion);
    let cxx = 0, cxy = 0, cyy = 0;
    for (let k = 0; k < 3; k++) {
      tmp.e.set(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).applyQuaternion(tmp.pq);
      const a2 = axes[k] * axes[k];
      const u = tmp.e.dot(tmp.s1), v = tmp.e.dot(tmp.s2);
      cxx += a2 * u * u; cxy += a2 * u * v; cyy += a2 * v * v;
    }
    const det = Math.max(cxx * cyy - cxy * cxy, 1e-6);
    const U = (m.material as THREE.ShaderMaterial).uniforms;
    (U.uCinv.value as THREE.Vector3).set(cyy / det, -cxy / det, cxx / det);
    const ext = Math.sqrt((cxx + cyy) / 2 + Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy)) * 1.02;
    U.uExtent.value = ext;
    m.scale.setScalar(ext); // quad is 2x2; world half-size = ext (parent scales by the galaxy radius)
  });

  return <mesh ref={mesh} geometry={geometry} material={material} raycast={() => null} />;
}
