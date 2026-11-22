import { Suspense } from "react";
import type { Metadata } from "next";
import MapShell from "@/components/MapShell";

export const metadata: Metadata = { title: "Cosmic Map — BEYOND" };

export default function MapPage() {
  return (
    <main>
      <Suspense fallback={<div className="h-svh w-full bg-void" />}>
        <MapShell />
      </Suspense>
    </main>
  );
}
