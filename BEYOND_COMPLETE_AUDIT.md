# BEYOND — Complete Audit (Phase 1)

Date: 2026-11-15. Method: code read + actual generated files counted in this sandbox. The sandbox cannot reach NASA/JPL/SDSS hosts and does not have your `Beyond Data/` folder, so anything that depends on those is marked **not verified here**.
Last verified project state: `npm test` 167/167, `tsc` 0, lint 0, `next build` ok. **No browser verification of the whole site has been done in this audit** (individual features had Playwright checks in earlier increments: click-selection, compare, tours, distance, milky-way).

Classes: COMPLETE-VERIFIED (CV) · IMPLEMENTED-INCOMPLETE (II) · PRESENT-NOT-CONNECTED (PNC) · SCIENTIFICALLY-INACCURATE (SI) · BROKEN (B) · MISSING (M). Nothing is called "complete" here without a test that I ran.

## 1. Routes
`/`, `/explore`, `/map`, `/sky`, `/search`, `/moons`, `/exoplanets`, `/pulsars`, `/quasars`, `/compare`, `/distance`, `/tours`, `/milky-way`; API: `/api/objects/[id]/live`, `/api/sky/dso/[id]`, `/api/sky/star/[hip]`.
No route for: asteroids/comets (only inside the Solar System scene), constellations (inside `/sky`), black holes/nebulae pages, star atlas as its own page (inside `/sky`).

## 2. Feature classification (code AND data)

| Feature | Class | Evidence |
|---|---|---|
| Hipparcos stars, mag ≤ 6 | CV (data) | `public/sky/stars.json` n = 5,044 (hip array 5,044). Source d3-celestial. Not Gaia. |
| Star physical data | II | `starphys.json` n = 5,044 (distance/spectral type from AT-HYG extract); no radial velocity, mass, radius, age, uncertainties beyond what the script keeps. |
| 88 IAU constellations (lines, labels, bounds) | CV (data) | `constellations.json` = 88 entries with `lines`, `labels`, `bounds`. Boundaries toggle exists in `SkyShell`. The constellation panel exists (brightest star, star count, named-star buttons that open the star). **Update 2026-11-17:** "Area on the sky" was Data unavailable; it now shows the published IAU area and size rank (browser-tested). |
| Deep-sky catalogue | II | 542 bright + 11,552 faint = 12,094 (OpenNGC, CC-BY-SA). Categories from OpenNGC types only; no distances/redshift for most; no images. |
| Moons | II | `moons.json` 177 records (data only). 3D: moons orbit in the scene only for the few with elements; most are catalogue rows. |
| Solar System 3D | II | 8 planets + dwarf planets with JPL approximate Keplerian elements (valid 1800–2050, documented). Inclination/eccentricity used. Missing: Phobos/Deimos/Galilean/Titan 3D orbits in all cases not confirmed, no Saturn-moon system, no asteroid belt/Kuiper belt from real data, no eclipses/shadows, no normal/bump maps, no atmospheric scattering. |
| Planet photo textures | II | Pipeline + honest credit logic done (verified by tests). **Zero photographs installed** (`public/textures/index.json` has `textures: []`); all surfaces are procedural/artistic. Mercury blocked (rights unverified). |
| Exoplanets | II (data absent) | Builder + UI + integrity logic exist and are tested with fixtures. **`public/exoplanets/` is empty here**; 6,470 records were generated on your machine, not in this project copy. No 3D systems. |
| Pulsars | II (data absent) | Builder/UI exist; `public/pulsars/` does not exist in this copy. No beam/rotation visualisation, no binary orbits. |
| Quasars | II / B for stated goal | `scripts/build-quasars.ts` is **CSV-only** (100–50,000 rows). No FITS pipeline, no chunking/index/spatial index, no `public/quasars/`. Requirement §11 is **MISSING**. |
| Asteroids & comets | II (data absent) | `public/smallbodies/bodies.json` is a placeholder (0 asteroids, 0 comets, source "none"). Builder fixed (comet query) but never run against JPL from here. |
| Missions | M (as module) | Only 7 `spacecraft` entries in `data/objects.json`. **Update 2026-11-17:** `/missions` page lists them (time since launch, signal time for NASA-stated distances; see status doc). Still no trajectories or milestones (need JPL Horizons data). |
| Night sky | II / SI | Alt/az, horizon, time, precession exist. Planets and Moon **not in the sky view**. No refraction, nutation, aberration, phases. **Update 2026-11-17:** proper motion is now applied in time travel and star/DSO rise-transit-set times are shown (both Estimated, see status doc). |
| Search | II | Global search covers the 51 hand-curated `objects.json`, the moons atlas and (in the sky) stars/DSOs. Pulsars/quasars/exoplanets are not in the unified index (they have their own searches). |
| Nebulae / black holes | II | Procedural `NebulaCloud`, `BlackHole` in scene; labelled illustrative (verify per object). 3 black holes, 3 nebulae in curated set only. No real images, no Schwarzschild-radius explainer. |
| Milky Way / galaxies / large-scale | II | `/milky-way` structure page (artistic + measured landmarks) and `/map`. No galaxy groups/clusters/superclusters/cosmic web from data; no measured 3D galaxy positions. |
| Compare, Distance, Tours | CV (own tests + e2e) | tests + Playwright scripts. |
| Share link / URL object | II | `/explore` and `/sky` read params; coordinate copy not verified everywhere. |
| Live data (NASA/SIMBAD) | II | Routes exist with `clientIp` + in-memory rate limiter; **never run against the live APIs from here**. Limiter is per-process (not shared on serverless). |
| Security | II | Security headers set; no client secrets found. Rate limiter in-memory only. |

## 3. Counts that match / do not match the historical checkpoints
- Matches: 5,044 stars, 88 constellations, 12,094 DSOs, 177 moons.
- **Not present in this project copy**: 6,470 exoplanets, 4,503 pulsars, 1,200 small bodies, any quasar data. They are either on your machine only or were never committed. Their numbers are **unverified** until I see the files or you run the builders.

## 4. Missing files / functions / datasets / integrations
- `scripts/build-quasars-fits.*` (Astropy), chunked output (`meta.json`, search index, spatial index, detail chunks), loader in `utils/quasars.ts`, UI paging.
- Datasets: Gaia subset, SDSS DR16Q (FITS on your PC), JPL SBDB output, ATNF output, NASA Exoplanet Archive output (none in this copy), galaxy catalogues with distances (e.g. NED/HyperLEDA, 2MRS), globular clusters, mission trajectories (JPL Horizons).
- Missing deliverable docs: `BEYOND_IMPLEMENTATION_STATUS.md`, `BEYOND_DATA_SOURCES.md`, `BEYOND_DATA_DICTIONARY.md`, `BEYOND_DEPLOYMENT.md` (this file starts the series).
- Sandbox has no `astropy` (installable with pip, but cannot read your 1.7 GB file).

## 5. Scientific concerns
1. Planet orbits use approximate elements (accuracy minutes of arc, 1800–2050) — fine if labelled; keep labels.
2. Procedural textures must never be shown as photographs (credit logic now enforces this).
3. Star 3D placement relies on Hipparcos parallax; stars with poor/missing parallax must show "distance unavailable" — verify in `StarSystem`/sky.
4. Exoplanet `*lim` flag meaning is only partly documented; raw values are kept, not interpreted.
5. Scene distances/sizes are compressed (`solarScale.ts`); the UI must state this — verify the notice is visible on every scale.

## 6. Performance
- Largest shipped file: `dsos-faint.json` 901 KB (acceptable). No chunking exists yet because no big dataset ships.
- Quasar 750k rows impossible in-browser as one file → needs the chunk architecture in §4.
- No measured frame rates yet. Profile on Intel iGPU is **not done**.

## 7. Plan (next safe units, in order)
1. Phase 2: quasar FITS pipeline (Astropy, batches, sentinel handling per SDSS docs, chunked output) + tests on a small synthetic FITS (clearly synthetic); you run it on the real file.
2. Phase 2: add data-absent states and a `data:status` script that reports which generated datasets exist and their counts.
3. Phase 4/8 items already in the Phase-1 audit queue (Night Sky planets/Moon) — still waiting on your 4 answers in `PHASE1_AUDIT.md`.
4. Docs: sources, dictionary, deployment, status.

Honest scope note: the brief is many weeks of work; each unit will be built, tested and reported before the next. Features stay "incomplete" here until verified.
