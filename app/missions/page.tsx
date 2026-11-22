import type { Metadata } from "next";
import MissionsShell from "@/components/MissionsShell";

export const metadata: Metadata = { title: "Missions — BEYOND" };

export default function MissionsPage() {
  return (
    <main>
      <MissionsShell />
    </main>
  );
}
