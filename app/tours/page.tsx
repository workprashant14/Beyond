import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import { TOURS } from "@/data/tours";
import { getObject } from "@/services/catalogue";

export const metadata: Metadata = { title: "Guided tours — BEYOND" };

export default function ToursPage() {
  return (
    <main className="mx-auto min-h-svh max-w-4xl px-5 py-8 sm:px-8">
      <header className="flex items-center gap-4">
        <Link href="/" aria-label="Back to home" className="glass grid h-10 w-10 place-items-center rounded-full"><ArrowLeft size={16} /></Link>
        <Logo />
      </header>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">Guided tours</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Short paths through the 3D universe. Each stop flies to an object and opens its catalogue panel; every measured value and source comes from that panel, not from the tour text.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {TOURS.map((t) => (
          <li key={t.id} className="rounded-xl border border-line p-5">
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-muted">{t.blurb}</p>
            <p className="mt-3 text-xs text-muted">{t.steps.length} stops: {t.steps.map((s) => getObject(s.id)?.name ?? s.id).join(" → ")}</p>
            <Link href={`/explore?tour=${t.id}&object=${t.steps[0].id}`} prefetch={false} className="glass mt-4 inline-flex h-9 items-center rounded-full px-4 text-xs !border-cyan/60 text-cyan">Start tour</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
