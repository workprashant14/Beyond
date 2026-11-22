import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="BEYOND home" className={`group inline-flex items-center gap-3 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center" aria-hidden>
        <span className="absolute inset-0 rounded-full border border-cyan/60" />
        <span className="absolute inset-[5px] rounded-full border border-violet/50 transition-transform duration-700 group-hover:rotate-180" style={{ borderTopColor: "transparent" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_2px_rgba(82,224,255,0.8)]" />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-[0.42em] text-ink">BEYOND</span>
    </Link>
  );
}
