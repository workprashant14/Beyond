# Phase 4 — moon pipeline plan (not built yet)

**Status: not started. The moons are not done.** This file records what was learned about JPL's data and what is needed to build the pipeline without guessing.

## What the JPL page looks like (read 2026-11-16 through a summarising fetch tool, so counts are approximate)

Source: JPL SSD "Planetary Satellite Mean Elements", https://ssd.jpl.nasa.gov/sats/elem/sep.html (about 111,600 characters). The page itself warns the elements are not for ephemeris computation.

- Roughly 460 satellites in total (approximate; Jupiter about 114, Saturn about 292, Uranus about 30, Neptune about 16, Mars 2, Earth 1, Pluto not counted because the text was cut off).
- Columns (as reported): Satellite, Code, a (km), e, ω (deg), M (deg), i (deg), node (deg), P (days), Papsis (yr), Pnode (yr), and, only in Laplace-plane tables, R.A. (deg), Dec. (deg), Tilt (deg), Ref.
- **Three different frames, one per table**, each with its own epoch and ephemeris:
  - mean ecliptic: Earth (epoch 2000-01-01.5 TDB), Jupiter irregulars, Saturn (SAT456, SAT457, SAT455, SAT459), Uranus (URA117, epoch 2020-01-01.0), Neptune (NEP105, NEP104, epoch 2020-01-01.0)
  - mean equatorial: Saturn SAT480, Uranus URA182, Neptune NEP098, Pluto PLU060
  - referred to the local Laplace planes: Mars, Jupiter inner moons (JUP365), Saturn (SAT441, SAT415), Uranus URA184 (epoch 2025-01-01.0)
- **What the page text did NOT define** (as far as the fetched text showed): what the R.A., Dec. and Tilt columns mean, the reference direction for the node and ω in the Laplace and equatorial tables, and whether "mean ecliptic" means the ecliptic of J2000 or of the epoch. Converting those tables into one scene frame needs these definitions; **I will not guess them**.

## Why I cannot build it from here

The fetch tool does not return table rows verbatim (it summarises and limits quoted text), so the numbers cannot be transcribed reliably, and the HTML layout has not been seen. The sandbox cannot download the page itself.

## What exists now

`npm run probe:satellites` (`scripts/probe-satellite-elements.ts`, `utils/htmlProbe.ts`, `tests/htmlprobe.test.ts`): downloads that page (or reads a copy you saved) and writes `satellite-page-probe.txt`: for every table, the headings and text lines above it (epoch, ephemeris, frame), the column headers, the row count and the first two rows. It interprets nothing and changes no dataset. Tested on a synthetic page and the CLI run end to end; **not yet run against the real JPL page**.

## Plan once the real layout and frame definitions are known

1. Pipeline `scripts/build-satellite-elements.ts` keyed on the real header names (not column positions), refusing any table whose headers, epoch or frame it does not recognise, with a build report (counts per planet, frame, epoch; rows dropped and why).
2. Frame conversion to the scene's ecliptic J2000 frame, tested against an independent oracle (astropy/ERFA rotations) and against known facts (e.g. the Moon's and Galilean moons' orbit planes).
3. Per-planet lazy-loaded JSON, level of detail (named moons always, irregular swarms as points), parent/child links, search and focus; positions labelled illustrative (mean elements) and not used for eclipses.
4. Tests, browser checks and docs as for the other units.

## What I need from you

Run `npm run probe:satellites` on your computer (or save the page as HTML and run it with `-- --file sep.html`) and paste the content of `satellite-page-probe.txt` here. Also tell me, if you know, how JPL defines the Laplace-plane R.A./Dec./Tilt and the node/ω reference for the equatorial tables (the notes linked from that page); otherwise paste those notes.
