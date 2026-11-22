import Link from "next/link";
import { Orbit, Map, ScanSearch, ShieldCheck } from "lucide-react";
import SectionHeading from "./SectionHeading";

const PILLARS = [
  { icon: Orbit, title: "3D exploration", text: "Fly through a real-time scene with orbit, zoom and pan controls built for ordinary laptops." },
  { icon: Map, title: "2D cosmic map", text: "A zoomable chart that separates catalogued objects from illustrative backdrop." },
  { icon: ScanSearch, title: "Universal search", text: "Find planets, galaxies, nebulae, black holes and exoplanets in one place." },
  { icon: ShieldCheck, title: "Honest science", text: "Every value carries a source. Missing data says “Data unavailable” — never a guess." },
];

export default function DiscoverySection() {
  return (
    <section id="discover" className="relative scroll-mt-20 border-t border-line bg-navy/60 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Space discovery"
          title="Built to explore, designed to be trusted"
          text="BEYOND combines a cinematic interface with a rigorous data model so you can tell measurement from artistic visualization."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-void p-8">
              <Icon size={22} className="text-cyan" aria-hidden />
              <h3 className="mt-6 text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-14">
          <Link
            href="/explore"
            className="inline-block rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-void transition hover:shadow-[0_0_40px_-6px_rgba(139,108,255,0.9)]"
          >
            Begin exploring
          </Link>
        </div>
      </div>
    </section>
  );
}
