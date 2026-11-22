import * as THREE from "three";

/**
 * Small procedural textures shared by every object (generated once, so no
 * image downloads and no per-object GPU memory). Client-only: call from
 * components rendered inside the Canvas.
 */
let glow: THREE.CanvasTexture | null = null;
let disk: THREE.CanvasTexture | null = null;

function makeTexture(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function getGlowTexture(): THREE.CanvasTexture {
  glow ??= makeTexture((g, s) => {
    const r = s / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.2, "rgba(255,255,255,0.5)");
    gr.addColorStop(0.55, "rgba(255,255,255,0.12)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
  return glow;
}

/** Radial accretion-disk gradient. Pairs with a ringGeometry whose inner/outer ratio is 0.3. */
export function getDiskTexture(): THREE.CanvasTexture {
  disk ??= makeTexture((g, s) => {
    const r = s / 2;
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.3, "rgba(255,230,190,0)");
    gr.addColorStop(0.38, "rgba(255,240,215,1)");
    gr.addColorStop(0.55, "rgba(255,150,70,0.65)");
    gr.addColorStop(1, "rgba(120,40,10,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }, 256);
  return disk;
}
