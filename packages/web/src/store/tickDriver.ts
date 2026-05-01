import type { Action } from "@datacenter-tycoon/game-logic";

export type Speed = 0 | 1 | 2 | 3;

/** Milliseconds between ticks at each speed level. 0 = paused (Infinity). */
export const SPEED_INTERVALS_MS: Record<Speed, number> = {
  0: Infinity, // paused
  1: 10000,    // 1×  — 1 month / 10 seconds
  2: 5000,     // 2×  — 1 month / 5 seconds
  3: 2500,     // 3×  — 1 month / 2.5 seconds
};

export type RafFn = (cb: FrameRequestCallback) => number;
export type CafFn = (handle: number) => void;

/**
 * Starts an rAF-based tick driver that maps real elapsed time to game ticks.
 *
 * @param dispatch  - store.dispatch (only {type:"Tick"} will be emitted)
 * @param getSpeed  - reactive getter; called every frame so speed can change live
 * @param onFrame   - optional; called every animation frame with the current sub-tick
 *                    fraction (0..1). Use to drive day-level precision in the HUD
 *                    without putting the fraction into the Redux store.
 *                    Called with 0 while paused.
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
  onFrame?: (fraction: number) => void,
  raf: RafFn = (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (() => 0) as RafFn),
  caf: CafFn = (typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : () => {}),
  /** Override the starting value of 'last' (milliseconds). Defaults to
   *  performance.now(). Inject a fixed value in tests to get deterministic
   *  arithmetic without floating-point variance. */
  initialTime: number = performance.now(),
): () => void {
  const MAX_TICKS_PER_FRAME = 8;
  let handle = 0;
  let last = initialTime;
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

    // Emit sub-tick fraction so HUD components can advance the day display.
    const fraction = stepMs === Infinity ? 0 : Math.min(acc / stepMs, 1);
    onFrame?.(fraction);

    last = now;
    handle = raf(loop);
  };

  handle = raf(loop);
  return () => caf(handle);
}
