import { Suspense } from "react";
import type { Metadata } from "next";
import MoonsShell from "@/components/MoonsShell";

export const metadata: Metadata = { title: "Moons Atlas — BEYOND" };

export default function MoonsPage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <MoonsShell />
      </Suspense>
    </main>
  );
}
