"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SolarBody } from "@/data/solarSystem";
import { orbitPath } from "./orbits";

/** The path of one body's real (elliptical, tilted) orbit; moon paths are drawn inside the parent's group. */
export default function OrbitLine({ body, moon }: { body: SolarBody; moon?: boolean }) {
  const geometry = useMemo(() => {
    const path = orbitPath(body);
    const pts = new Float32Array(path.length * 3);
    path.forEach((v, i) => pts.set(v, i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, [body]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={moon ? "#cfcfd6" : "#6f86ff"} transparent opacity={moon ? 0.3 : 0.22} depthWrite={false} />
    </lineLoop>
  );
}
