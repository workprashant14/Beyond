import { Suspense } from "react";
import type { Metadata } from "next";
import QuasarShell from "@/components/QuasarShell";

export const metadata: Metadata = { title: "Quasar Atlas — BEYOND" };

export default function QuasarsPage() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-svh bg-void" />}>
        <QuasarShell />
      </Suspense>
    </main>
  );
}
