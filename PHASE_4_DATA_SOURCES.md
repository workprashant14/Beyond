# Phase 4 — data sources (in progress)

| Data | File | Source | Notes |
|---|---|---|---|
| Planet Keplerian elements | `data/keplerElements.ts` | JPL SSD "Approximate Positions of the Major Planets", Table 1 (Standish & Williams), valid 1800–2050 | Earth row = Earth-Moon barycentre |
| Mean satellite elements (6 moons) | `data/keplerElements.ts` | JPL SSD "Planetary Satellite Mean Elements" | Not an ephemeris; position on orbit is illustrative |
| Gravitational parameters (GM) | `data/gm.ts` | JPL SSD "Astrodynamic Parameters" (https://ssd.jpl.nasa.gov/astro_par.html), values from DE440 (Park et al. 2021); read 2026-11-16 | Read through a summarising fetch tool; Earth+Moon sum and Sun/Jupiter ratio cross-checked in tests |
| Leap seconds, TT, TDB | `utils/timeScales.ts` | IERS leap-second table; TDB−TT two-term series | Checked against astropy/ERFA (`tests/fixtures/time-oracle.json`) |
| Barycentre oracle (tests only) | `tests/fixtures/barycentre-oracle.json` | astropy `builtin` ephemeris (ERFA epv00) | Independent of JPL elements; not shipped to users |
| Dwarf-planet and asteroid orbits | `public/smallbodies/bodies.json` (built by you) | JPL Small-Body Database query API, `npm run build:smallbodies` | **Not present in this sandbox** (placeholder with 0 bodies). Which bodies are featured: `utils/featuredBodies.ts` |
| Kuiper belt, scattered disc, Oort cloud extents | `utils/conceptualRegions.ts` | NASA Solar System Exploration (Kuiper Belt fact sheet, Oort Cloud pages), Sky at Night Magazine; read 2026-11-16 through a summarising fetch tool | Only the radial extents are sourced; dots are random and labelled Artistic/Theoretical |
| Comet tail direction and length trend | `utils/cometTail.ts` | NASA Space Place, "What Is a Comet?" (spaceplace.nasa.gov/comets/en/), read 2026-11-16 | Only "ion tail always points directly away from the Sun" and "tails get longer closer to the Sun" are sourced. The 3 au limit and the lengths are display choices |
| Which bodies have an atmosphere (glow) | `data/atmospheres.ts` | General planetary-science knowledge (Venus, Earth, Mars, giant planets, Titan have substantial atmospheres); no numbers used | Appearance is artistic; presence not re-verified against a citation in this sandbox |
| Satellite mean elements (NOT yet used) | none | JPL SSD Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/sep.html), structure read 2026-11-16 | Only the page structure was learned; no element values were transcribed. See `PHASE_4_MOON_PIPELINE_PLAN.md` |
| Moons (177 names, no orbits) | `public/solar/moons.json` | earlier build | Not verified as "all known moons"; see audit |
