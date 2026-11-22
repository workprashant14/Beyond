import { Suspense } from "react";
import type { Metadata } from "next";
import ExplorerShell from "@/components/ExplorerShell";

export const metadata: Metadata = { title: "Explore — BEYOND" };

export default function ExplorePage() {
  return (
    <main>
      <Suspense fallback={<div className="h-svh w-full bg-void" />}>
        <ExplorerShell />
      </Suspense>
    </main>
  );
}
