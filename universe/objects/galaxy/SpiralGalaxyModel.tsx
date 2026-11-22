"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { ARM_R0, ARM_SIGMA0, ARM_SIGMA1, sampleStars, type GalaxyParams } from "@/utils/galaxyMorph";
import { NOISE } from "./glsl";
import DiskLight from "./DiskLight";
import EllipsoidGlow from "./EllipsoidGlow";
import GalaxyStars from "./GalaxyStars";

// GLSL twin of armPhase/armField in utils/galaxyMorph.ts: keep both in step (a unit test pins the JS side).
const FRAG = /* glsl */ `
  uniform vec2 uSeed; uniform vec2 uWob; uniform vec2 uStr;
  uniform float uPitchTan; uniform float uPhi0; uniform float uH; uniform float uFlocc; uniform float uGain;
  uniform float uBar; uniform float uBarAng; uniform float uBarLen; uniform float uBarWid;
  varying vec2 vXZ;
  const float R0 = ${ARM_R0.toFixed(3)};
  const float S0 = ${ARM_SIGMA0.toFixed(3)};
  const float S1 = ${ARM_SIGMA1.toFixed(3)};
  const float TAU = 6.2831853;
  ${NOISE}
  float wrapA(float a) { return a - TAU * floor(a / TAU + 0.5); }
  float armPhase(float k, float r) {
    float rr = max(r, R0);
    return uPhi0 + k * 3.14159265 + log(rr / R0) / uPitchTan + 0.25 * sin(3.0 * rr + uWob.x) + 0.15 * sin(7.0 * rr + uWob.y);
  }
  void main() {
    float r = length(vXZ);
    if (r > 1.0) discard;
    float th = atan(vXZ.y, vXZ.x);
    float sigma = S0 + S1 * r;
    float arm = 0.0, dust = 0.0;
    for (int k = 0; k < 2; k++) {
      float st = k == 0 ? uStr.x : uStr.y;
      float d = wrapA(th - armPhase(float(k), r)) * r;
      arm += st * exp(-0.5 * (d / sigma) * (d / sigma));
      float dd = (d + 1.5 * sigma) / (0.55 * sigma);
      dust += st * exp(-0.5 * dd * dd);
    }
    arm = min(arm, 1.2);
    dust = min(1.0, dust * clamp((r - 0.1) / 0.15, 0.0, 1.0));
    vec2 q = vXZ * 6.0 + uSeed;
    float n = fbmL(q), n2 = fbmL(q * 2.7 + 5.0);
    float clump = mix(0.85, 0.5 + 0.95 * n, 0.45 + 0.5 * uFlocc);
    float base = exp(-r / (uH * 1.5));
    float armMod = 0.35 + 1.3 * smoothstep(0.2, 0.75, n2 + 0.1 * arm);   // arms are mottled, not uniform ribbons
    float patchy = smoothstep(0.25, 0.7, n + 0.15);                       // dust lanes break into patches
    float I = base * (0.3 + 1.3 * arm * armMod) * (1.0 - 0.75 * dust * patchy) * clump;
    if (uBar > 0.5) {
      vec2 cb = vec2(cos(uBarAng), sin(uBarAng));
      float u = dot(vXZ, cb) / uBarLen, v = dot(vXZ, vec2(-cb.y, cb.x)) / uBarWid;
      I += 0.9 * exp(-0.5 * (u * u * u * u + v * v));
    }
    I *= smoothstep(1.0, 0.72, r);
    vec3 warm = vec3(1.0, 0.82, 0.58), blue = vec3(0.58, 0.74, 1.0);
    vec3 col = mix(warm, blue, clamp(r * 1.25 + arm * 0.4, 0.0, 1.0));
    float knots = uDetail > 0.5 ? smoothstep(0.78, 0.95, vnoise(vXZ * 24.0 + uSeed * 1.7)) * arm * 0.7 : 0.0;
    col = mix(col, vec3(1.0, 0.42, 0.55), knots);
    gl_FragColor = vec4(tone(col * I, uGain), 1.0);
  }
`;

/** Spiral: resolved stars drawn with arm weighting and dust-lane gaps, diffuse arm light with dust, an oblate bulge glow, optional bar. */
export default function SpiralGalaxyModel({ params, count, radius }: { params: GalaxyParams; count: number; radius: number }) {
  const spin = useRef<THREE.Group>(null);
  const reduce = useReducedMotion();
  const stars = useMemo(() => sampleStars(params, count), [params, count]);
  const uniforms = useMemo(
    () => ({
      uSeed: { value: new THREE.Vector2(params.seed * 3.17 % 97, params.seed * 1.91 % 89) },
      uWob: { value: new THREE.Vector2(...params.wob) },
      uStr: { value: new THREE.Vector2(...params.armStr) },
      uPitchTan: { value: params.pitchTan }, uPhi0: { value: params.phi0 }, uH: { value: params.scaleH },
      uFlocc: { value: params.flocc }, uGain: { value: 1.15 },
      uBar: { value: params.bar ? 1 : 0 }, uBarAng: { value: params.barAng }, uBarLen: { value: params.barLen }, uBarWid: { value: params.barWid },
    }),
    [params],
  );
  useFrame((_, dt) => { if (!reduce && spin.current) spin.current.rotation.y += dt * 0.012; });
  return (
    <group scale={radius}>
      <group ref={spin}>
        <DiskLight fragment={FRAG} uniforms={uniforms} radius={radius} />
        <GalaxyStars stars={stars} radius={radius} />
      </group>
      <EllipsoidGlow axes={[params.bulgeR, params.bulgeR * 0.82, params.bulgeR]} re={0.32} gain={0.05 + 0.12 * params.bulgeFrac} colA="#ffe0b0" colB="#ffbf80" />
    </group>
  );
}
