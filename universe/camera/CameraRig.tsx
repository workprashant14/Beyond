"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { getBody } from "@/universe/engine/bodyRegistry";

export interface FocusTarget {
  /** Changes whenever a new focus should be animated. */
  key: string;
  position: [number, number, number];
  distance: number;
  /** If set, the camera keeps following this registered moving body. */
  followId?: string;
}

export interface HomeView {
  /** Changes when the camera should jump to a new default view (e.g. entering the Solar System). */
  key: string;
  position: [number, number, number];
  target: [number, number, number];
}

type Controls = React.ComponentRef<typeof OrbitControls>;

/**
 * OrbitControls (rotate / zoom / pan) plus a smooth fly-to animation and
 * optional following of moving bodies. The fly-to stops as soon as the user
 * grabs the controls; following continues until the selection changes.
 */
export default function CameraRig({ focus, home }: { focus: FocusTarget | null; home: HomeView }) {
  const controls = useThree((s) => s.controls) as Controls | null;
  const camera = useThree((s) => s.camera);
  const reduce = useReducedMotion();
  const anim = useRef<{ target: THREE.Vector3; distance: number } | null>(null);
  const followId = useRef<string | null>(null);
  const last = useRef(new THREE.Vector3());
  const hasLast = useRef(false);
  const live = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());

  // Home view first, so a focus animation set below starts from the right place.
  useEffect(() => {
    if (!controls) return;
    camera.position.set(...home.position);
    controls.target.set(...home.target);
    controls.update();
    hasLast.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.key, controls]);

  useEffect(() => {
    anim.current = focus ? { target: new THREE.Vector3(...focus.position), distance: focus.distance } : null;
    followId.current = focus?.followId ?? null;
    hasLast.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      anim.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    if (!controls) return;
    const a = anim.current;

    // Follow a moving body: shift camera and target by how far it moved this frame.
    const body = followId.current ? getBody(followId.current) : undefined;
    if (body) {
      body.getWorldPosition(live.current);
      if (hasLast.current) {
        offset.current.copy(live.current).sub(last.current);
        controls.target.add(offset.current);
        camera.position.add(offset.current);
      }
      last.current.copy(live.current);
      hasLast.current = true;
      if (a) a.target.copy(live.current);
    }

    if (!a) {
      if (body) controls.update();
      return;
    }
    const k = reduce ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    controls.target.lerp(a.target, k);
    offset.current.copy(camera.position).sub(controls.target);
    const len = offset.current.length();
    const next = len + (a.distance - len) * k;
    offset.current.setLength(next);
    camera.position.copy(controls.target).add(offset.current);
    controls.update();
    if (controls.target.distanceTo(a.target) < 0.05 && Math.abs(next - a.distance) < 0.1) anim.current = null;
  });

  return (
    <OrbitControls
      makeDefault
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={900}
      zoomSpeed={0.9}
    />
  );
}
