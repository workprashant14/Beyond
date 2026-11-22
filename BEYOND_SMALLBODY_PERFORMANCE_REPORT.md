# Small bodies at 100×: performance report (2026-11-21)

Reported failure (your machine): `position updates cost under 20% of the frame rate while running at 100x (31.9 running vs 41.8 paused fps)`, a 23.7% drop; an earlier report was 39.0 vs 49.2 (20.7%). The 20% threshold and the assertion are unchanged.

## Honest summary
- **I could not reproduce the 20–24% drop on this machine.** Here (software GL, about 21 fps) running is within a few percent of paused in every run. So I cannot prove that your number is fixed; I removed every running-only cost I could find and made the measurement fairer. Please run the focused test on your machine.
- Running-only cost here is real but small: page JavaScript is about 90–97 ms/s running vs 45–55 ms/s paused, so about 2.2 ms per frame, all in the small-body slice updater. With no small bodies, running and paused cost the same (61–68 ms/s), so planets, clock, React and labels add nothing.
- At about 20 fps (50 ms frames) a 2.2 ms cost is about 4% of a frame, below the noise (±10% from one 1.5 s sample to the next). At your 24 ms frames the same cost is about 9%, and a real GPU adds a cost that software GL cannot show (see 4 below).

## What was investigated (your list)
1. **Unnecessary position calculations:** one pass over all 20,000 bodies per frame is needed (they move every frame at 100×). The updater used to start a second pass inside the same frame (fixed in the previous round). Skipping frames was rejected: at 100× bodies move several pixels per frame, so it would be visible stutter and lower accuracy.
2. **Duplicate evaluations:** none now (unit test: no body is evaluated twice in one call).
3. **React state / re-renders:** none in the loop (clock and positions live in refs and typed arrays). Measured: with no bodies running ≈ paused.
4. **Buffer uploads (found two issues):** (a) the position `BufferAttribute` had three.js's default `StaticDrawUsage` although it is rewritten every frame; on real GPU drivers (ANGLE/D3D11, Metal) re-uploading a static buffer each frame means a staging copy that can stall the pipeline. Software GL does not show this. (b) the whole 240 KB buffer was uploaded even when only a slice had changed.
5. **Allocation/GC:** the hot loop allocates nothing; two per-frame `new Float32Array(3)` for the selected body and featured markers are negligible and untouched.
6. **Slice scheduling/budget:** 3 ms budget per frame, unchanged (lowering it would make bodies lag more, i.e. lower visual accuracy).
7. **Measurement equivalence:** the test always measured paused right after running, so any machine drift (clock boost, thermal throttling, other programs) landed on one state. Fixed, see below.

## Changes
- `utils/smallBodyFast.ts`: Kepler warm start now predicts the new eccentric anomaly from the previous one (`dE = dM / (1 − e cos E)`, unwrapped mean anomaly), so Newton needs about two steps, and stops at `|d| < 1e-9` rad (Newton is quadratic, so the remaining error is about 1e-18 rad, far below the float32 buffer and the 1e-12 of the reference solver). Anything that does not converge in 8 steps falls back to the robust `solveKepler`. Steady-state pass over 20,000 bodies (Node): **about 3.2 ms → about 2.3 ms**.
- `universe/objects/SmallBodies.tsx`: position attribute set to `DynamicDrawUsage`; only the evaluated run is uploaded via three.js `updateRanges` (`addUpdateRange`).
- `utils/sliceUpdate.ts`: new pure helper `changedRun(cursor, n, total)` (the run `stepSlice` evaluated; a call never wraps, so it is contiguous).
- `tests/e2e/smallbody-stress.mjs`: eight ABBA-ordered rounds (running first in even rounds, paused first in odd ones) instead of five always running-then-paused; each round's numbers are printed. The asserted quantities, ratios and the 20% threshold are unchanged (medians of running fps vs paused fps, running ≥ 0.8 × paused; paused ≥ 0.9 × running; paused JS time ≤ 0.8 × running JS time). The play/pause click now checks visibility instead of waiting for a button that is not there.
- `tests/smallbodyfast.test.ts`: 3 new tests (date jumps, backward time and e up to 0.995 against the reference; two `changedRun` tests). Total 7 tests in that file.

## Benchmarks (this machine, software GL; paused vs running fps = median of 8 ABBA rounds per run)
| Version | Run | Running | Paused | Drop |
|---|---|---|---|---|
| Before any optimisation (your machine, reported) | – | 39.0 | 49.2 | 20.7% |
| After the 1st optimisation (your machine, reported) | – | 31.9 | 41.8 | 23.7% |
| After the 1st optimisation + ABBA test (this machine) | 1 | 21.5 | 21.3 | −0.9% |
| | 2 | 20.4 | 20.9 | 2.4% |
| | 3 | 17.1 | 20.7 | **17.4%** (noise outlier, still under 20%) |
| | 4 | 20.5 | 21.1 | 2.8% |
| | 5 | 21.6 | 22.1 | 2.3% |
| Final code (this machine) | 1 | 21.1 | 21.7 | 2.8% |
| | 2 | 22.2 | 23.1 | 3.9% |
| | 3 | 21.2 | 22.0 | 3.6% |
| | 4 | 21.1 | 20.7 | −1.9% |
| | 5 | 21.3 | 22.3 | 4.5% |

Single rounds scatter between −15% and +6% (for example run 1 rounds: −8.4, 5.4, −15.5, 5.2, −3.5, 6.4, 0.4, −1.1%), which is why one sample or one run proves nothing in either direction. The run-3 outlier (17.4%) shows that on a loaded machine the margin to 20% can be thin; this is exactly why I do not claim success from a single fast run.

Isolation experiment (temporary runtime flags, since removed; 8 ABBA rounds): full 103.9%, no upload 101.9%, no position computation 108.7%, neither 102.2% of paused fps. All within noise, so on this machine neither the computation nor the upload is separable from noise.

## Scientific correctness checks
- `tests/smallbodyfast.test.ts`: the fast propagator equals `smallBodyPosition` + `toScene` for closed and open (hyperbolic) orbits at several dates (relative difference below 1e-6, the float32 output resolution), over 3,000 consecutive 17-day frames across many 2π wraps with e from 0.02 to 0.99, and over 4,000 random steps including ±30,000-day jumps, backward time and e up to 0.995 (exercises the fallback path).
- `solveKepler` is unchanged this round (its high-eccentricity fix and regression test are from the previous round). Open orbits and bodies without a period still use the reference path.
- No catalogue data, count or accuracy setting was changed. Visual check: a screenshot of the point layer paused after running with the CPU throttled 8× (cycles span several frames, so partial uploads are exercised) shows the belt correctly spread with no stale points at the Sun, and no console errors.

## Full test results (Linux sandbox)
`npx tsc --noEmit` exit 0; `npm test` 310 pass / 0 fail / 0 skipped; `npm run test:e2e` 26 scripts, 1188 checks, 0 failing (smallbody-stress 7/7, scroll-layout 599/599); `npm run lint` exit 0, no warnings; `npm run build` exit 0; `npm run docs:check` exit 0; `npm run verify` exit 0. Not run on Windows or on a real GPU.

## Not verified / next step
- Whether `DynamicDrawUsage` plus range uploads remove your 20–24% on a real GPU: unverified, because I have no real GPU here. If your machine still fails, send the eight printed `round N:` lines and the two "JavaScript ms per second" numbers from `node tests/e2e/smallbody-stress.mjs`; they show whether the cost is JavaScript or GPU/driver.
- If the GPU upload is still the cost, the next option is a Web Worker computing positions off the main thread. I did not do it: it makes the "paused JS time ≤ 0.8 × running" assertion meaningless (the work would not be on the main thread), so it needs your decision first.

---

# Second-stage investigation (2026-11-22)

Your latest run: paused 47.9 fps, running 34.6 fps (27.8 % drop). **Status: not reproducible in my sandbox, so I cannot claim your 27.8 % is fixed. Every measurement here passes; the cause of the extra drop on your machine is not proven.** What I did prove, change and measure is below, plus a script that localises the cost on your machine.

## 1. Profile of the whole pipeline (Playwright + CDP, same 20,000-body SYNTHETIC file, 1280×800, 100×)

New tool: `node scripts/profile-smallbody.mjs [rounds]` (needs the production server on :3111). It wraps the WebGL calls (count, CPU time, bytes), runs the CDP sampling profiler, reads CDP metrics and long tasks, and reads per-frame counters from the layer (`window.__sbDebug`, only active when a page sets it). It cycles four states in a Latin-square order (so every state sees every position and the machine's drift cancels): `paused`, `running`, `running, upload skipped`, `running, position write skipped`. This isolates the cost of each stage inside one page.

Evidence (BEFORE this round's code, 4 rounds):

| quantity | paused | running 100× |
|---|---|---|
| fps (rounds) | 21.2, 21.6, 20.6, 20.8 | 20.6, 21.4, 20.1, 19.8 |
| paired drop | | mean 2.8 %, sd 1.6 |
| page JS per second | 48–52 ms/s | 85–98 ms/s (about +40) |
| small-body `useFrame` | 0 | 1.9–2.15 ms/frame |
| bodies evaluated per frame | 0 | about 10,200 (one contiguous range per frame) |
| Kepler cold-start fallbacks (reference solver) | | 20,000 in total = the first evaluation of each body, then none |
| Newton iterations per evaluation (warm) | | 2.44 (about 5 libm sin/cos calls) |
| `bufferSubData` | 0 | about 21 calls/s, 0.65–1.0 ms/s of main-thread time, about 120 KB per frame |
| draw calls | about 1,800/s | about 1,750–1,850/s (unchanged) |
| long tasks / GC | similar in all states; GC appears only as small slices in the profile |

Findings, each with its evidence:

* **Calculation** is the one stage that is measurable and in my control: about 200 ns per body in the browser, 2 ms per frame. It is the whole of the +40 ms/s of JavaScript.
* **Kepler fallbacks** are not a problem: only the 20,000 cold starts; none in steady state (counter above).
* **Buffer writes / range generation**: one contiguous range per frame, nothing fragmented.
* **Upload**: 1 `bufferSubData`, about 120 KB per frame; main-thread cost 0.65–1.0 ms/s. The "upload skipped" variant is **not distinguishable** from "running" in my sandbox (paired drop 1.2 % ± 4.9 vs 2.8 % ± 1.6). **I have no evidence that upload is the cause, and I do not claim it.**
* **Render loop, draw calls, React, clock, planets, DOM**: "position write skipped" (clock running, everything else active) equals paused (21.0 vs 21.1 fps; 43–58 ms/s JS vs 48–52). So nothing else becomes more expensive at 100×.
* **CPU vs GPU**: the main thread is about 95 % in native `(program)` code in every state (paused too): it waits on the software rasteriser. That is the frame time. The position update does not change it measurably here (≤3 %). I cannot see the GPU process from this page, so the GPU-side share on your machine is unknown.
* A first version of my script over-counted the uploaded bytes (it counted the whole array instead of the `length` argument of the partial `bufferSubData`); fixed.

## 2. Changes

1. **Trig-free incremental Kepler step** (`utils/smallBodyFast.ts`). Warm start as before, but when the eccentric anomaly moved by |ΔE| < 0.25 rad, sin/cos come from the carried values and short Taylor series of sin ΔE, cos ΔE (error below 1e-10), solved by Newton on ΔE. No libm call. Every 32 evaluations sin/cos are taken from libm again, so the truncation cannot accumulate. Larger steps (date jumps, near-perihelion at e up to 0.995, reverse jumps) use the previous libm warm Newton, and cold starts the bracketed reference solver. Open (e>1) orbits still use the reference path. Per body: **91 → 54 ns in Node (−41 %)**, and **about 204 → 114 ns in the browser (−44 %)**; 97–99 % of evaluations are trig-free. This is a different lever from the earlier warm-start (it removes the libm calls the warm start still made).
2. **Update-rate contract** (`utils/sliceUpdate.ts`, `universe/objects/SmallBodies.tsx`). After change 1 alone, the 3 ms time budget simply spent itself on more bodies (about 18,400 per frame): JS per frame did not fall and the upload grew to about 211 KB per frame. I did not want to increase upload on a machine where upload may be the problem. `stepSlice` now takes `maxItems`; the layer passes ceil(N/2): while the clock runs every body is at most 2 frames (about 40 ms, about 3 px at 100×) behind the clock, which is what the layer already did before (about 10,000 bodies per frame), independent of CPU speed. Position update: **2.0 → 1.1–1.3 ms/frame**, upload back to about 115 KB per frame, **JS +40 → +25 ms/s**. Nothing is frozen: a paused clock still settles, a clock jump reaches every body (tested).
3. **Diagnostics** (counters + skip-write/skip-upload switches behind `window.__sbDebug`; one property read per frame when unused) and `scripts/profile-smallbody.mjs`.

## 3. Benchmark (unchanged test: 8 ABBA rounds, 20,000 bodies, 100×, threshold 20 %), AFTER, three consecutive runs

| run | individual rounds, drop % (running first / paused first alternating) | medians running / paused fps | result |
|---|---|---|---|
| 1 | 8.5, 5.3, 7.0, 6.9, 2.4, −2.6, 4.8, 2.2 | 20.6 / 22.1 | PASS |
| 2 | −1.8, −5.4, 6.8, 11.4, 3.0, −6.7, −7.0, −2.2 | 22.8 / 22.6 | PASS |
| 3 | 1.9, 2.9, 6.2, −5.7, −9.2, 4.5, 1.8, −1.4 | 22.4 / 21.9 | PASS |

24 rounds: mean about 1.6 % drop, individual rounds −9.2 … +11.4 % (sd about 5.6 points). Median drops −0.4 %, −0.9 %, +1.4 %. Page JS per second: running 74–81 vs paused 51–53 ms/s. The sandbox noise (sd about 5–9 % per round, and a slow upward drift of fps through a run) is larger than the cost being measured, which is why the test uses ABBA medians. Profile script, 6 rounds, after: running 20.9 vs paused 20.9 fps (paired mean −0.4 %, sd 8.9).

## 4. Scientific correctness (new tests in `tests/smallbodyfast.test.ts`; none removed or weakened)

* 30,000 consecutive 100×-sized frames at e = 0, 0.1, 0.3, 0.6, 0.9, 0.98, 0.995 against `smallBodyPosition` + `toScene`: worst relative difference below 5e-7 (one float32 ulp is about 6e-8); the test also asserts that more than 80 % of evaluations take the trig-free path and that only the 4 first evaluations per body use the reference solver, so it cannot pass vacuously.
* Backward time in small steps, forward, then +40 y, −80 y, +40 y jumps at e = 0.2 … 0.995: same tolerance.
* Buffer update correctness: copying only the evaluated runs (what `updateRanges` uploads) reproduces a full re-evaluation after settling, and equals the reference.
* Update-rate cap: a call never exceeds the cap, items are never older than 2 frames, the layer settles after the clock stops, a date jump reaches every item.
* Earlier tests (warm start across wraps, date jumps, e up to 0.995, open orbits, `solveKepler` regression, `changedRun`) still pass unchanged.
* **Real shipped small-body data: NOT verified.** `public/smallbodies/bodies.json` is the empty placeholder (0 bodies) in this checkout, the JPL data build was not run here, and I do not invent elements. The test for it exists and is **skipped** (visible as `# skipped 1`); it runs automatically once the data is built. Please run `npm test` on your machine after your data build.

## 5. Full verification (Linux sandbox)

`tsc` clean; `npm test` 315 tests, 314 pass, 0 fail, 1 skipped (real data); lint clean; docs:check clean; production build OK; e2e: 27 scripts, 1374 checks, 0 failing (including `smallbody-stress.mjs` and `scroll-layout.mjs`).

## 6. Remaining limitations / what to send me if it still fails on your machine

* **I could not reproduce 27.8 %.** In this sandbox the whole running-vs-paused effect is about 0–3 %, and 5 % noise per round. If `smallbody-stress.mjs` still reports a drop of 20 % or more on your machine, the result is a **FAIL** until shown otherwise; do not treat my numbers as a pass for your hardware.
* Please run on your machine: `PORT=3111 npm start` in one terminal, then `node scripts/profile-smallbody.mjs 6` and send me the output. The four states say directly whether your extra 8 ms per frame is the position write (then "position write skipped" removes it), the upload ("upload skipped" removes it), or something that stays even when both are skipped (then it is not in the layer at all).
* The only lever that would remove the CPU write entirely is propagating the orbits in a vertex shader. In the SwiftShader test environment that only moves the same arithmetic into the software rasteriser, and it breaks CPU picking of points and needs a separate path for hyperbolic orbits, so I did not do it without evidence that it helps on your machine. A Web Worker would move the 1.1 ms off the main thread, but on a software renderer it competes for the same cores. Both are decisions for you, after the profile output.
* Windows, a real GPU and Firefox/Safari were not measured.

---

# Profile from the user's Windows machine (2026-11-22)

`node scripts/profile-smallbody.mjs 6` on Windows (output supplied by the user). What it shows:

* **Two performance modes (see the control run below: I first called this independent of the simulation, and that was not supported).** Samples fall into a fast mode (about 46–59 fps, 0 long tasks, draw calls about 4,150–4,980/s) and a slow mode (about 17–21 fps, 48–76 long tasks, draw calls about 1,580–1,800/s). Draw calls per frame are the same (about 85), so it is the same work taking about 2.6× longer. The slow mode also hits the **paused** state (round 4: 19.2 fps, 64 long tasks, JS 79 ms/s; round 5: 19.2 fps, 67 long tasks) and the "position write skipped" state (round 4: 19.0 fps, 73 long tasks), where the layer does nothing. JS per frame is 3–4× higher in the slow mode even when paused (79–88 ms/s at 19 fps vs 42–47 ms/s at 50 fps). That is the page getting slower as a whole; the cause is not established (see the control run below).
* **Within one mode the running-vs-paused cost is small.** Fast mode: round 1 paused 49.8 vs running 50.6 fps (−1.6 %), round 6 paused 48.9 vs running 50.9 (−4.1 %). Slow mode: round 4 paused 19.2 vs running 18.3 (4.7 %), round 5 paused 19.2 vs running 18.5 (3.6 %). The "21.4 % ± 32" paired mean in the script's summary comes from rounds in which the mode changed between the paused and the running sample (rounds 2 and 3: 52.0 → 19.2 and 46.3 → 17.4), not from the position update. The earlier 47.9 vs 34.6 fps (27.8 %) fits the same explanation, but I cannot prove that from one run.
* **Position update cost on that machine:** 0.74 ms per frame for 10,000 bodies (about 74 ns per body) in the fast mode; 2.3–2.5 ms per frame in the slow mode (same machine, about 3× slower). Upload: 51 `bufferSubData` per second, 117 KB per frame, 1.4 ms/s of main-thread time; "upload skipped" is not better than "running" (round 6: 52.7 vs 50.9 fps; round 1: 48.9 vs 50.6). No evidence that upload is the cause.
* **What is not shown:** why the machine flips. The pattern is not "write on = slow" (round 1 and round 6 have the write on and are fast; "write skipped" is slow in round 4), so I do not claim that. Candidates are power plan or thermal limits, another program, or the browser process; the data cannot separate them.

New diagnostics in `scripts/profile-smallbody.mjs` for the next run: system-wide CPU busy % per sample and the time of a fixed arithmetic loop (run in the script's own process right after each sample), and `--control` (samples only the paused state, many times). Run `node scripts/profile-smallbody.mjs 6 --control` on the Windows machine (plugged in, power plan "High performance", other programs closed): if the paused fps still jumps between about 50 and about 19, the simulation is not involved at all, and the loop time / CPU busy % show whether the machine changed speed.

## Control run on the user's machine: paused only, 24 samples (output supplied by the user)

`node scripts/profile-smallbody.mjs 6 --control`: **no slow mode.** fps 44.5–54.3 (mean 48.9, sd 2.4), 0 long tasks in all 24 samples (about 2.5 minutes), draw calls 4,316–5,063/s. Machine speed was not constant: the fixed arithmetic loop took 380–440 ms in samples 1–11 and 509–540 ms from sample 12 on (+30 %), with fps going from about 51 to about 47 (−8 %) and system CPU busy 57–66 % throughout. Consequences:

* The ~19 fps mode did **not** appear spontaneously while the simulation stayed paused. My earlier statement that the mode flips were independent of the simulation is withdrawn: in the 6-round run the slow mode started during rounds that contained running samples (first at round 2, "running, upload skipped") and then also affected paused samples, so something done while running may leave the page slow for a while. The data so far cannot say what (in round 3 and 5 a "write skipped" sample was fast between slow ones; in rounds 1 and 6 the write was on and the page was fast).
* A +30 % machine slowdown within one run changed fps by about 8 %. That is the order of magnitude of noise that the 20 % threshold has to live with on that machine, but it is not 28 %.
* I looked at one more lead and discarded it: CDP's `Nodes` metric grows by about 24 per 4 s sample while running (553 → 625), but a separate probe shows the live element count flat at 239 in both states and the JS heap flat at 18–20 MB, so it is uncollected text nodes, not a leak.

Next isolation runs (each is 24 samples of one state, with "Reset to today's date" before each sample, printing JS heap, DOM nodes, system CPU busy % and the fixed-loop time): `node scripts/profile-smallbody.mjs 6 --only=running` (clock running, layer active), then `--only=running-nowrite` (clock running, layer idle), then `--only=running-noupload`. If only `--only=running` goes slow (and stays slow, including when followed by paused samples), the layer is involved; if `running-nowrite` also goes slow, it is the running clock/scene (not the small bodies).

**What this means for `smallbody-stress.mjs`.** Its ABBA rounds compare a running sample with a paused sample taken about 2 s apart; a mode flip between them reads as a large "drop". I have **not** changed the test (threshold, rounds, bodies, speed, assertions are as before). Possible methodology changes, for you to decide, not applied: sample finer-grained alternation (for example 6 alternations of 400 ms inside each round) so a flip falls on both states equally, or discard rounds whose paused fps differs by more than a stated factor from the paused fps of the neighbouring rounds and require a minimum number of valid rounds. Either one changes what the test measures, so it needs your decision.

---

# Isolation runs on the user's machine (2026-11-22, 4 runs of 24 samples)

Medians over 24 samples each, same machine (fixed-loop 500–570 ms in all runs):

| state | median fps | mean | min–max | samples ≥ 50 fps |
|---|---|---|---|---|
| paused (earlier control run) | 47.8 | 48.9 | 44.5–54.3 | 7/24 |
| running, layer fully active | 39.5 | 41.7 | 34.4–56.6 | 4/24 |
| running, **position write skipped** (layer idle, clock running) | 40.5 | 41.8 | 36.2–57.0 | 2/24 |
| running, upload skipped (run 1) | 39.0 | 40.0 | 36.0–57.4 | 1/24 |
| running, upload skipped (run 2) | 39.0 | 41.1 | 35.1–56.8 | 3/24 |

Findings:

* **The layer is not what makes running slower on that machine.** With the layer doing nothing at all (write skipped, nothing uploaded), running is already about 15 % below paused (40.5 vs 47.8 median); with the full layer it is about 17 % below, and with the upload skipped about 18 %. The layer's own contribution is within the sample noise (about 0–1 fps, 0–3 %). Its cost, measured directly on that machine, is 1.0–1.1 ms per frame for 10,000 bodies, 117 KB uploaded per frame, 1.0–1.8 ms/s of main-thread time in `bufferSubData`, 99 % trig-free evaluations, no fallbacks after the first evaluation.
* **Running samples alternate between about 36–40 fps and about 50–57 fps** (for example `--only=running`: 54.5, 56.5, 46.9, then 34–39 for rounds 4–8, then 56.6, 56.2, then 36–43), even with the layer idle. The paused control did not do this. In the fast samples the main thread has idle time and long tasks are 0; per-frame JavaScript is the same in both (about 2.1 ms), so the slow samples are slower in the native/raster part, not in JavaScript.
* **One machine stall** was recorded (`--only=running-nowrite`, round 13: fixed-loop 6,673 ms, 71 long tasks): something else on the machine blocked for seconds. It shows how large machine-level interference can be.
* The `summary` of the script crashed in `--only` runs (no paused sample to pair with). Fixed: it now prints mean, median and sd, and says that no paired drop exists.

## Likely mechanism for the two speeds: adaptive resolution (hypothesis, not yet shown on the user's machine)

`universe/engine/UniverseScene.tsx` mounts drei's `PerformanceMonitor` that changes the canvas pixel ratio by itself (drei 10.7.9: bounds 40 to 60 fps below 100 Hz; decline to dpr 1 when most of ten 250 ms averages are below 40, incline back to 1.5 when most are at or above 60; `flipflops` defaults to Infinity, so the 0.75 fallback never fires, which corrects what I wrote earlier). 1.5 is 2.25× the pixels of 1.0, and with a software or integrated renderer the frame time follows the pixel count. A fast/slow alternation at an unchanged amount of work (same draw calls per frame) is what that controller would produce, and it would also move fps during a benchmark independently of the small bodies. I did **not** observe the flips on your machine (the earlier script did not print the canvas size). In my sandbox the controller settled at dpr 1 (canvas 1280 px wide at a 1280 px viewport), and pinning the resolution changed fps clearly (about 15 fps at dpr 1.5, 1920 px, vs 18–21 fps at dpr 1.0), so the effect is real in software rendering; whether it is what flips on your machine is to be decided by the next run.

New, opt-in, diagnostics only: `/explore?...&dpr=1` pins the render resolution (0.5–2) and does not mount the `PerformanceMonitor`; without the parameter nothing changes (default behaviour and e2e tests are as before). `scripts/profile-smallbody.mjs` prints the canvas width per sample and takes `--dpr=<n>`.

## Next runs (same two terminals as before)

1. `node scripts/profile-smallbody.mjs 6` (no `--dpr`): look at the new `canvas ...px wide` column. If it changes between about 1920 (dpr 1.5), 1280 (dpr 1) and 960 (dpr 0.75) while fps changes, the controller is the cause of the two speeds.
2. `node scripts/profile-smallbody.mjs 6 --dpr=1` and then `--dpr=1.5`: with the resolution fixed, the paired drop (running vs paused) in the summary is the clean measurement of the cost of running at 100×. If the drop is below 20 % there, the 20 % failures of the stress test come from the adaptive resolution and from the clock/scene, not from the position update.

`tests/e2e/smallbody-stress.mjs` is **unchanged**. Whether the stress test should also pin the resolution (it would remove the resolution controller from the measurement without touching the threshold, rounds, bodies or speed) is your decision; I have not done it.


---

# Result: root cause found (2026-11-22, from the user's three runs with the canvas width printed)

**The 20 %+ drops come from the app's own adaptive render resolution, not from the small-body layer.**

| run on the user's machine | paired drop running vs paused (6 rounds) |
|---|---|
| adaptive resolution (default app) | mean 7.0 % but sd 17.6; round 1: paused at **1280 px wide, 60.0 fps** vs running at **1920 px wide, 42.0 fps** (a 30 % "drop" caused by the resolution change itself); the canvas then stayed at 1920 px except one 1280 px sample (47.9 fps) |
| `--dpr=1` pinned | paused median 59.5 (60 Hz cap) / running 57.2: **mean 3.3 %, sd 0.8**; upload skipped 1.7 %; position write skipped 0.3 % |
| `--dpr=1.5` pinned | paused median 39.8 / running 36.8: **mean 4.1 %, sd 4.9**; upload skipped 2.5 %; write skipped 3.5 % |

At a fixed resolution the whole cost of running at 100× (clock, scene and small bodies together) is 3–4 %, far under the 20 % threshold; the layer's share is about 3 % at 60 fps (write skipped: 0.3 %). The earlier "27.8 %" fits one resolution change falling between a paused and a running sample. This is a measurement from three runs on one machine, not a proof for every machine.

**A real product defect behind it: the resolution pumps.** The monitor lowers dpr (1.5 → 1) below 40 fps and raises it (1 → 1.5) at 60 fps. At dpr 1 this machine reaches 60 fps (the display cap), which triggers the raise; 1.5 has 2.25× the pixels, so fps falls to about 37–40, around the lower bound, and the resolution is lowered again. Resolution therefore changes back and forth for as long as the page is open (visible as sharpness changes and frame-rate jumps), and it makes any fps benchmark depend on the history of the controller.

## Fix

* `utils/adaptiveDpr.ts` (new): `dprBounds(refreshrate)` keeps drei's lower bound (40, or 60 above 100 Hz) and sets the upper bound to `lower × 2.25` (90 / 135 fps), because going up multiplies the pixels by 2.25. `UniverseScene.tsx` passes it to `PerformanceMonitor`. Effect: after one decline the resolution stays low unless the machine can hold the lower bound at the high resolution; on a 60 Hz display it does not climb back by itself. Trade-off: a machine that was briefly slow no longer returns to the sharper 1.5 resolution on its own (before, it did, and then pumped).
* `tests/adaptivedpr.test.ts` (new, 5 tests): the bounds; a model of a pixel-bound renderer showing that drei's defaults flip at least 10 times on a 60 fps machine (the observed bug), and that with `dprBounds` the resolution changes at most once for refresh rates 30–240 and any machine speed; a machine that holds 40+ fps at 1.5 keeps 1.5.
* `tests/e2e/smallbody-stress.mjs`: **additive only**: before the 8 ABBA rounds it waits until the canvas width has been stable for 6 s, and prints the canvas width per round and a NOTE if it changed. Threshold (20 %), rounds, bodies, speed and all assertions are unchanged.
* Opt-in `?dpr=` pin and `--dpr=` in the profile script from the previous step stay (diagnostics).

## What is verified and what is not

* Sandbox: `tsc` clean; `npm test` 320 tests, 319 pass, 0 fail, 1 skipped (real data); lint clean; stress test passes (two consecutive runs after the change: medians 22.7/22.3 and 24.4/24.3 fps, canvas 1280 px wide, no NOTE).
* **Not verified on your machine**: that with the new bounds the stress test now passes there. My sandbox renderer never reaches the 60 fps band, so the oscillation itself cannot be reproduced here; the model test and your pinned-resolution runs are the evidence. Please run `npm run build`, `npm start`, then `npm run test:e2e -- smallbody-stress` (or `node tests/e2e/smallbody-stress.mjs`) and check the printed canvas width and the NOTE line. If it still fails with a stable canvas width, send the output.
* Not measured: other machines, real GPUs, Firefox/Safari.

---

# First run of the stress test on the user's machine after the resolution fix (2026-11-22)

`node tests/e2e/smallbody-stress.mjs`: **PASS** (median running 39.3 vs paused 40.5 fps, 2.9 %, JS 77.5 vs 37.5 ms/s). But the new `NOTE` says the canvas width went 1920, 1920, 1280, 1920, 1920, 1280, 1920, 1920 across the 8 rounds, and the three large single-round "drops" (41.5 %, 22.1 %, −37.4 %) are exactly the rounds where the width changed. So the pass is the median surviving, not a clean measurement, and **the resolution is still pumping on that machine.**

With `dprBounds` the resolution cannot go back from 1280 to 1920 on a 60 Hz display (it needs 90 fps), so this pattern is what the **old** bounds do. The most likely reason is that the run used a build made before the fix (unpacking new sources and starting `npm start` without `npm run build` serves the old `.next`; the script run directly with `node` gave no warning, only `run-e2e.mjs` did). That is an inference, not shown: I cannot see which build the server had.

Change made for this: `scripts/stale-build.mjs` (new) is now called at the start of `tests/e2e/smallbody-stress.mjs` and `scripts/profile-smallbody.mjs` and prints `WARNING` when (a) the sources are newer than `.next/BUILD_ID`, or (b) the server does not serve the current build id (it was started before the last build). Warnings only; the results of the test are unchanged. Checked in the sandbox for the fresh case, the stale-sources case and the stale-server case.

Please: stop the running server (Ctrl+C), `npm run build`, `npm start`, then run the stress test again. Expected with the fix: no WARNING, the same canvas width in all 8 rounds, no NOTE. If a NOTE still appears with a fresh build and no WARNING, the fix does not hold on that machine and I need that output.

## Second run after the fix, and why the next step is a log, not another guess (2026-11-22)

The user's second run (no `WARNING`, so build and server looked current) again printed canvas widths 1920, 1920, 1280, 1920, 1920, 1920, 1920, 1920 and the same large single-round drops. Taken at face value, the resolution still went from 1280 back to 1920 (rounds 1 and 4), which `dprBounds` should not allow on a 60 Hz display (it needs 90 fps), so either the page is not running the new code in a way the mtime/build-id check can detect, or something other than the incline moves the resolution, for example the scene being re-created (which resets its state to 1.5). I cannot tell from the output. A later message from the user repeated that same output unchanged (identical numbers), so there is still no run of the version below.

To stop guessing, `universe/engine/UniverseScene.tsx` now writes `window.__dprPolicy` and `window.__dprLog` (mount/unmount, every decline/incline with the fps and refresh rate that triggered it, every pixel-ratio change), and `tests/e2e/smallbody-stress.mjs` and `scripts/profile-smallbody.mjs` print them (a page without the marker prints a WARNING that it runs older code). Sandbox example: `render-resolution policy: bounds-x2.25; events: 0.5s mount; 0.5s dpr 1.5; 4.5s decline (fps 22, refresh 22); 4.7s dpr 1; ...`. What to read on the user's machine: an `incline` event or a second `mount` right before a 1280 → 1920 change identifies the cause; no marker means old code.

## Third run on the user's machine (2026-11-22, 14:36): clean, stable-resolution result

`node tests/e2e/smallbody-stress.mjs`: **PASS** with the canvas at 1920 px wide in all 8 rounds, no `NOTE`, no `WARNING`.

| round | running fps | paused fps | drop |
|---|---|---|---|
| 1 | 51.3 | 55.3 | 7.1 % |
| 2 (paused first) | 51.1 | 56.0 | 8.8 % |
| 3 | 55.3 | 59.9 | 7.8 % |
| 4 (paused first) | 55.7 | 60.1 | 7.3 % |
| 5 | 57.1 | 59.7 | 4.4 % |
| 6 (paused first) | 54.3 | 59.9 | 9.4 % |
| 7 | 49.9 | 52.3 | 4.7 % |
| 8 (paused first) | 57.6 | 59.1 | 2.6 % |

Medians 55.3 running / 59.7 paused: a **7.4 % drop** (threshold 20 %; running reaches 92.6 % of paused), individual rounds 2.6–9.4 % (no round near 20 %), page JavaScript 75.8 vs 40.7 ms/s. This is the first run on that machine where the resolution did not change during the measurement, and the drop is consistent from round to round. It is slightly above the 3–4 % of the pinned-resolution profile runs; at a 60 fps display cap one frame is 16.7 ms, so about 1 ms of position update per frame (measured earlier on that machine: 0.99–1.1 ms) is about 6 %, which fits.

What this run does **not** show:

* It is not a test of the resolution fix. The machine was much faster than in the earlier runs (baseline 59.6 fps here vs 36.3 and 37.7 before, same code and settings), so the controller had no reason to move.
* The output has no `render-resolution policy` line, which the newest `smallbody-stress.mjs` prints. So the user ran the earlier version of the test (settle wait + NOTE, without the event log). The page-side policy marker is therefore still unconfirmed on that machine.
* Machine speed differs by about 60 % between sessions (baseline 37 vs 60 fps), so a pass or fail depends on what else is running; the `NOTE` and `render-resolution policy` lines are what make a run interpretable.
