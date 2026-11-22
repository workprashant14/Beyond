"use client";

import { useMemo } from "react";
import { sampleStars, type GalaxyParams } from "@/utils/galaxyMorph";
import EllipsoidGlow from "./EllipsoidGlow";
import GalaxyStars from "./GalaxyStars";

/**
 * Elliptical: an ellipsoid with a smooth de Vaucouleurs-like falloff, old yellow stars, no arms and no dust.
 * Axes: major (sky, along the catalogue position angle) 1, sky-minor q, line of sight sqrt(q) (assumed: depth is not observable).
 */
export default function EllipticalGalaxyModel({ params, count, radius }: { params: GalaxyParams; count: number; radius: number }) {
  const stars = useMemo(() => sampleStars(params, count), [params, count]);
  const flat = params.lenticular ? 0.45 : 1;
  return (
    <group scale={radius}>
      <EllipsoidGlow axes={[1, params.q * flat, Math.sqrt(params.q) * flat]} re={0.3} gain={0.32} colA="#ffe3b8" colB="#ffc888" />
      <GalaxyStars stars={stars} radius={radius} />
    </group>
  );
}
