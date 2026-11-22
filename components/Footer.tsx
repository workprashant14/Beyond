import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-void">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Explore what lies beyond. An interactive universe atlas where measured science and artistic visualization
            are always clearly separated.
          </p>
        </div>
        <div>
          <h4 className="eyebrow mb-4">Navigate</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li><Link href="/explore" className="hover:text-ink">Explore</Link></li>
            <li><Link href="/map" className="hover:text-ink">Cosmic Map</Link></li>
            <li><Link href="/#solar-system" className="hover:text-ink">Solar System</Link></li>
            <li><Link href="/#popular" className="hover:text-ink">Objects</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow mb-4">Data sources</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li><a className="hover:text-ink" href="https://science.nasa.gov/" target="_blank" rel="noreferrer">NASA Science</a></li>
            <li><a className="hover:text-ink" href="https://ssd.jpl.nasa.gov/" target="_blank" rel="noreferrer">NASA JPL Solar System Dynamics</a></li>
            <li><a className="hover:text-ink" href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">NASA Exoplanet Archive</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-5 py-6 text-center text-xs text-muted sm:px-8">
        © BEYOND. Not affiliated with NASA. Visuals are artistic unless labelled otherwise.
      </div>
    </footer>
  );
}
