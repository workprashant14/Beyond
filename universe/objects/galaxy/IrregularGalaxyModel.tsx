"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { sampleStars, type GalaxyParams } from "@/utils/galaxyMorph";
import { NOISE } from "./glsl";
import DiskLight from "./DiskLight";
import GalaxyStars from "./GalaxyStars";

const MAXC = 10;
const FRAG = /* glsl */ `
  uniform vec4 uClump[${MAXC}];
  uniform float uHii[${MAXC}];
  uniform vec2 uSeed; uniform vec2 uBarOff; uniform float uBarAng; uniform float uGain;
  varying vec2 vXZ;
  ${NOISE}
  void main() {
    float r = length(vXZ);
    if (r > 1.0) discard;
    // ragged gas: warp the lookup position with noise so no clump is a clean ellipse
    vec2 w = vXZ + 0.09 * (vec2(fbmL(vXZ * 4.0 + uSeed), fbmL(vXZ * 4.0 + uSeed + 9.0)) - 0.5);
    float I = 0.0, hii = 0.0;
    for (int k = 0; k < ${MAXC}; k++) {
      vec4 c = uClump[k];
      if (c.w > 0.0) {
        vec2 d = w - c.xy;
        float g = c.w * exp(-dot(d, d) / (2.0 * c.z * c.z));
        I += g; hii += uHii[k] * g;
      }
    }
    vec2 cb = vec2(cos(uBarAng), sin(uBarAng));
    vec2 b = w - uBarOff;
    float bu = dot(b, cb) / 0.34, bv = dot(b, vec2(-cb.y, cb.x)) / 0.1;
    float bar = 0.55 * exp(-0.5 * (bu * bu + bv * bv));
    vec2 dd = w - uBarOff;
    float diffuse = 0.16 * exp(-dot(dd * vec2(1.0 / 0.42, 1.0 / 0.36), dd * vec2(1.0 / 0.42, 1.0 / 0.36)) * 0.5);
    float dust = smoothstep(0.55, 0.8, fbmL(vXZ * 9.0 + uSeed * 1.3)) * 0.55;
    float tot = (I + bar + diffuse) * (1.0 - dust) * (0.7 + 0.6 * fbmL(vXZ * 14.0 + uSeed));
    tot *= smoothstep(1.0, 0.7, r);
    vec3 young = vec3(0.62, 0.77, 1.0), old = vec3(1.0, 0.82, 0.58), pink = vec3(1.0, 0.4, 0.55);
    float yf = clamp(I / max(I + bar + diffuse, 1e-4), 0.0, 1.0);
    vec3 col = mix(old, young, yf);
    col = mix(col, pink, clamp(hii / max(I, 1e-4), 0.0, 1.0) * 0.55);
    gl_FragColor = vec4(tone(col * tot, uGain), 1.0);
  }
`;

/** Irregular: lopsided mixture of star-forming clumps, an off-centre bar and ragged dust. No spiral arms, no symmetry. */
export default function IrregularGalaxyModel({ params, count, radius }: { params: GalaxyParams; count: number; radius: number }) {
  const spin = useRef<THREE.Group>(null);
  const reduce = useReducedMotion();
  const stars = useMemo(() => sampleStars(params, count), [params, count]);
  const uniforms = useMemo(() => {
    const clump = Array.from({ length: MAXC }, (_, i) => {
      const c = params.clumps[i];
      return c ? new THREE.Vector4(c.x, c.z, c.sigma, c.w * 0.7) : new THREE.Vector4(0, 0, 1, 0);
    });
    return {
      uClump: { value: clump },
      uHii: { value: Array.from({ length: MAXC }, (_, i) => (params.clumps[i]?.hii ? 1 : 0)) },
      uSeed: { value: new THREE.Vector2(params.seed * 2.31 % 83, params.seed * 1.43 % 79) },
      uBarOff: { value: new THREE.Vector2(...params.barOff) },
      uBarAng: { value: params.barAng }, uGain: { value: 0.7 },
    };
  }, [params]);
  useFrame((_, dt) => { if (!reduce && spin.current) spin.current.rotation.y += dt * 0.006; });
  return (
    <group scale={radius}>
      <group ref={spin}>
        <DiskLight fragment={FRAG} uniforms={uniforms} radius={radius} />
        <GalaxyStars stars={stars} radius={radius} />
      </group>
    </group>
  );
}
