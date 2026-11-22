import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { FACTS, UNVERIFIED, R0_GRAVITY_PC, DISK_DIAMETER_LY, ARM_PITCH_DEG, parsecsToLy } from "@/data/milkyWayStructure";
import { logSpiral } from "@/utils/spiral";

export const metadata: Metadata = { title: "Milky Way structure — BEYOND" };

const S = 300; // svg half-size
const R = 270; // disk radius in svg units = 50,000 ly
const sunR = (parsecsToLy(R0_GRAVITY_PC) / (DISK_DIAMETER_LY / 2)) * R;
const R_IN = 0.2 * R;
const turns = Math.log(R / R_IN) / Math.tan((ARM_PITCH_DEG * Math.PI) / 180) / (2 * Math.PI);
const arms = [0, 90, 180, 270].map((deg) => logSpiral(R_IN, ARM_PITCH_DEG, (deg * Math.PI) / 180, turns, 120));
const toPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${(S + x).toFixed(1)},${(S + y).toFixed(1)}`).join(" ");

export default function MilkyWayPage() {
  return (
    <main className="mx-auto min-h-svh max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Milky Way structure</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Our galaxy seen from above, with the measurements astronomers have published. Astronomers cannot photograph the Milky Way from outside, so every top-down picture is a model. This page keeps the drawing and the measurements apart and says which is which.
      </p>

      <figure className="mt-8">
        <div className="mx-auto max-w-md text-cyan">
          <svg viewBox={`0 0 ${2 * S} ${2 * S}`} role="img" aria-label="Schematic top-down view of the Milky Way: a central bar, four idealised spiral arms, and the Sun marked about 54 percent of the way out from the centre" className="w-full">
            <circle cx={S} cy={S} r={R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 6" />
            {arms.map((a, i) => <path key={i} d={toPath(a)} fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" />)}
            <ellipse cx={S} cy={S} rx={R_IN * 1.15} ry={R_IN * 0.4} transform={`rotate(-30 ${S} ${S})`} fill="currentColor" fillOpacity="0.35" />
            <circle cx={S} cy={S} r="5" fill="#ffd27a" />
            <circle cx={S} cy={S + sunR} r="7" fill="#ffd27a" stroke="#fff" strokeWidth="1.5" />
            <text x={S + 14} y={S + sunR + 4} fontSize="16" fill="currentColor" className="fill-current text-ink">Sun</text>
            <text x={S + 12} y={S - 10} fontSize="14" fill="currentColor" className="fill-current text-muted">centre (Sgr A*)</text>
          </svg>
        </div>
        <figcaption className="mt-4 text-xs leading-relaxed text-muted">
          <ProvenanceBadge kind="artistic" />
          <span className="mt-2 block">
            Idealised drawing, not a map. Four identical logarithmic spirals with the ~{ARM_PITCH_DEG}° average pitch angle quoted by Reid et al. (2019); where each arm really lies, the bar&apos;s true length and angle, and the arms&apos; names are not shown. The dashed circle is a {DISK_DIAMETER_LY.toLocaleString("en-US")} light-year disk (secondary source). The Sun is placed at the measured distance from the centre (8,277 pc, about 27,000 light-years) relative to that disk; its angle around the centre is arbitrary.
          </span>
        </figcaption>
      </figure>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">What has been measured</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {FACTS.map((f) => (
          <li key={f.id} className="py-4 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
              <h3 className="text-muted">{f.label}</h3>
              <p className="text-ink sm:max-w-md sm:text-right">{f.value}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><ProvenanceBadge kind={f.kind} /></div>
            {f.note && <p className="mt-2 text-xs leading-relaxed text-muted">{f.note}</p>}
            <p className="mt-2 text-xs text-muted">
              Source: <a href={f.source.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-ink hover:underline">{f.source.label}</a>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">Not shown, because I could not verify it</h2>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
        {UNVERIFIED.map((u) => <li key={u}>{u}</li>)}
      </ul>

      <p className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link href="/explore?object=milky-way" prefetch={false} className="glass inline-flex h-9 items-center rounded-full px-4 text-xs !border-cyan/60 text-cyan">Open the Milky Way in 3D</Link>
        <Link href="/explore?object=sgr-a" prefetch={false} className="glass inline-flex h-9 items-center rounded-full px-4 text-xs hover:border-cyan/60">Sagittarius A*</Link>
        <Link href="/distance" className="glass inline-flex h-9 items-center rounded-full px-4 text-xs hover:border-cyan/60">Distances in the Solar System</Link>
      </p>
    </main>
  );
}
