import type { Action } from "@datacenter-tycoon/game-logic";

export type Speed = 0 | 1 | 2 | 3;

/** Milliseconds between ticks at each speed level. 0 = paused (Infinity). */
export const SPEED_INTERVALS_MS: Record<Speed, number> = {
  0: Infinity, // paused
  1: 1000,     // 1×  — 1 tick / second
  2: 500,      // 2×  — 2 ticks / second
  3: 250,      // 3×  — 4 ticks / second
};

export type RafFn = (cb: FrameRequestCallback) => number;
export type CafFn = (handle: number) => void;

/**
 * Starts an rAF-based tick driver that maps real elapsed time to game ticks.
 *
 * @param dispatch  - store.dispatch (only {type:"Tick"} will be emitted)
 * @param getSpeed  - reactive getter; called every frame so speed can change live
 * @param raf       - injectable requestAnimationFrame (defaults to global, override in tests)
 * @param caf       - injectable cancelAnimationFrame (defaults to global, override in tests)
 * @returns         - stop() function; call it to cancel the driver (e.g. on unmount)
 *
 * Design notes:
 *  - Accumulator is reset to 0 when paused to avoid a burst of ticks on unpause.
 *  - We clamp the catchup loop to MAX_TICKS_PER_FRAME to stay smooth even if
 *    the tab was backgrounded for a long time (browser throttles rAF to ~1 fps).
 */
export function startTickDriver(
  dispatch: (action: Action) => void,
  getSpeed: () => Speed,
  raf: RafFn = (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (() => 0) as RafFn),
  caf: CafFn = (typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : () => {}),
): () => void {
  const MAX_TICKS_PER_FRAME = 8;
  let handle = 0;
  let last = performance.now();
  let acc = 0;

  const loop: FrameRequestCallback = (now: number) => {
    const speed = getSpeed();
    const stepMs = SPEED_INTERVALS_MS[speed];

    if (stepMs === Infinity) {
      // Paused — drain the accumulator so no burst fires on resume.
      acc = 0;
    } else {
      acc += now - last;
      let ticks = 0;
      while (acc >= stepMs && ticks < MAX_TICKS_PER_FRAME) {
        dispatch({ type: "Tick" });
        acc -= stepMs;
        ticks++;
      }
      // If we hit the cap (heavily throttled tab), discard excess to stay fair.
      if (ticks === MAX_TICKS_PER_FRAME) {
        acc = 0;
      }
    }

    last = now;
    handle = raf(loop);
  };

  handle = raf(loop);
  return () => caf(handle);
}
