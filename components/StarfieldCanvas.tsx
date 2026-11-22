"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  hue: number;
}

/**
 * Lightweight 2D-canvas starfield for the landing page. Deliberately not WebGL
 * so the homepage stays smooth on integrated graphics; the real 3D universe
 * lives in /explore.
 */
export default function StarfieldCanvas({ density = 0.00028 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;
    let mx = 0;
    let my = 0;
    let tmx = 0;
    let tmy = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(900, Math.floor(w * h * density));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        r: Math.random() * 1.2 + 0.2,
        tw: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.18 ? 215 : Math.random() < 0.1 ? 265 : 0,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      mx += (tmx - mx) * 0.04;
      my += (tmy - my) * 0.04;
      for (const s of stars) {
        const px = s.x + mx * s.z * 26;
        const py = s.y + my * s.z * 26;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.0008 * (0.4 + s.z) + s.tw));
        ctx.globalAlpha = a * (0.4 + s.z * 0.6);
        ctx.fillStyle = s.hue ? `hsl(${s.hue} 90% 80%)` : "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, s.r * (0.6 + s.z * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      tmx = e.clientX / window.innerWidth - 0.5;
      tmy = e.clientY / window.innerHeight - 0.5;
    };

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    resize();
    window.addEventListener("resize", resize);

    if (reduce) {
      draw(0);
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
