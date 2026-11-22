import { Suspense } from "react";
import type { Metadata } from "next";
import ExoShell from "@/components/ExoShell";

export const metadata: Metadata = { title: "Exoplanet Atlas — BEYOND" };

export default function ExoplanetsPage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <ExoShell />
      </Suspense>
    </main>
  );
}
