"use client";

import { useEffect, useState } from "react";
import type { SmallBodyFile } from "@/utils/smallBodies";

let pending: Promise<SmallBodyFile | null> | null = null;
const load = (): Promise<SmallBodyFile | null> => {
  pending ??= fetch("/smallbodies/bodies.json")
    .then((r) => (r.ok ? (r.json() as Promise<SmallBodyFile>).then((f) => (f.bodies.length > 0 ? f : null)) : null))
    .catch(() => null);
  return pending;
};

export type SmallBodyState = { status: "loading" } | { status: "missing" } | { status: "ready"; file: SmallBodyFile };

/** Loading state of the small-body file: "missing" means it was not built (the shipped placeholder holds no bodies). */
export function useSmallBodyState(): SmallBodyState {
  const [state, setState] = useState<SmallBodyState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    load().then((f) => { if (alive) setState(f ? { status: "ready", file: f } : { status: "missing" }); });
    return () => { alive = false; };
  }, []);
  return state;
}

/** The asteroid and comet file built by `npm run build:smallbodies`, or null when it is not (yet) available. */
export function useSmallBodies(): SmallBodyFile | null {
  const s = useSmallBodyState();
  return s.status === "ready" ? s.file : null;
}
