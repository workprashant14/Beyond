# BEYOND – Launch checklist

Work through this top to bottom on your own computer. Items marked (you) cannot be verified from the build sandbox.

## 1. Before deploying
- [ ] `npm install`
- [ ] `npm test` (all pass), `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [ ] (you) `npm run check:live` on a machine with internet. Exit 0 = live NASA/JPL calls work. If it prints "parse", send the output to be fixed; do not deploy a broken live panel.
- [ ] (you) `npm run dev`, open http://localhost:3000 and click through: Home, Explore (3D), a planet, the Solar System controls, Map (all 3 levels), Search, Sky Atlas, Moons, Exoplanets, Pulsars, Quasars, Compare, Distance, Tours, Milky Way.
- [ ] (you) With a production server running, `node tests/e2e/click-selection.mjs`, `tours.mjs`, `compare.mjs`, `distance.mjs`, `milky-way.mjs` (browser checks; needs Playwright).

## 2. Real-device testing (you)
- [ ] Laptop with integrated graphics: /explore stays smooth when orbiting and flying between objects.
- [ ] Phone (Android and iPhone): pinch-zoom on /map, bottom-sheet info panel, search keyboard.
- [ ] Screen reader pass (NVDA on Windows or VoiceOver on Mac/iOS) on Home, Search and an object panel. Automated axe checks pass, but a human pass is still needed.
- [ ] Browsers: Chrome, Firefox, Safari, Edge. If the 3D view shows "WebGL unavailable", that fallback is expected only on devices without WebGL.

## 3. Deploy (Vercel, free tier)
1. Push to GitHub. 2. Import on vercel.com (Next.js preset, no env vars required). 3. Deploy.
Optional: add `NASA_API_KEY` in Vercel project settings (server-only) for higher NASA rate limits. Never prefix it with NEXT_PUBLIC_.

## 4. After deploy
- [ ] Open `/api/objects/earth/live` on the live URL: JSON with `images` and `measurements` sections.
- [ ] `/robots.txt` loads, a random bad URL shows the custom 404.
- [ ] Add a custom domain in Vercel (Settings, Domains) if you want one, then set `metadataBase` in `app/layout.tsx` to that URL so share previews use absolute links.

## 5. Data honesty review
- Every value in `data/objects.json` must have a source; unknown values stay `null` ("Data unavailable").
- Visuals (galaxies, nebulae, positions, sizes, solar orbit radii) are artistic and labelled as such. Keep those labels.
- Before adding objects: copy values only from NASA/JPL/ESA pages; leave the rest `null`.

## 6. Known limitations
- Live NASA/JPL parsers were tested with synthetic fixtures and defensive error handling; the real APIs were not reachable from the build sandbox.
- Rate limiter and live-data cache are in-memory per server instance (the limiter is capped at 10,000 tracked addresses). On serverless hosting each instance counts separately, so the limit is per instance, not global. For heavy traffic, move both to a shared store (for example Upstash Redis).
- The limiter identifies callers from `X-Forwarded-For`, counting `TRUSTED_PROXY_HOPS` entries from the right (default 1: Vercel or one reverse proxy). Set it to match your hosting; a wrong value either lumps everyone into one bucket (too high) or lets callers spoof the header (host does not overwrite it). See `.env.example` and `utils/clientIp.ts`.
- Solar-system positions use JPL's approximate Keplerian elements (Standish & Williams, valid 1800 to 2050): real eccentric, inclined orbits with Kepler's equation. Six moons use JPL mean elements, with the position along each orbit illustrative. Sizes and distances are compressed in the 3D view. This replaces the earlier circular, coplanar model.
- Pluto and the catalogue-only objects have no 3D model; they open the data panel.
- Optional data you build yourself (the build sandbox cannot reach these hosts): `npm run build:exoplanets`, `build:textures`, `build:pulsars -- --file ...`, `build:quasars -- --file ...`, `build:smallbodies`. Until you run them the matching pages show an honest "not built yet" state. See README for each.
- Not yet real: measured 3D galaxy positions, spacecraft live trajectories, planets and Moon in the Night Sky, proper motion/refraction/nutation/aberration in the Sky Atlas. See ATLAS_ROADMAP.md.
- No social share image yet (add `app/opengraph-image.png`).
