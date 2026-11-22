"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import Logo from "./Logo";

/** Always visible on a wide window. */
const PRIMARY = [
  { href: "/explore", label: "Explore" },
  { href: "/sky", label: "Sky Atlas" },
  { href: "/moons", label: "Moons" },
  { href: "/missions", label: "Missions" },
  { href: "/exoplanets", label: "Exoplanets" },
  { href: "/tours", label: "Tours" },
  { href: "/compare", label: "Compare" },
];
/** Under "More" on a wide window (all fifteen links in one row do not fit in under about 1700 px). */
const MORE = [
  { href: "/pulsars", label: "Pulsars" },
  { href: "/quasars", label: "Quasars" },
  { href: "/distance", label: "Distance" },
  { href: "/milky-way", label: "Milky Way" },
  { href: "/map", label: "Cosmic Map" },
  { href: "/#solar-system", label: "Solar System" },
  { href: "/#popular", label: "Objects" },
  { href: "/#discover", label: "Discover" },
];
const LINKS = [...PRIMARY, ...MORE];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <li ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
      >
        More <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <ul className="glass absolute right-0 top-full z-50 mt-3 max-h-[calc(100dvh-6rem)] w-48 overflow-y-auto overscroll-contain rounded-xl p-2">
          {MORE.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-white/5">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open ? "glass border-x-0 border-t-0" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
        <Logo />

        <ul className="hidden items-center gap-7 xl:flex">
          {PRIMARY.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
          <MoreMenu />
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="hidden rounded-full border border-line px-5 py-2 text-sm text-ink transition hover:border-cyan/60 hover:shadow-[0_0_24px_-6px_rgba(82,224,255,0.6)] xl:inline-block"
          >
            Launch
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open && (
        <ul className="mx-auto flex max-h-[calc(100dvh-4rem)] max-w-7xl flex-col gap-1 overflow-y-auto overscroll-contain px-5 pb-5 xl:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-3 text-base text-ink hover:bg-white/5"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
