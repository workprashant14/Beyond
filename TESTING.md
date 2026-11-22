# Testing BEYOND

Two layers, one command each. Run them before you trust a change.

## 1. Unit tests, types, lint, docs, build

```
npm run verify
```

Runs, in order: `tsc --noEmit`, `eslint`, `npm test` (300 tests in `tests/*.test.ts`, Node's built-in test runner through `tsx`), `npm run docs:check` (every `npm run` script and repo path named in the top-level `.md` files must exist) and `next build`. It stops at the first failure.

Many unit tests compare our calculations with an independent oracle. The oracle files are in `tests/fixtures/` and are made by small Python scripts (astropy 8.0.2, ERFA, NumPy): planet positions, barycentre, time scales, proper motion, rise/set/transit, Schwarzschild radius, light time. They are checked in, so the tests need no Python. To regenerate one you need `pip install astropy`. Fixtures that are SYNTHETIC (invented values shaped like real data) say so in their first lines and are never shipped to `public/`.

## 2. Browser tests

First time on a machine: `npm install`, then `npm run playwright:install` (downloads the browser, about 150 MB). `playwright` and `axe-core` are dev dependencies pinned to exact versions: each Playwright version needs its own matching Chromium, so a floating version can leave you with a browser the library cannot find. Use the `npm run` script, not a bare `npx playwright`: `npx` can pick another copy (a global install or a newer one it downloads) whose browser revision differs. `npm run test:e2e` prints which Playwright it uses. `.github/workflows/ci.yml` runs both layers on GitHub; it has not been run on GitHub yet.

```
npm run build
npm run test:e2e                      # all 25 scripts, about 12 minutes
npm run test:e2e -- sim-clock missions # only scripts whose name contains one of the words
```

`scripts/run-e2e.mjs` starts `next start` on port 3111 if nothing is listening there, runs every `tests/e2e/*.mjs` with Playwright (real Chromium), prints one line per script and a total, and exits non-zero if any check fails. A script that prints no PASS lines, or crashes, counts as failing. Many scripts also run axe-core (WCAG 2 A and AA) and fail on console errors.

Use a production build (`next build`), not `next dev`: the scripts measure page weight, hydration and timing. After you change anything in `public/`, restart the server.

Data modules are tested in their ABSENT state by request interception inside the browser: `data-absent.mjs` and `featured-bodies.mjs` make the browser see exoplanets, pulsars, quasars and small bodies as not built (404, or the shipped placeholder file) whether or not your real generated datasets are installed, and no project file is read, moved or written. Other scripts serve SYNTHETIC rows the same way, or build a synthetic FITS into a temp folder with the real pipeline (`quasars.mjs`). Real-data behaviour is checked by running the app on your own datasets, not by these scripts. `quasars.mjs` needs `python3` with `astropy`.

## What the tests do NOT cover

- **Real GPU speed.** The browser here renders WebGL in software (SwiftShader), so frame rates are not representative of a laptop GPU. Page weight and logic are measured; fps is not.
- **Real data files.** Exoplanets, pulsars, the real DR16Q quasars and small bodies need your own data-build runs (`npm run data:status` lists them); the code paths are tested with synthetic data, the real numbers are not verified here.
- **Screen readers.** Only accessible names, axe rules and keyboard reachability are checked, not what is announced.
- **Real phones.** Phone checks use emulated viewports.
- **Prose claims.** `docs:check` checks names and paths, not whether a sentence such as "verified" is true; `BEYOND_IMPLEMENTATION_STATUS.md` lists, per feature, what was verified and what was not.

## Performance checks in software-GL browsers

`tests/e2e/smallbody-stress.mjs` never compares one fps sample with another taken later: rasterisation noise in SwiftShader is larger than the cost being measured. It alternates running and paused rounds in one page, compares medians, and also compares the page's JavaScript time per second (CDP `ScriptDuration`), which excludes rasterisation. The app also changes its own render resolution while it runs (`PerformanceMonitor`, bounds from `utils/adaptiveDpr.ts`); the test waits until the canvas width has been stable for 6 s and prints the width per round, because a resolution change between a running and a paused sample moves fps by tens of percent. For diagnosis, `/explore?...&dpr=1` pins the resolution and `node scripts/profile-smallbody.mjs 6 [--dpr=1]` prints the canvas width, system CPU and per-stage costs (needs `npm start` running in another terminal).
