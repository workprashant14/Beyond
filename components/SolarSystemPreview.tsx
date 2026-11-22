import Link from "next/link";
import SectionHeading from "./SectionHeading";

/**
 * Static CSS preview of the Solar System. Illustrative only: orbit spacing and
 * body sizes are NOT to scale (see the note in the UI). Real orbital data
 * arrives with the 3D solar system in Phase 3.
 */
const BODIES = [
  { id: "mercury", name: "Mercury", r: 14, size: 5, color: "#a8a29e", dur: 14 },
  { id: "venus", name: "Venus", r: 22, size: 8, color: "#e8c98a", dur: 22 },
  { id: "earth", name: "Earth", r: 31, size: 9, color: "#5b8cff", dur: 30 },
  { id: "mars", name: "Mars", r: 40, size: 7, color: "#d9694a", dur: 40 },
  { id: "jupiter", name: "Jupiter", r: 52, size: 18, color: "#d8b48a", dur: 60 },
  { id: "saturn", name: "Saturn", r: 63, size: 15, color: "#e6d3a3", dur: 80 },
  { id: "uranus", name: "Uranus", r: 73, size: 11, color: "#7fe0e8", dur: 100 },
  { id: "neptune", name: "Neptune", r: 83, size: 11, color: "#4d6fff", dur: 120 },
];

export default function SolarSystemPreview() {
  return (
    <section id="solar-system" className="relative scroll-mt-20 overflow-hidden border-y border-line bg-navy/60 py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Solar system"
            title="Eight planets. One star. Every orbit alive."
            text="The full 3D solar system with real relative orbital data, adjustable time speed and clickable planets is the next milestone. This is a visual preview."
          />
          <p className="mt-6 inline-block rounded-lg border border-line px-3 py-2 text-xs text-muted">
            Illustration — sizes and distances are not to scale.
          </p>
          <div className="mt-8">
            <Link
              href="/explore?object=sun"
              className="rounded-full border border-line px-6 py-3 text-sm transition hover:border-cyan/60"
            >
              Open the Sun
            </Link>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[560px]" role="group" aria-label="Illustration of the eight planets orbiting the Sun, not to scale. Each planet is a link.">
          <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd27a] shadow-[0_0_60px_18px_rgba(255,180,70,0.45)]" />
          {BODIES.map((b) => (
            <div
              key={b.id}
              className="absolute left-1/2 top-1/2 rounded-full border border-white/10"
              style={{ width: `${b.r * 2}%`, height: `${b.r * 2}%`, transform: "translate(-50%, -50%)" }}
            >
              <div
                className="absolute inset-0 motion-safe:animate-[spin_var(--d)_linear_infinite]"
                style={{ ["--d" as string]: `${b.dur}s` }}
              >
                <Link
                  href={`/explore?object=${b.id}`}
                  aria-label={b.name}
                  title={b.name}
                  className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-150"
                  style={{ width: b.size, height: b.size, background: b.color, boxShadow: `0 0 10px ${b.color}88` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
