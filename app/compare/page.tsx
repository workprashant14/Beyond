import { Suspense } from "react";
import type { Metadata } from "next";
import CompareShell from "@/components/CompareShell";

export const metadata: Metadata = { title: "Compare objects — BEYOND" };

export default function ComparePage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <CompareShell />
      </Suspense>
    </main>
  );
}
