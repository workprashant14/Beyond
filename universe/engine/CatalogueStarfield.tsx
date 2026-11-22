"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { loadSky } from "@/universe/sky/skyData";
import { buildBackdrop, fillCountFor, type Backdrop } from "@/utils/starBackdrop";
import { deviceProfile } from "@/utils/deviceProfile";
import StarfieldPoints from "./StarfieldPoints";

const VERT = /* glsl */ `
  uniform float uPx;      // device pixel ratio
  uniform float uRadius;
  attribute float aMag;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  void main() {
    // Flux ~ 10^(-0.4 m). Size grows slowly with brightness; faint stars are sub-pixel and fade instead of vanishing.
    float bright = clamp((6.6 - aMag) / 8.0, 0.0, 1.0);
    float px = 2.0 + 5.0 * pow(bright, 1.6);
    float flux = pow(10.0, -0.4 * (aMag - 6.5));          // 1 at magnitude 6.5
    vAlpha = clamp(0.5 + 0.5 * pow(flux, 0.35), 0.0, 1.0);
    vHalo = smoothstep(0.35, 0.8, bright);                // only the brightest stars get a soft halo
    vColor = aColor;
    gl_PointSize = (px * (1.0 + 1.6 * vHalo)) * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uRadius, 1.0);
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;     // 0 centre .. 1 edge
    if (d > 1.0) discard;
    float core = exp(-d * d * mix(4.5, 14.0, vHalo));
    float halo = vHalo * 0.22 * exp(-d * 3.2) * (1.0 - d);
    gl_FragColor = vec4(vColor, (core + halo) * vAlpha);
  }
`;

/**
 * Backdrop stars: Hipparcos catalogue stars (real direction, magnitude, B-V) plus a clearly procedural faint fill.
 * One draw call, treated as infinitely distant, so it stays centred on the camera (no parallax). While the catalogue is
 * loading, or if it fails, the previous generic starfield is shown, so the scene never loses its backdrop.
 */
export default function CatalogueStarfield({ radius = 1500 }: { radius?: number }) {
  const [data, setData] = useState<Backdrop | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<THREE.Points>(null);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let alive = true;
    loadSky()
      .then((sky) => { if (alive) setData(buildBackdrop(sky, fillCountFor(deviceProfile()))); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const geometry = useMemo(() => {
    if (!data) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.dir, 3));
    g.setAttribute("aMag", new THREE.BufferAttribute(data.mag, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(data.color, 3));
    return g;
  }, [data]);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 }, uRadius: { value: radius } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
    [radius],
  );
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    const pts = ref.current;
    if (!pts) return;
    (pts.material as THREE.ShaderMaterial).uniforms.uPx.value = gl.getPixelRatio();
    pts.position.copy(camera.position);
  });

  if (failed || !geometry) return <StarfieldPoints count={5000} radius={radius} />;
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />;
}
