import { useSyncExternalStore } from "react";

let cached: boolean | null = null;

function detect(): boolean {
  if (cached === null) {
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
      cached = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      cached = false;
    }
  }
  return cached;
}

const subscribe = () => () => {};

/** null while unknown (server / first render), then true or false. */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(subscribe, detect, () => null);
}
