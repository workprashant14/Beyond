# BEYOND UI bugfix report: scrolling and clipping (2026-11-21)

## What was wrong (found by measuring, not guessed)
1. **Navigation bar cut off on the home page.** All 15 links were shown inline from 768 px up (`md:`), but they need about 1,700 px. Measured before the fix with `tests/e2e/scroll-layout.mjs`: "Launch" ended at x=1699 in a 1647 px window, "Objects/Discover/Launch" were outside a 1366 px window, and "Tours ... Solar System" outside a 768 px window. File: `components/Navbar.tsx` (only the home page uses it).
2. **Object panel hidden under the controls on a phone.** At 390×844 with Saturn selected, the simulation-controls panel (z-30, top) covered the object panel (z-20, bottom); the object text showed through ghosted. Files: `components/SolarControls.tsx`, `components/ObjectInfoPanel.tsx`.
3. **Map label cut off on a phone.** At 390 px the Triangulum Galaxy label stuck out 10 px past the right edge in the default "fit" view. File: `universe/map/CosmicMap.tsx`.
4. The phone menu had no height limit, so in a short window (landscape phone) its last links could not be reached.

Not a problem (checked, so no change): `html`/`body` are not `overflow: hidden` (only `overflow-x: hidden` on body), nothing hides the scrollbar (no `scrollbar-width`/`::-webkit-scrollbar` rules), pages scroll with wheel, End key and scrollbar. `/explore`, `/sky` and `/map` are intentionally one-screen apps (`h-svh`); their panels scroll on their own.

## Fixes
- `components/Navbar.tsx`: inline links only from 1280 px (`xl:`), 7 main links plus a "More" menu (8 links, Escape and outside-click close, own scroll, inside the window); below 1280 px the hamburger menu, now height-limited (`max-h-[calc(100dvh-4rem)]`) and scrolling on its own.
- `components/SolarControls.tsx`: on a phone only the play/speed row shows; a "More controls, date and caveats" button (`aria-expanded`) opens the rest, which scrolls inside its panel. From 640 px up nothing changed.
- `universe/map/CosmicMap.tsx`: more side room in the fit view when the window is under 600 px wide.
- No global `overflow: hidden` added or removed; no dependency changed.

## Guard test
`tests/e2e/scroll-layout.mjs` (runs in `npm run test:e2e`): every route at five sizes checks html/body not hidden, mouse wheel scrolls, End key reaches the bottom, last element inside the window, no horizontal scroll, nothing sticks out sideways, floating panels inside the window and scrollable, no control out of reach, no page errors; plus navigation bar/More menu/phone menu checks, and "controls and object panel never overlap, title not covered". The navigation and out-of-reach checks failed before the fix (measured); the panel-overlap check is backed by the before screenshot, not by running the test against the old code.

## Result per route (final run, 595 checks, 0 failed)
| Route | 1920×1080 | 1647×882 | 1366×768 | 768×1024 | 390×844 |
|---|---|---|---|---|---|
| `/` | PASS scrolls, page 4860px | PASS scrolls, page 4662px | PASS scrolls, page 4548px | PASS scrolls, page 6052px | PASS scrolls, page 7905px |
| `/explore` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/explore?object=solar-system` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/explore?object=earth` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/explore?object=saturn` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/map` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/sky` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/sky?star=32349` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/compare` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/distance` | PASS fits window | PASS scrolls, page 956px | PASS scrolls, page 956px | PASS fits window | PASS scrolls, page 1285px |
| `/exoplanets` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/milky-way` | PASS scrolls, page 2373px | PASS scrolls, page 2373px | PASS scrolls, page 2373px | PASS scrolls, page 2451px | PASS scrolls, page 3017px |
| `/missions` | PASS scrolls, page 2864px | PASS scrolls, page 2864px | PASS scrolls, page 2864px | PASS scrolls, page 2904px | PASS scrolls, page 3820px |
| `/moons` | PASS scrolls, page 9073px | PASS scrolls, page 9073px | PASS scrolls, page 9073px | PASS scrolls, page 9073px | PASS scrolls, page 9223px |
| `/pulsars` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS fits window |
| `/quasars` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS scrolls, page 847px |
| `/search?q=mars` | PASS fits window | PASS fits window | PASS scrolls, page 855px | PASS fits window | PASS scrolls, page 1063px |
| `/tours` | PASS fits window | PASS fits window | PASS fits window | PASS fits window | PASS scrolls, page 1191px |

"fits window" = page not taller than the window (full-screen app pages). "scrolls" = taller than the window; wheel, End key and bottom-of-page checks passed. Every cell also passed: no horizontal scroll, nothing sideways, panels fit, no unreachable control, no page error.
`/explore?object=...` rows were checked with the info panel open; `/explore?object=solar-system` with it closed.

## What could not be verified
- The look of the **native right-hand scrollbar**: headless Chromium hides scrollbars, so only that the page scrolls and that no CSS hides the bar was checked.
- Windows, Safari and Firefox (Chromium only).
- Real touch scrolling and a real GPU (software GL).
- Screenshots viewed by me: home at 1647 with More open, phone menu, explore at 1366 and 390. The other routes were measured, not looked at.

## Existing tests touched (no assertion weakened)
- `atmospheres`, `comet-tails`, `featured-bodies`, `outer-regions`, `ring-shadows`, `sim-clock`: on a phone they first click "More controls" (the controls now open on request there); same assertions afterwards.
- `quasars.mjs`: waits up to 5 s for the list to paint before asserting it has exactly 50 rows (one-off timing flake seen once in a full run; passed 3/3 alone before and in the final run).
- Trade-off to know: on a phone the "Data unavailable" notes and the drawn-vs-real scale readout inside the controls are one tap away ("More controls, date and caveats") instead of always visible.

## Final verification (Linux sandbox)
`npm test` 307 pass / 0 fail / 0 skipped; `npm run test:e2e` 26 scripts, 1184 checks, 0 failing (scroll-layout 595, click-selection 7, smallbody-stress 7); `npx tsc --noEmit`, `npm run lint` (0 warnings), `npm run docs:check`, `npm run build`, `npm run verify` all exit 0.

## Follow-up: "5 remaining scroll-layout failures" (2026-11-21, second report)
The five failures reported from the Windows run were: Launch at [1609,13,1699,51] at 1647×882; Objects, Discover, Launch at 1366×768; Tours … Solar System at 768×1024; the Triangulum Galaxy button [264,481,400,538] at 390×844 on `/map`; and the navigation bar at 1280×720.
- **These coordinates are exactly the layout from before the fix** (all 15 links inline from 768 px, Launch ending at x=1699; Triangulum label ending at x=400). The current `Navbar.tsx` (7 main links + More from 1280 px, `xl:`) and `CosmicMap.tsx` (`padX` 160 px under 600 px wide) were already in the delivered zip, so the likely cause is **a server or build from before the fix**: `scripts/run-e2e.mjs` uses whatever is already listening on :3111 and never rebuilds, so an old `next start` (or an old `.next` build) is tested instead of the new code. This is my reading of the evidence, not something I could reproduce on that machine.
- **Run on this machine with the project's own runner** (`node scripts/run-e2e.mjs scroll-layout`, which filters by script name, from its header comment) after a fresh `npm run build` and with port 3111 free: `scroll-layout.mjs` pass 595, fail 0, which includes all five cases (home at 1647/1366/768, navigation at 1280×720, `/map` at 390×844).
- **Change to the runner** (`scripts/run-e2e.mjs`): it now prints a WARNING when sources are newer than `.next/BUILD_ID` or there is no build, and a NOTE when a server is already listening on :3111 (it is reused, not restarted). Warnings only, the result is unchanged.
- **Extra check added to `scroll-layout.mjs`** (nothing removed or loosened): at 1280/1366/1647/1920 the navigation bar must have at least 17 px spare, the width of a classic Windows scrollbar that headless Chromium does not draw. Measured: 383 px spare at 1280.
- `Navbar.tsx` is unchanged by this follow-up (a `gap-6` experiment was reverted; the bar already had room).

If it still fails after `npm run build` and with no old server running, send the full failing lines of that run and the output of `curl -s localhost:3111/ | grep -o "xl:flex" | head -1`.

### Final results of this follow-up (Linux sandbox, fresh build, port 3111 free)
`node scripts/run-e2e.mjs scroll-layout`: 595 pass / 0 fail (before the extra scrollbar-room checks). Then in order: `npm run build` exit 0, `npx tsc --noEmit` exit 0, `npm test` 307 pass / 0 fail / 0 skipped, `npm run test:e2e` 26 scripts, 1188 checks, 0 failing (the 4 extra checks are the scrollbar-room ones), `npm run lint` exit 0 with no warnings, `npm run docs:check` exit 0, `npm run build` exit 0. Not run on Windows.

## Solar System selector / info panel overlap

**Root cause.** In `ExplorerShell` the object selector `<nav>` (`absolute inset-x-0 top-24`) and `ObjectInfoPanel` (`absolute right-6 top-24 w-96`) were independent layers that started at the same height, so from the `sm` breakpoint up the panel (z-20) sat on top of the right-hand end of the chip row. Titan, Uranus and Neptune (the last chips) were covered. Separately, the panel's X was a `<Link href="/explore">`: it dropped `?object=`, which left the Solar System view and replaced the chip row.

**Fix (layout, not z-index).**
- The panel now starts at `sm:top-[9.5rem]`, below the selector row (row top 6rem + chip height + horizontal scrollbar room). On phones it stays a bottom sheet, which cannot reach the row. The row keeps `overflow-x-auto`.
- X is a button (`onClose`) that only hides the panel (local `closedId` state in `ExplorerShell`). URL, scene, chips and simulation controls stay mounted. Clicking any chip (including the current one) or an object in the scene reopens the panel. Other users of `ObjectInfoPanel` (without `onClose`) keep the old behaviour.

**Test.** `tests/e2e/selector-panel.mjs` at 1920x1080, 1695x879, 1366x768, 1024x768, 768x1024, 390x844: geometry no-overlap, real hit-testing of every chip, Io -> Titan/Uranus/Neptune, X, reopen, Solar System -> Milky Way (one panel, no stale chips, header links reachable, canvas hit-testable), no page errors. 186 checks.
