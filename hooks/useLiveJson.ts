import { useCallback, useEffect, useSyncExternalStore } from "react";

export type LiveState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

const LOADING: LiveState<never> = { status: "loading" };
const states = new Map<string, LiveState<unknown>>();
const listeners = new Set<() => void>();
const inflight = new Map<string, AbortController>();
const emit = () => listeners.forEach((l) => l());

async function load(url: string) {
  if (inflight.has(url)) return;
  const ctrl = new AbortController();
  inflight.set(url, ctrl);
  states.set(url, LOADING);
  emit();
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) throw new Error("Too many requests — try again in a minute.");
    if (!res.ok) throw new Error("Live data is not available right now.");
    states.set(url, { status: "ready", data: await res.json() });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") states.delete(url);
    else states.set(url, { status: "error", message: e instanceof Error ? e.message : "Live data is not available right now." });
  } finally {
    inflight.delete(url);
    emit();
  }
}

/** Fetch a same-origin JSON endpoint once per session (module-level cache, shared by every component). */
export function useLiveJson<T>(url: string): { state: LiveState<T>; retry: () => void } {
  const subscribe = useCallback((cb: () => void) => { listeners.add(cb); return () => void listeners.delete(cb); }, []);
  const state = useSyncExternalStore(subscribe, () => (states.get(url) ?? LOADING) as LiveState<T>, () => LOADING as LiveState<T>);
  useEffect(() => {
    if (!states.has(url)) void load(url);
    return () => inflight.get(url)?.abort();
  }, [url]);
  const retry = useCallback(() => { states.delete(url); void load(url); }, [url]);
  return { state, retry };
}
