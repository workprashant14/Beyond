import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="nebula grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-md">
        <Logo />
        <p className="eyebrow mt-10">Lost in space</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">This page doesn’t exist</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The link may be old or mistyped. Search the catalogue or head back to the start.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-void">Home</Link>
          <Link href="/explore" prefetch={false} className="glass rounded-full px-6 py-3 text-sm text-ink hover:border-cyan/60">Explore 3D</Link>
          <Link href="/search" className="glass rounded-full px-6 py-3 text-sm text-ink hover:border-cyan/60">Search</Link>
        </div>
      </div>
    </main>
  );
}
