# Phase 4 — Solar System status

**Phase 4 is NOT complete.** This file lists only what has been built and verified so far. See `PHASE_4_SOLAR_SYSTEM_AUDIT.md` for the gap list.

## Done and verified

| Unit | What | How it was verified |
|---|---|---|
| 1. Time scales | `utils/timeScales.ts`: Julian Date, UTC→TAI→TT→TDB (leap seconds 1972–2017; TDB−TT periodic term within 50 µs), validity range of the JPL approximate planet elements (1800–2050) | `tests/timescales.test.ts` against astropy-generated fixtures (`tests/fixtures/time-oracle.json`, `planets-oracle.json`) |
| 2. Simulation clock | `utils/simClock.ts`: the clock value is TDB days since J2000; typed and displayed dates are UTC. Play/pause, speeds 0.1–100 days/s, reverse, jump to a date, stops at 1800-01-01 and 2050-01-01 with a visible warning, reset to today | `tests/simclock.test.ts` (5 tests), real-browser run `tests/e2e/sim-clock.mjs` (desktop + mobile, 21 checks, axe 0 violations, no console errors) |
| 2. Scale disclosure | `universe/objects/scaleReadout.ts`: for the selected body, real distance and radius next to how much larger it is drawn than true scale at the drawn orbit scale. Bodies without elements show "Data unavailable" | `tests/scalereadout.test.ts` |

| 3. State vectors and barycentre | `utils/stateVectors.ts` + `data/gm.ts`: heliocentric and barycentric position (km) and velocity (km/s) for Mercury to Neptune (Earth = Earth-Moon barycentre), and the Sun's offset from the Solar System barycentre using JPL DE440 planet-system GM values. Does not import any visual-scale code. Readout shows orbital speed and the Sun's barycentre offset | `tests/statevectors.test.ts` (7 tests): vis-viva, derivative check, angular momentum, momentum balance, and an independent astropy/ERFA oracle (`tests/fixtures/barycentre-oracle.json`, 12 dates 1900-2100): worst Sun offset error 2,474 km, Earth velocity 0.0021 km/s, Earth position 0.00008 au. Browser: `tests/e2e/sim-clock.mjs` |
| 4. Dwarf planets and large asteroids in the scene | `utils/featuredBodies.ts`, `universe/objects/SmallBodies.tsx`, `components/SolarControls.tsx`: Pluto, Ceres, Eris, Haumea, Makemake (the five IAU dwarf planets) plus Vesta, Pallas, Hygiea get a marker, label, orbit line and a quick-select chip. Orbits come only from the JPL SBDB file built by `npm run build:smallbodies`; a body missing from that file is listed as "Not in the built file", and with no file the panel says "Data unavailable" | `tests/featuredbodies.test.ts` (3 tests, synthetic records), `tests/e2e/featured-bodies.mjs` (desktop + mobile, 23 checks incl. axe 0 violations, no console errors; file not built / partial / full via request interception of a SYNTHETIC file), screenshot of the Solar System view inspected |
| 5. Scalable small-body layer | `utils/sliceUpdate.ts` + `universe/objects/SmallBodies.tsx`: positions of the point layer are evaluated within a 3 ms per-frame budget in round-robin order and stop completely once every body is placed for the current clock value (paused = zero cost). The per-frame O(n) bounding-sphere recompute was removed (fixed sphere). Featured and selected bodies are not sliced | Timing in Node on this sandbox's CPU with SYNTHETIC bodies (full update of all bodies, before this change): 1,200 = 2.6 ms, 10,000 = 5.4 ms, 100,000 = 30 ms. `tests/sliceupdate.test.ts` (4 tests: full coverage, progress under a tiny budget, restart when the clock moves, empty set). `tests/e2e/smallbody-stress.mjs`: 20,000 synthetic bodies, UI count, search, selection, no console errors, update cost under 20% of frame rate |
| 6. Outer regions (schematic) | `utils/conceptualRegions.ts`, `universe/objects/ConceptualRegions.tsx`, `components/SolarControls.tsx`: Kuiper belt (30 to 55 au), scattered disc (30 to 150 au drawn), Oort cloud (5,000 to 100,000 au). **Real: the radial extents only** (NASA; Sky at Night Magazine for the scattered disc and the disagreeing Oort inner edge). **Not real: every dot** (seeded random, tilt spread artistic). Badges: Kuiper and scattered disc Artistic, Oort cloud Theoretical. Oort is off by default and drawn with log-compressed distance (sqrt orbit compression up to 100 au, identical to the orbits, then log). Dots cannot be clicked | `tests/conceptualregions.test.ts` (6 tests: metadata/provenance, determinism, extents, tilt and sphericity statistics, compression continuity, axes), `tests/e2e/outer-regions.mjs` (desktop + mobile, 15 checks, axe 0 violations, no console errors), two screenshots inspected (zoomed-out view shows ring, disc and shell). A layout bug found by the screenshot (expanded panel overlapped the chip row) was fixed with a height cap and scroll |
| 7. Comet tails (illustrative) | `utils/cometTail.ts`, `universe/objects/CometTails.tsx`, `universe/objects/smallBodyScene.ts`: one straight tail per comet closer than 3 au (nearest 80; the selected comet first), pointing exactly away from the Sun, fading out, longer closer to the Sun. **Real: the direction and that tails lengthen toward the Sun (NASA Space Place, read 2026-11-16). Display choices, not facts: the 3 au limit (NASA gives no distance), the linear length, the look.** Toggle `Comet tails`, Artistic badge, disclosure text; the control appears only when the built file has comets; tails cannot be clicked | `tests/cometTail.test.ts` (3 tests: length monotonic/zero beyond limit/bad input, direction exactly radial, selection order/cap/preferred). `tests/e2e/comet-tails.mjs` (desktop + mobile, 15 checks, axe 0 violations, no console errors, SYNTHETIC comets via request interception). Screenshot inspected: tail leaves the comet marker along the Sun-comet line, away from the Sun |
| 8. Atmosphere glow | `data/atmospheres.ts`, `universe/objects/AtmosphereGlow.tsx`: additive limb-glow shell for Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune and Titan, dimmer on the night side (Sun at the origin). **Real: only that these bodies have a substantial atmosphere** (no quantitative atmosphere data is used or shown). **Artistic: colour, thickness, strength.** Toggle `Atmosphere glow` with Artistic badge. Mercury, the Moon, Io and the other moons get none | `tests/atmospheres.test.ts` (4 tests incl. a drift guard that the GLSL constants equal the tested TS formula). `tests/e2e/atmospheres.mjs` (desktop + mobile, 13 checks, axe 0 violations, no shader-compile or console errors; the filter that hides software-WebGL noise does not hide shader errors). Screenshots on/off inspected: a blue limb appears on Earth with the toggle on and not with it off. It is subtle at the default zoom |
| 9. Saturn ring shadows | `utils/ringShadow.ts` (reference maths), `universe/objects/ringShadowShader.ts` (GLSL patches on the standard materials), `SolarBodyMesh.tsx`: the ring's shadow on the globe (scaled by the ring's own opacity at that radius) and the globe's shadow on the rings, analytic ray tests with a point Sun, no shadow maps (no extra render passes). Toggle `Saturn ring shadows`, Artistic badge, disclosure | `tests/ringshadow.test.ts` (5 tests): analytic result equals an independent brute-force ray march on 400 random globe points x 4 tilts and on 400 ring points, a hand-calculated crossing (1.01 radii), a physical sanity case (Sun along the ring normal: no ring shadow on the lit side), and a drift guard on the GLSL constants. `tests/e2e/ring-shadows.mjs` (desktop + mobile, 13 checks, axe 0 violations, no shader-compile errors). Screenshots on/off inspected: with the toggle on, Saturn's shadow lies across the rings on the side away from the Sun and is absent with it off; the ring shadow on the globe is only faint on the date shown |

One clock drives planets, moons, spin and the small-body layer (all read the same `clock.current.days`).

## Known limits of what is done

- The e2e clock check runs in a software-rendered (SwiftShader) browser; it checks controls and text, not frame rate on an Intel iGPU.
- Moon positions along their orbits remain illustrative (mean elements), and only 6 moons have 3D orbits.
- The simulation date picker is not kept in step with the running clock (it shows the last date you picked); the live date is the "Simulated date" text.

## Limits of the state vectors

- Velocities are the derivative of JPL's approximate formula, so they are only as good as it is (1800 to 2050; nominal longitude errors up to 400 to 600 arcsec for Jupiter and Saturn).
- The barycentre uses the eight planet systems only; dwarf planets and asteroids are ignored. No moon state vectors yet (moon speed shows nothing, never a made-up value).
- The scene still draws positions through the compressed visual scale; the state-vector module is the physical truth and is used only for the readout so far.

## Limits of the dwarf-planet layer

- **No real dwarf-planet orbit has been drawn from real data yet**: this sandbox cannot reach JPL, and `public/smallbodies/bodies.json` is still the empty placeholder. The layer was verified with a synthetic file (placeholder numbers, never saved in the project). Once you run `npm run build:smallbodies`, the eight bodies should appear; if JPL's `full_name` format differs from `"134340 Pluto (1930 BA)"` the body is reported as missing instead of mislabelled.
- The brightest-1000 numbered-asteroid query should contain all eight bodies (Pluto, Eris, Makemake, Haumea are brighter than most asteroids; Ceres, Vesta, Pallas, Hygiea are among the largest), but that is expected, not checked against real data.
- Markers have a fixed display size, not scaled to diameter, and the Pluto system (Charon etc.) is not drawn yet. Positions are two-body propagation from the osculating-element epoch and drift away from it.
- No Kuiper-belt/scattered-disc/Oort layers, belt density or comet tails yet.

## Limits of the scalable layer

- With a running clock and many bodies, each body is placed at the clock value of the frame in which it was evaluated, so bodies can lag the clock by a few frames (about a cycle). Not visible at 1,200 bodies (one pass fits the budget); possible at tens of thousands at 100 days per second.
- In the software-rendered test browser, 20,000 points drop the frame rate from about 45 to about 25 fps both running and paused, so that cost is CPU rasterisation, not the position updates. **I have not measured a real GPU or an Intel iGPU**; that still needs your Windows machine.
- It is still one `THREE.Points` draw call with a fixed 2.2 px point size, not an instanced mesh; there is no per-body LOD. The build script caps each query at 10,000 bodies.
- The main belt is shown only as the bodies in the built file; no density layer, no claim of completeness.

## Limits of the outer regions

- They are pictures of claimed extents, not data: no catalogue, no object counts, no Kuiper-belt structure (resonances, classical/hot/cold populations), no real tilt distribution. The scattered disc is drawn only to 150 au although sources say about 1,000 au.
- The Oort-cloud edges are uncertain and the two sources disagree on the inner edge (NASA 5,000 au; Sky at Night 2,000 to 5,000 au); the NASA values are drawn and the difference is stated in the panel.
- The Kuiper belt range was read from NASA's fact sheet through a summarising fetch tool; the Oort and scattered-disc facts from NASA's pages and one magazine article, not from a primary paper.
- Individual TNOs from the JPL file (if built) are separate from these dots.

## Limits of the comet tails

- Not physical: one straight tail, no separate curved dust tail, no brightness or outbursts, lengths in scene units, and the 3 au limit is a display choice. At perihelion a comet can sit inside the (enlarged) Sun sphere because only orbit sizes are compressed, not the Sun's drawn radius.
- No real comet has been drawn from real data yet: the shipped `bodies.json` has 0 comets. Everything above used synthetic comets in the browser.
- Tail set is re-chosen every 0.5 s (positions update every frame), so a comet crossing 3 au can gain or lose its tail up to half a second late.

## Shadows and eclipses: what is and is not done

- Done (unit 9): Saturn's rings and globe shadow each other, as above. Illustrative: the ring radii (1.3 to 2.3 planet radii) are a drawing choice, the Sun is a point (no penumbra) and the pole direction is a simplification (tilt only about one fixed axis), so the season of the shadow is not the real one.
- Not done: moon shadows and eclipses. Moon positions along their orbits are illustrative (mean elements, no ephemeris), so a moon shadow on a planet or an eclipse would look like a prediction that is not true. I will not draw eclipses until moon positions come from real satellite ephemerides.
- Real-time shadow maps from a point light at the Sun across a 1,000-unit scene are costly on an Intel iGPU and untested there; the night side is already shaded by the lighting. General shadow maps are not used; only the analytic Saturn ring shadow above.
- Planetary night sides are not lit by anything but the Sun (no city lights, no earthshine).

## Checklist against the Phase 4 brief (sections A to N)

Legend: **Done** = built and verified here as far as this sandbox allows; **Partial** = some of it; **Not done**; **Blocked** = needs something I cannot get from this sandbox (named).

| Section | Requirement | Status | Detail |
|---|---|---|---|
| A | Audit of the existing Solar System | **Done** | `PHASE_4_SOLAR_SYSTEM_AUDIT.md` (17 findings; rows 2, 3, 11, 14, 16 now carry update notes) |
| B | Orbital engine: Julian Date, time scales, epoch-aware elements, frames, position and velocity vectors, barycentres, precision documented, separate from visual scaling | **Partial** | Time scales, TDB clock, heliocentric and barycentric state vectors (planets only), validity range, accuracy tests against astropy/ERFA: done. Not done: state vectors for moons, dwarf planets and small bodies (their positions are two-body from osculating elements); the scene still draws through the compressed visual scale (state vectors feed only the readout); no planetary perturbations; Sun is fixed at the origin in the scene |
| C | Sun and 8 planets with full physical data, textures, shadows, lighting | **Partial** | Physical data and procedural textures existed; added artistic atmosphere glow and Saturn ring shadows. Not done: real photo textures (**blocked**: `npm run build:textures` needs your machine), moon shadows and eclipses (deliberately not drawn, see above), rings for Jupiter/Uranus/Neptune |
| D | ALL known moons from JPL, 3D orbits, hierarchy, search, LOD, lazy loading | **Not done / blocked** | Still 6 moons in 3D; the 177-row moon list has no orbital elements. **Blocked**: needs the real page layout and the JPL frame definitions (see `PHASE_4_MOON_PIPELINE_PLAN.md`: about 460 moons in three different frames, with the Laplace-plane definitions missing from the fetched page text). Built so far: `npm run probe:satellites`, a layout probe that you run once and paste back |
| E | Instanced asteroid belt; Ceres, Vesta, Pallas, Hygiea; integrate the 1,200-body dataset honestly; scalable pipeline | **Partial** | Scalable time-sliced point layer (timed with synthetic bodies), featured markers/labels/orbits for Ceres, Vesta, Pallas, Hygiea and the dwarf planets, honest "Data unavailable / Not in the built file". Not done: instanced mesh and per-body LOD; main-belt density layer; **blocked**: no real small-body file in this sandbox (`npm run build:smallbodies` on your machine), so no real asteroid has been drawn yet |
| F | Kuiper belt, dwarf planets, TNOs, scattered disc, Oort cloud (conceptual ones labelled) | **Partial** | Schematic Kuiper belt, scattered disc and Oort cloud (real extents from NASA, random dots, Artistic/Theoretical badges); dwarf planets and TNOs appear only once the JPL file is built (**blocked** as in E). Not done: Pluto's moons (Charon etc.), real Kuiper-belt structure |
| G | Comets with illustrative tails | **Partial** | Illustrative tails (direction real, rest display choice) verified with synthetic comets; **blocked** for real comets as in E |
| H | Navigation: focus, search, URL, parent/child, toggles, labels, distance, scale | **Partial** | Focus, URL `?object=`, search of small bodies, parent/child for the 6 moons, toggles for orbits, labels, tails, atmospheres, ring shadows, outer regions, distance and scale readout: done. Not done: search and focus for moons beyond the 6 |
| I | Simulation clock: current date, chosen date, play/pause/reset, forward/reverse, speed, one clock for everything | **Done** | Verified in a real browser (desktop + mobile). Limited to 1800 to 2050 on purpose (the planet-element validity range) |
| J | Disclosed visual exaggeration | **Done** | Per-body real vs drawn readout, a standing "not to scale" line, badges on every schematic layer |
| K | Performance for Windows 11 / 16 GB / Intel iGPU | **Partial / unverified on target** | CPU timing with synthetic bodies and a time-sliced updater; analytic shadows instead of shadow maps. **Not measured on an Intel iGPU** (the sandbox browser is software-rendered). Frame-rate claims for your machine cannot be made yet |
| L | Deterministic dataset builders with provenance | **Partial** | Existing small-body builder is deterministic with provenance in `meta`; the schematic regions use a seeded generator. Not done: a moon builder (blocked as in D) |
| M | Tests | **Done for what exists** | 270 unit tests (whole project, as of 2026-11-17) plus 7 real-browser scripts (clock, featured bodies, small-body stress, outer regions, comet tails, atmospheres, ring shadows); independent oracles (astropy/ERFA, brute-force ray marching) where possible. Features that depend on real data are tested only with clearly labelled synthetic data |
| N | Final docs | **Partial** | This file, the audit, `PHASE_4_DATA_SOURCES.md` and `PHASE_4_DATA_DICTIONARY.md` exist and are current; they will need a last pass when moons and real small-body data arrive |

**Phase 4 is not complete**, because D is not done and the data-dependent parts of E, F and G have not been verified with real JPL data.

## What I need from you to finish Phase 4

1. Run `npm run build:smallbodies` on your machine and tell me whether the eight chips (Pluto, Ceres, Eris, Haumea, Makemake, Vesta, Pallas, Hygiea) appear or which ones show under "Not in the built file". That confirms E, F and G with real data.
2. Run `npm run probe:satellites` and paste `satellite-page-probe.txt` here (details in `PHASE_4_MOON_PIPELINE_PLAN.md`), plus JPL's definition of the Laplace-plane R.A./Dec./Tilt and node/ω references if you can find it.
3. Optional: run `npm run build:textures` if you want NASA photographs, and note the frame rate on your Intel iGPU (the on-screen sim at 100 days/s with the small-body file loaded).
