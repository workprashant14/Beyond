"use client";

import * as THREE from "three";
import { getGlowTexture } from "./textures";

/** Glowing point marking a star / exoplanet system. Artistic marker only. */
export default function StarSystem({ radius, color = "#ff9d6b" }: { radius: number; color?: string }) {
  return (
    <group>
      <sprite scale={[radius * 5, radius * 5, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh>
        <sphereGeometry args={[radius * 0.28, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
