"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import StarfieldCanvas from "./StarfieldCanvas";
import SearchBar from "./SearchBar";

export default function Hero() {
  return (
    <section className="nebula relative isolate flex min-h-svh items-center overflow-hidden">
      <StarfieldCanvas />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[38vw] left-1/2 -z-10 aspect-square w-[120vw] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(91,140,255,0.35), rgba(60,40,160,0.12) 35%, transparent 62%)",
          boxShadow: "0 -2px 80px rgba(82,224,255,0.18)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-24 pt-32 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="eyebrow mb-6"
        >
          Interactive universe atlas
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl"
        >
          EXPLORE THE
          <br />
          <span className="bg-gradient-to-r from-blue via-violet to-cyan bg-clip-text text-transparent">UNIVERSE</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
        >
          Travel from our Solar System to distant galaxies. Select any catalogued object to see its real scientific
          data — and always know what is measured and what is artistic visualization.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center"
        >
          <Link
            href="/explore"
            className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-void transition hover:shadow-[0_0_40px_-6px_rgba(139,108,255,0.9)]"
          >
            Explore Universe
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <SearchBar />
        </motion.div>
      </div>

      <a
        href="#featured"
        aria-label="Scroll to featured discoveries"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted transition hover:text-ink"
      >
        <ChevronDown size={22} className="animate-bounce motion-reduce:animate-none" />
      </a>
    </section>
  );
}
