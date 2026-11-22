/**
 * Time-sliced updating of a large set of items (small-body positions) so one frame never has to evaluate all of them.
 * Pure and deterministic: the clock (`now`) and the per-item work are injected, so it is unit-tested without a browser.
 *
 * Each call evaluates items from `cursor` onward, in batches, and stops when `budgetMs` has been used (at least one batch always runs, so
 * progress is guaranteed). A full pass over all items is a "cycle". If a whole cycle used one single clock value (`days`), the state becomes
 * "settled" for that value and later calls with the same value do nothing, so a paused simulation costs nothing.
 * A call never starts a new cycle after finishing one, so one frame evaluates each item at most once (a running clock used to burn the whole
 * budget every frame re-evaluating items it had just placed).
 * `maxItems` caps one call (default: no cap). With a cap of ceil(total / 2) a full cycle always takes at least two calls and never more than the
 * time budget allows, so on any machine an item is at most two frames old while the clock runs and the work (and the GPU upload) per frame is bounded.
 * With a running clock and many items, each item is placed at the clock value of the frame in which it was evaluated, so items can lag the
 * clock by up to one cycle (a few frames); the featured bodies and the selected body are not sliced.
 */
export interface SliceState {
  cursor: number;
  /** Clock value in force when the current cycle started. */
  cycleDays: number;
  /** Clock value for which every item has been evaluated in one cycle (NaN if none). */
  settledDays: number;
}

export const newSliceState = (): SliceState => ({ cursor: 0, cycleDays: NaN, settledDays: NaN });
export const BATCH = 256;

/** Evaluates up to the budget and returns how many items it evaluated. */
export function stepSlice(
  state: SliceState,
  total: number,
  days: number,
  budgetMs: number,
  now: () => number,
  update: (index: number, days: number) => void,
  maxItems: number = total,
): number {
  if (total <= 0 || state.settledDays === days) return 0;
  if (state.cursor === 0) state.cycleDays = days;
  const t0 = now();
  let done = 0;
  do {
    const end = Math.min(state.cursor + BATCH, total, state.cursor + Math.max(1, maxItems - done));
    for (let i = state.cursor; i < end; i++) update(i, days);
    done += end - state.cursor;
    state.cursor = end;
    if (state.cursor >= total) {
      state.cursor = 0;
      if (state.cycleDays === days) { state.settledDays = days; return done; }
      state.cycleDays = days;
      return done; // never start a second pass inside one frame: one pass per frame is all the clock can have moved for
    }
  } while (done < maxItems && now() - t0 < budgetMs);
  return done;
}

/**
 * Which items did a `stepSlice` call that started at `cursor` and evaluated `n` items change? A call never wraps past the end of a cycle,
 * so that is one contiguous run: tell the GPU to upload only that run instead of the whole buffer. Returns null when the run does not
 * fit (never expected; the caller then uploads everything, which is always correct).
 */
export function changedRun(cursor: number, n: number, total: number): { start: number; count: number } | null {
  if (n <= 0 || cursor < 0 || cursor + n > total) return null;
  return { start: cursor, count: n };
}
