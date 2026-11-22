import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { LiveResponse } from "@/services/live/types";

type State = { status: "loading" } | { status: "ready"; data: LiveResponse } | { status: "error"; message: string };

/** Module-level store: switching between objects never refetches what we already have this session. */
const states = new Map<string, State>();
const listeners = new Set<() => void>();
const inflight = new Map<string, AbortController>();
const LOADING: State = { status: "loading" };
const emit = () => listeners.forEach((l) => l());

async function load(id: string) {
  if (inflight.has(id)) return;
  const ctrl = new AbortController();
  inflight.set(id, ctrl);
  states.set(id, LOADING);
  emit();
  try {
    const res = await fetch(`/api/objects/${encodeURIComponent(id)}/live`, { signal: ctrl.signal });
    if (res.status === 429) throw new Error("Too many requests — try again in a minute.");
    if (!res.ok) throw new Error("Live data is not available right now.");
    states.set(id, { status: "ready", data: (await res.json()) as LiveResponse });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      states.delete(id);
    } else {
      states.set(id, { status: "error", message: e instanceof Error ? e.message : "Live data is not available right now." });
    }
  } finally {
    inflight.delete(id);
    emit();
  }
}

export function useLiveData(id: string): { state: State; retry: () => void } {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  }, []);
  const state = useSyncExternalStore(
    subscribe,
    () => states.get(id) ?? LOADING,
    () => LOADING,
  );

  useEffect(() => {
    if (!states.has(id)) void load(id);
    return () => inflight.get(id)?.abort(); // leaving the object cancels its request
  }, [id]);

  const retry = useCallback(() => {
    states.delete(id);
    void load(id);
  }, [id]);
  return { state, retry };
}
