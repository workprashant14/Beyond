"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { smallBodyPosition, type SmallBody } from "@/utils/smallBodies";
import { TAIL_CAP, antiSunward, selectTails, tailLengthUnits } from "@/utils/cometTail";
import { toScene } from "./smallBodyScene";
import type { Clock } from "./SolarBodyMesh";

/** How often the set of comets that get a tail is re-chosen, seconds. Positions of the chosen tails update every frame. */
const RESELECT_SECONDS = 0.5;
const HEAD = new THREE.Color("#9fd0ff");

function markUpdated(geom: THREE.BufferGeometry) {
  (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

/**
 * Illustrative comet tails (see utils/cometTail.ts): a straight line from each active comet directly away from the Sun, fading to nothing.
 * Direction is real geometry; length, limit distance and look are display choices.
 */
export default function CometTails({ bodies, clock, selectedId }: { bodies: SmallBody[]; clock: React.RefObject<Clock>; selectedId: string | null }) {
  const comets = useMemo(() => bodies.filter((b) => b.k === "c"), [bodies]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TAIL_CAP * 6), 3));
    const col = new Float32Array(TAIL_CAP * 6);
    for (let i = 0; i < TAIL_CAP; i++) { col.set([HEAD.r, HEAD.g, HEAD.b], i * 6); /* far end stays black: additive blending makes black invisible */ }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    g.setDrawRange(0, 0);
    return g;
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  const chosen = useRef<number[]>([]);
  const since = useRef(1e9);
  const selIndex = useMemo(() => (selectedId ? comets.findIndex((c) => c.id === selectedId) : -1), [comets, selectedId]);
  useEffect(() => { since.current = 1e9; }, [comets, selIndex]);

  useFrame((_, dt) => {
    if (comets.length === 0) return;
    const days = clock.current.days;
    since.current += dt;
    if (since.current >= RESELECT_SECONDS) {
      since.current = 0;
      const items = comets.map((c, index) => {
        const p = smallBodyPosition(c, days);
        return { index, rAu: Math.hypot(p[0], p[1], p[2]) };
      });
      chosen.current = selectTails(items, TAIL_CAP, selIndex >= 0 ? selIndex : null);
    }
    const pos = geom.attributes.position.array as Float32Array;
    const head = new Float32Array(3);
    let n = 0;
    for (const idx of chosen.current) {
      const c = comets[idx];
      const p = smallBodyPosition(c, days);
      const len = tailLengthUnits(Math.hypot(p[0], p[1], p[2]));
      toScene(c, p, head, 0);
      const dir = antiSunward([head[0], head[1], head[2]]);
      if (len <= 0 || !dir) continue; // went out of range between reselections
      pos.set([head[0], head[1], head[2], head[0] + dir[0] * len, head[1] + dir[1] * len, head[2] + dir[2] * len], n * 6);
      n++;
    }
    geom.setDrawRange(0, n * 2);
    markUpdated(geom);
  });

  return (
    <lineSegments geometry={geom} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}
