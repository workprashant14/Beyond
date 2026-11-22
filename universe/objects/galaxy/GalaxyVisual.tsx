"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/utils/galaxyMorph";
import { galaxyStars } from "@/utils/galaxyStars";
import { PROFILE_STAR_SCALE, deviceProfile } from "@/utils/deviceProfile";
import { resolveGalaxy } from "./resolve";
import SpiralGalaxyModel from "./SpiralGalaxyModel";
import EllipticalGalaxyModel from "./EllipticalGalaxyModel";
import IrregularGalaxyModel from "./IrregularGalaxyModel";

/** Resolved stars are cheap (one Points call each); galaxyStars() stays the base budget. */
const STAR_BOOST = 1.5;

interface Props {
  id: string;
  radius: number;
  seed: number;
  position: Vec3;
  /** Used only when the catalogue gives no orientation (e.g. the Milky Way). */
  tilt?: [number, number, number];
}

/** Picks the rendering model from the catalogue Hubble type and orients it from catalogue position angle/axis ratio. */
export default function GalaxyVisual({ id, radius, seed, position, tilt = [0, 0, 0] }: Props) {
  const g = useMemo(() => resolveGalaxy(id, seed, position), [id, seed, position]);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    if (g.basis) q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...g.basis.x), new THREE.Vector3(...g.basis.y), new THREE.Vector3(...g.basis.z)));
    else q.setFromEuler(new THREE.Euler(...tilt));
    return q;
  }, [g, tilt]);
  const count = useMemo(() => Math.round(galaxyStars(radius) * STAR_BOOST * PROFILE_STAR_SCALE[deviceProfile()]), [radius]);

  const Model = g.params.cls === "elliptical" ? EllipticalGalaxyModel : g.params.cls === "irregular" ? IrregularGalaxyModel : SpiralGalaxyModel;
  return (
    <group quaternion={quat}>
      <Model params={g.params} count={count} radius={radius} />
    </group>
  );
}
