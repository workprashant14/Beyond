import { Suspense } from "react";
import type { Metadata } from "next";
import SearchResults from "@/components/SearchResults";

export const metadata: Metadata = { title: "Search — BEYOND" };

export default function SearchPage() {
  return (
    <main className="nebula min-h-svh">
      <Suspense fallback={<div className="h-svh w-full" />}>
        <SearchResults />
      </Suspense>
    </main>
  );
}
