"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SelectableObject from "@/universe/interaction/SelectableObject";
import { registerBody, unregisterBody } from "@/universe/engine/bodyRegistry";
import { getObject } from "@/services/catalogue";
import { SOLAR_BODIES, getSolarBody, type SolarBody } from "@/data/solarSystem";
import { getGlowTexture } from "./textures";
import { getPlanetTexture, getRingTexture } from "./planetTextures";
import AtmosphereGlow from "./AtmosphereGlow";
import { makeRingShadowUniforms, patchGlobe, patchRing, setRingShadow, type RingShadowUniforms } from "./ringShadowShader";
import { ATMOSPHERES } from "@/data/atmospheres";
import { usePhotoTexture } from "./photoTextures";
import { bodyOrbitRadius, orbitPosition } from "./orbits";
import { spinAngleRad, spinIsAnimated } from "@/utils/rotation";
import OrbitLine from "./OrbitLine";
import {
  SUN_VISUAL_RADIUS,
  visualRadius,
} from "./solarScale";

const rad = (deg: number) => (deg * Math.PI) / 180;

export interface Clock {
  /** Simulated days since J2000. */
  days: number;
}

export interface Shared {
  clock: React.RefObject<Clock>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  paused: boolean;
  /** Simulated days per real second (the clock's speed). */
  speed: number;
  labels: boolean;
  orbits: boolean;
  /** Draw the artistic atmosphere glow. */
  atmospheres: boolean;
  /** Saturn's ring shadow on the globe and the globe's on the rings (illustrative geometry). */
  ringShadows: boolean;
}

export function bodyVisualRadius(b: SolarBody): number {
  return b.kind === "star" ? SUN_VISUAL_RADIUS : visualRadius(b.radiusKm);
}

export { bodyOrbitRadius, orbitPosition };

function Rings({ radius, shadow }: { radius: number; shadow: RingShadowUniforms }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 1.3, radius * 2.3, 96]} />
      <meshStandardMaterial
        map={getRingTexture()}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={1}
        onBeforeCompile={(s) => patchRing(s, shadow)}
        customProgramCacheKey={() => "ring-shadow-ring"}
      />
    </mesh>
  );
}

export default function SolarBodyMesh({ data, shared, initialDays }: { data: SolarBody; shared: Shared; initialDays: number }) {
  const orbit = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const label = getObject(data.id)?.name ?? data.id;
  const vr = bodyVisualRadius(data);
  const orbitR = bodyOrbitRadius(data);
  const procedural = useMemo(() => getPlanetTexture(data.texture), [data.texture]);
  const photo = usePhotoTexture(data.id);
  const map = photo ?? procedural;
  const initial = useMemo(() => orbitPosition(data, initialDays), [data, initialDays]);
  const kids = useMemo(() => SOLAR_BODIES.filter((b) => b.parent === data.id), [data.id]);
  const isStar = data.kind === "star";
  const ringShadow = useMemo(() => makeRingShadowUniforms(), []);

  useEffect(() => {
    const g = orbit.current;
    if (!g) return;
    registerBody(data.id, g);
    return () => unregisterBody(data.id, g);
  }, [data.id]);

  useFrame(() => {
    const g = orbit.current;
    if (!g) return;
    const days = shared.clock.current.days;
    if (orbitR > 0) {
      const p = orbitPosition(data, days);
      g.position.set(p[0], p[1], p[2]);
    }
    // Ring plane = the tilted equatorial plane: centre at the planet, normal = local +Y rotated by the axial tilt about Z.
    if (data.rings) setRingShadow(ringShadow, { center: g.position, tiltRad: rad(data.axialTiltDeg), radius: vr, texture: getRingTexture(), enabled: shared.ringShadows });
    const m = spin.current;
    if (!m) return;
    if (data.tidallyLocked && orbitR > 0) {
      // Same face toward the parent: turn with the direction from the parent to the moon.
      const p = orbitPosition(data, days);
      m.rotation.y = Math.atan2(-p[2], p[0]) + Math.PI;
    } else if (spinIsAnimated(shared.speed, data.rotationHours)) {
      // Real sidereal rate x simulated time. Spins that would flicker at this clock speed are left still, not faked at another pace.
      m.rotation.y = spinAngleRad(days, data.rotationHours);
    }
  });

  const glowScale = isStar ? 24 : vr * 3.4;
  const seg = isStar ? 48 : data.kind === "moon" ? 24 : 40;

  return (
    <group ref={orbit} position={initial}>
      <SelectableObject
        position={[0, 0, 0]}
        hitRadius={isStar ? vr : Math.max(vr * 1.8, data.kind === "moon" ? 0.5 : 0.8)}
        ringRadius={isStar ? vr * 1.25 : Math.max(vr * 1.9, data.kind === "moon" ? 0.55 : 0.9)}
        label={label}
        selected={shared.selectedId === data.id}
        showLabel={shared.labels && (data.kind !== "moon" || [data.id, data.parent].includes(shared.selectedId ?? "") || getSolarBody(shared.selectedId)?.parent === data.parent)}
        onSelect={() => shared.onSelect(data.id)}
      >
        <group rotation={[0, 0, rad(data.axialTiltDeg)]}>
          <mesh ref={spin}>
            <sphereGeometry args={[vr, seg, Math.round(seg / 2)]} />
            {isStar ? (
              <meshBasicMaterial map={map} />
            ) : (
              <meshStandardMaterial
                map={map}
                roughness={1}
                metalness={0}
                {...(data.rings ? { onBeforeCompile: (s: THREE.WebGLProgramParametersWithUniforms) => patchGlobe(s, ringShadow), customProgramCacheKey: () => "ring-shadow-globe" } : {})}
              />
            )}
          </mesh>
          {data.rings && <Rings radius={vr} shadow={ringShadow} />}
          {shared.atmospheres && ATMOSPHERES[data.id] && <AtmosphereGlow radius={vr} look={ATMOSPHERES[data.id]} />}
        </group>
        <sprite scale={[glowScale, glowScale, 1]}>
          <spriteMaterial
            map={getGlowTexture()}
            color={data.glow}
            transparent
            opacity={isStar ? 0.75 : 0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </SelectableObject>
      {shared.orbits && kids.map((k) => <OrbitLine key={`line-${k.id}`} body={k} moon />)}
      {kids.map((k) => (
        <SolarBodyMesh key={k.id} data={k} shared={shared} initialDays={initialDays} />
      ))}
    </group>
  );
}
