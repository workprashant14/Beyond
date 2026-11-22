import { Suspense } from "react";
import type { Metadata } from "next";
import DistanceShell from "@/components/DistanceShell";

export const metadata: Metadata = { title: "Distance between bodies — BEYOND" };

export default function DistancePage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <DistanceShell />
      </Suspense>
    </main>
  );
}
