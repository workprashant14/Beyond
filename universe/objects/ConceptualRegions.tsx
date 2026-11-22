"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { REGIONS, generateRegionAu, regionScenePositions, type RegionSpec } from "@/utils/conceptualRegions";

const COLOR: Record<RegionSpec["id"], string> = { kuiper: "#8fb4ff", scattered: "#b49bff", oort: "#ff9ab0" };
const SIZE: Record<RegionSpec["id"], number> = { kuiper: 1.5, scattered: 1.5, oort: 1.2 };
const OPACITY: Record<RegionSpec["id"], number> = { kuiper: 0.45, scattered: 0.4, oort: 0.3 };

function Region({ spec }: { spec: RegionSpec }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(regionScenePositions(generateRegionAu(spec)), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    return g;
  }, [spec]);
  useEffect(() => () => geom.dispose(), [geom]);
  // Schematic dots are not objects: they must never take clicks away from planets, moons or small bodies.
  return (
    <points geometry={geom} frustumCulled={false} raycast={() => null}>
      <pointsMaterial color={COLOR[spec.id]} size={SIZE[spec.id]} sizeAttenuation={false} transparent opacity={OPACITY[spec.id]} depthWrite={false} />
    </points>
  );
}

/** Schematic Kuiper belt, scattered disc and Oort cloud (see utils/conceptualRegions.ts: real extents, random dots). */
export default function ConceptualRegions({ on }: { on: Record<RegionSpec["id"], boolean> }) {
  return <group>{REGIONS.filter((r) => on[r.id]).map((r) => <Region key={r.id} spec={r} />)}</group>;
}
