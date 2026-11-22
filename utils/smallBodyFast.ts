import { solveKepler } from "./kepler";
import { jdOf, smallBodyPosition, type SmallBody } from "./smallBodies";
import { visualOrbitRadius } from "@/universe/objects/solarScale";

/**
 * Per-frame position writer for a large set of small bodies. Everything that does not depend on time (degree/radian conversion, the
 * rotation matrix of the orbit plane, the visual scale, the mean motion) is computed once per body; only the Kepler solve and two
 * trigonometric calls remain per evaluation. It computes exactly the same maths as `smallBodyPosition` + `toScene` (the unit test compares
 * them), so accuracy is unchanged. Open (hyperbolic) orbits use the reference path.
 */
export interface FastPropagator {
  write(out: Float32Array, i: number, days: number): void;
  /** Cumulative counters (diagnostics only): evaluations, cold-start fallbacks to the reference solver, Newton iterations of the warm path. */
  counters: { evals: number; fallbacks: number; iters: number; open: number; trigFree: number };
}

const STRIDE = 11;
export function buildPropagator(bodies: SmallBody[], toScene: (b: SmallBody, v: [number, number, number], out: Float32Array, o: number) => void): FastPropagator {
  const k = new Float64Array(bodies.length * STRIDE);
  const open = new Uint8Array(bodies.length);
  const rad = (d: number) => (d * Math.PI) / 180;
  bodies.forEach((b, i) => {
    if (b.e > 1 || !b.per) { open[i] = 1; return; }
    const cw = Math.cos(rad(b.w)), sw = Math.sin(rad(b.w)), ci = Math.cos(rad(b.i)), si = Math.sin(rad(b.i)), cn = Math.cos(rad(b.om)), sn = Math.sin(rad(b.om));
    const s = visualOrbitRadius(b.a) / b.a;
    const o = i * STRIDE;
    // ecliptic x,y,z = R * (xp, yp); scene = (x, z, -y) * s
    k[o] = rad(b.ma); k[o + 1] = (2 * Math.PI) / b.per; k[o + 2] = b.ep; k[o + 3] = b.e; k[o + 4] = b.a; k[o + 5] = b.a * Math.sqrt(1 - b.e * b.e);
    k[o + 6] = (cw * cn - sw * sn * ci) * s; k[o + 7] = (-sw * cn - cw * sn * ci) * s;
    k[o + 8] = (cw * sn + sw * cn * ci) * s; k[o + 9] = (-sw * sn + cw * cn * ci) * s;
    k[o + 10] = si * s; // z uses sw*si and cw*si, applied below
  });
  const sinW = new Float64Array(bodies.length), cosW = new Float64Array(bodies.length);
  bodies.forEach((b, i) => { sinW[i] = Math.sin(rad(b.w)); cosW[i] = Math.cos(rad(b.w)); });
  // Warm start from the previous evaluation of the same body. Kepler's equation is solved on the UNWRAPPED mean anomaly (sin/cos are periodic,
  // so no wrapping is needed); the guess is the previous eccentric anomaly advanced by dE = dM / (1 - e cos E), which is off by about dM^2
  // (about 1e-3 rad at 100x), so Newton needs two steps. Newton is quadratic: a step of size d leaves an error of about d^2, so stopping when
  // |d| < 1e-9 rad leaves about 1e-18 rad, far below float32 resolution (the buffer is float32) and the 1e-12 the reference solver uses.
  const TAU = 2 * Math.PI;
  const prevE = new Float64Array(bodies.length).fill(NaN), prevM = new Float64Array(bodies.length), prevC = new Float64Array(bodies.length), prevS = new Float64Array(bodies.length);
  // Evaluations since sin/cos of the carried E were last taken from the C library (see the trig-free path below).
  const since = new Uint8Array(bodies.length);
  const RESYNC = 32;
  const counters = { evals: 0, fallbacks: 0, iters: 0, open: 0, trigFree: 0 };
  let jdCache = NaN, jdFor = NaN;
  return {
    counters,
    write(out, i, days) {
      counters.evals++;
      if (open[i]) { counters.open++; toScene(bodies[i], smallBodyPosition(bodies[i], days), out, i * 3); return; }
      const o = i * STRIDE, e = k[o + 3];
      if (days !== jdFor) { jdFor = days; jdCache = jdOf(days); }
      const M = k[o] + k[o + 1] * (jdCache - k[o + 2]);
      let sE = 0, cE = 1, solved = false;
      if (prevE[i] === prevE[i]) {
        const pS = prevS[i], pC = prevC[i], pE = prevE[i];
        // 1) Trig-free step. Write E = pE + dl with dl small: sin/cos of E follow from the carried sin/cos of pE and short Taylor series of
        //    sin(dl), cos(dl) (|dl| < 0.25: truncation below 1e-10, and the next Newton step removes what is left). No libm call at all.
        //    f(dl) = E - e sin E - M with sin E = pS cos(dl) + pC sin(dl); Newton on dl. Every RESYNC evaluations sin/cos are taken from libm again,
        //    so the truncation error of this path cannot accumulate.
        let dl = (M - prevM[i]) / (1 - e * pC);
        if (dl < 0.25 && dl > -0.25) {
          const base = pE - e * pS - M;
          for (let it = 0; it < 6; it++) {
            counters.iters++;
            const d2 = dl * dl;
            const sd = dl * (1 - d2 * (1 / 6 - d2 * (1 / 120 - d2 * (1 / 5040 - d2 / 362880))));
            const cd = 1 - d2 * (0.5 - d2 * (1 / 24 - d2 * (1 / 720 - d2 / 40320)));
            sE = pS * cd + pC * sd; cE = pC * cd - pS * sd;
            const d = (base + dl - e * (sE - pS)) / (1 - e * cE);
            dl -= d;
            if (Math.abs(d) < 1e-10) {
              const sn = sE - cE * d, cn = cE + sE * d; sE = sn; cE = cn; // sin/cos of the corrected E (error about d^2)
              solved = true; break;
            }
          }
        }
        if (solved) {
          counters.trigFree++;
          const E = pE + dl;
          if (++since[i] >= RESYNC) { since[i] = 0; sE = Math.sin(E); cE = Math.cos(E); }
          prevE[i] = E; prevM[i] = M; prevC[i] = cE; prevS[i] = sE;
        } else {
          // 2) Warm Newton with libm sin/cos (big steps: date jumps, near-perihelion high-e bodies at 100x, reverse jumps).
          let E = pE + (M - prevM[i]) / (1 - e * pC);
          for (let it = 0; it < 8; it++) {
            counters.iters++;
            sE = Math.sin(E); cE = Math.cos(E);
            const d = (E - e * sE - M) / (1 - e * cE);
            E -= d;
            if (Math.abs(d) < 1e-9) { const sn = sE - cE * d, cn = cE + sE * d; sE = sn; cE = cn; solved = true; break; }
          }
          if (solved) { prevE[i] = E; prevM[i] = M; prevC[i] = cE; prevS[i] = sE; since[i] = 0; }
        }
      }
      if (!solved) {
        // 3) Cold start: the reference solver.
        counters.fallbacks++;
        const E = solveKepler(M, e);
        sE = Math.sin(E); cE = Math.cos(E);
        // solveKepler returns E on the wrapped branch; put it on the unwrapped one (E - e sin E = M mod 2 pi)
        prevE[i] = E + Math.round((M - (E - e * sE)) / TAU) * TAU; prevM[i] = M; prevC[i] = cE; prevS[i] = sE; since[i] = 0;
      }
      const xp = k[o + 4] * (cE - e), yp = k[o + 5] * sE;
      const x = k[o + 6] * xp + k[o + 7] * yp, y = k[o + 8] * xp + k[o + 9] * yp, z = (sinW[i] * xp + cosW[i] * yp) * k[o + 10];
      out[i * 3] = x; out[i * 3 + 1] = z; out[i * 3 + 2] = -y;
    },
  };
}
