# Phase 1 architecture audit: planets and Moon in the Night Sky

Date: 2026-11-13. Read-only audit. No code was changed for this document.

## 1. What exists today (verified by reading the code)

**Frames and time**
- The 3D sky is drawn in the **J2000 equatorial** frame. `raDecToVec` (`utils/sky.ts`): +Y = north celestial pole, +X = RA 0, RA 90 deg on -Z.
- Night mode keeps catalogue positions in J2000 and moves only the horizon: `SkyShell` computes `lst` (GMST polynomial, Meeus ch.12) and `T` (Julian centuries from J2000), passes `night = {lat, lst, T}` to `SkyScene`. `Horizon` precesses horizon points back to J2000 with `precessToJ2000` (IAU 1976, `utils/precession.ts`).
- Alt/az of a selected object: `precessToDate(ra, dec, T)` then `equatorialToHorizon(..., lat, lst)` (`SkyShell.selectedHorizon`).
- Time is UTC treated as UT. No Delta-T, nutation, aberration, refraction or proper motion (stated in `SkyNight.tsx` and `utils/skyTime.ts`).
- Valid time range of the Sky Atlas: -3000 to 3000 (`utils/skyTime.ts`).

**Orbits**
- `utils/kepler.ts` + `data/keplerElements.ts`: JPL approximate planet elements (Standish and Williams), **heliocentric, ecliptic J2000, AU**, valid **1800 to 2050**. Earth's row is the Earth-Moon **barycentre**.
- `data/keplerElements.ts` also holds a "moon" row. JPL's own page says these mean elements are **not for ephemeris computation**, and this project already labels moon positions along the orbit "illustrative".
- `utils/separation.ts` (I19) already gives heliocentric distances with tested positions, but applies **no light-time**.

**Scene and interaction**
- `SkyScene` (R3F, `frameloop="demand"`): `StarPoints`, `DsoPoints`, labels, `SelectionRing`, `Horizon`. Picking is one function, `pickStar`, using an angular grid over stars and deep-sky objects. `SkyPick = {kind:"star"} | {kind:"dso"}`.
- Selection lives in the URL (`?star=`, `?dso=`, `?con=`), so Back/Forward and deep links work. Panels: `StarPanel`, `ConstellationPanel`, `DsoPanel` in `SkyPanels.tsx`.
- Sky search (`utils/skySearch.ts`) has kinds star / con / dso. The global search bar already finds Sun, planets and Moon through the catalogue (`objects.json` has `sun, mercury ... neptune, moon`) but opens them in `/explore`, not the Sky Atlas.
- `SkyNight.tsx` says "Planets and the Moon are not shown here".

## 2. What Phase 1 needs, and where it fits

| Need | Fits where | Status |
|---|---|---|
| Planet geocentric position | New `utils/ephemeris.ts`: planet minus Earth vector, rotate ecliptic J2000 to equatorial J2000 (inverse of `equatorialToEcliptic`) | Frame chain already compatible: the result is J2000 RA/Dec, same frame as stars, so `Horizon` and `selectedHorizon` work unchanged |
| Sun | -Earth heliocentric | Same code |
| Moon | Needs a real lunar theory | **Blocked on a source (see 3)** |
| Observer parallax (Moon) | Topocentric correction needs lat, LST and observer radius | `place.lat`, `lst` exist; elevation does not (assume sea level, say so) |
| Drawing | New small layer in `SkyScene` with a `bodies` prop `{id, ra, dec, label, kind}` plus Label3D | Easy; labels reuse `Label3D` |
| Picking | Extend `SkyPick` with `{kind:"body", id}`; test the 10 bodies directly before the grid | Easy, cheap |
| Selection and focus | Extend `ringPos` and the `focus` memo in `SkyShell`; add `?body=` | Easy |
| Panel | New `BodyPanel`: RA/Dec, alt/az, distance, light-time, phase and elongation, link to `/explore?object=<id>` | The `objects.json` ids already exist |
| Search | Add `kind:"body"` entries in `skySearch.ts` and route `/sky?body=` from `SearchBar` | Small change; touches search behaviour, needs its own tests |
| Refresh | Recompute in `useMemo` keyed by `when` | Cost negligible (10 bodies) |

## 3. Scientific risks and decisions needed

1. **Moon source (blocker).** The existing Moon elements cannot give a sky position: along-orbit phase is illustrative and the error would be tens of degrees. Phase 1 needs a real lunar theory (for example the truncated Meeus ch.47 series, about 2 arcmin or better, tables of roughly 60 terms). I cannot reproduce those tables from memory without risking a silent error, and the book is not fetchable here. Options: (a) you supply the tables or a fetchable source; (b) use a vetted open-source library, with the licence and accuracy checked; (c) ship planets and Sun first, Moon after.
2. **Independent test oracle.** The sandbox cannot reach JPL Horizons (I tried; not on the allowlist). `astronomy-engine` (MIT, on the npm registry, version 2.1.19 today) computes Sun, Moon and planets. I have **not** yet tested it or verified its stated accuracy. Proposal: use it only as a dev-dependency **test oracle** and compare to arcminute tolerance on many dates, plus published almanac events (Moon phase dates, Mars opposition dates) that I fetch and quote. Whether to use it also in the shipped code is your call.
3. **Earth barycentre.** Using the barycentre as Earth shifts nearby planets by up to about 20 arcseconds. Fix: subtract the Moon term (Earth = barycentre minus 0.01215 x geocentric Moon vector) once the Moon exists, or state the limit.
4. **Light-time.** Planets need one or two iterations of light-time for apparent position (tens of arcseconds for Mars and Venus). Not currently implemented anywhere.
5. **Not applied to stars either:** nutation, aberration, refraction (proper motion is now applied in night-sky time travel, utils/properMotion.ts). Planets would carry the same limits, so they stay consistent. Must be displayed.
6. **Time scales.** UTC treated as UT; Delta-T is about 69 seconds today. That shifts the Moon by roughly 0.01 deg, negligible for planets. State it; do not hide it.
7. **Date range.** Planet elements are valid 1800 to 2050 but the Sky Atlas allows -3000 to 3000. Proposal, matching what I did in `/distance`: hide planets and Moon outside the valid range, with a note, instead of extrapolating.
8. **Apparent magnitude.** Not planned from memory; show symbol size by category, say "not to magnitude scale", and leave magnitude "Data unavailable" unless a sourced formula is supplied.
9. **Parallax of planets.** At most about 30 arcseconds. I propose ignoring it, with a stated limit, but applying it to the Moon, where it reaches about 1 degree.

## 4. Proposed implementation order (after your requirements)

1. `utils/ephemeris.ts` for Sun and 8 planets (geocentric J2000 RA/Dec, distance, light-time), with tests against the oracle and published events.
2. Moon (once the source is decided), including phase, illuminated fraction, topocentric parallax.
3. Scene layer, picking, `?body=` URL state, `BodyPanel`.
4. Search integration.
5. Browser test: set a place and date, check altitude/azimuth of the Moon and planets against the oracle, axe, console.
6. Documentation and README/roadmap updates.

## 5. Files that would change

New: `utils/ephemeris.ts`, `components/BodyPanel.tsx` (or inside `SkyPanels.tsx`), tests. Modified: `universe/sky/SkyScene.tsx` (bodies layer, `SkyPick`, ring), `components/SkyShell.tsx` (compute bodies, `?body=`, focus), `components/SkyNight.tsx` (remove "not shown" text), `utils/skySearch.ts`, `components/SearchBar.tsx`. Nothing existing is replaced.

## 6. Questions that decide the work

1. Moon source: (a) you supply, (b) vetted library, or (c) planets first?
2. Is a dev-only test oracle (`astronomy-engine`) acceptable?
3. Hide bodies outside 1800 to 2050 (my proposal), or something else?
4. Are about 1 arcminute for planets and a few arcminutes for the Moon acceptable, shown on the page as Estimated?
