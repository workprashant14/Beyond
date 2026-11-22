import { Suspense } from "react";
import type { Metadata } from "next";
import SkyShell from "@/components/SkyShell";

export const metadata: Metadata = { title: "Sky Atlas — BEYOND" };

export default function SkyPage() {
  return (
    <main>
      <Suspense fallback={<div className="h-svh w-full bg-void" />}>
        <SkyShell />
      </Suspense>
    </main>
  );
}
