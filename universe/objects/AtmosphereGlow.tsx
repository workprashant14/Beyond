"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { AtmosphereLook } from "@/data/atmospheres";

/** Same formula as glowIntensity() in data/atmospheres.ts (tested there). The Sun is at the world origin. */
const VERT = `
varying vec3 vN;
varying vec3 vToCam;
varying vec3 vToSun;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vToCam = normalize(cameraPosition - wp.xyz);
  vToSun = normalize(-wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = `
uniform vec3 uColor;
uniform float uStrength;
varying vec3 vN;
varying vec3 vToCam;
varying vec3 vToSun;
void main() {
  float cosView = dot(normalize(vN), normalize(vToCam));
  float cosSun = dot(normalize(vN), normalize(vToSun));
  float limb = pow(max(0.0, 0.75 - abs(cosView)) / 0.75, 3.0);
  float lit = 0.15 + 0.85 * smoothstep(-0.25, 0.35, cosSun);
  float a = uStrength * limb * lit;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** A thin additive shell just outside a body: an artistic atmosphere glow (see data/atmospheres.ts for what is real and what is not). */
export default function AtmosphereGlow({ radius, look }: { radius: number; look: AtmosphereLook }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uColor: { value: new THREE.Color(look.color) }, uStrength: { value: look.strength } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
      }),
    [look.color, look.strength],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} raycast={() => null}>
      <sphereGeometry args={[radius * (1 + look.thickness), 40, 20]} />
    </mesh>
  );
}
