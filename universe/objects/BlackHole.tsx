"use client";

import * as THREE from "three";
import { getDiskTexture } from "./textures";

/** Artistic black hole: dark sphere plus a tilted glowing accretion disk. Not a physical simulation. */
export default function BlackHole({
  radius,
  tilt = [1.1, 0, 0],
  color = "#ffb36b",
}: {
  radius: number;
  tilt?: [number, number, number];
  color?: string;
}) {
  return (
    <group rotation={tilt}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.2, radius * 4, 64]} />
        <meshBasicMaterial
          map={getDiskTexture()}
          color={color}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
