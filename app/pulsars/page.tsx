import { Suspense } from "react";
import type { Metadata } from "next";
import PulsarShell from "@/components/PulsarShell";

export const metadata: Metadata = { title: "Pulsar Atlas — BEYOND" };

export default function PulsarsPage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <PulsarShell />
      </Suspense>
    </main>
  );
}
