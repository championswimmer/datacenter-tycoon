/**
 * tickFractionStore.ts — lightweight external store for the sub-tick fraction.
 *
 * The tickDriver emits a fraction (0..1) every animation frame so HUD widgets
 * can advance the displayed day without triggering a full Redux re-render cycle.
 *
 * Only components that call `useTickFraction()` re-render at 60 fps.
 * Everything else subscribes to the Redux store as normal.
 */

import { useSyncExternalStore } from "react";

let fraction = 0;
const listeners = new Set<() => void>();

/** Called by the tickDriver every animation frame with the current intra-day fraction. */
export function setTickFraction(f: number): void {
  if (f === fraction) return;
  fraction = f;
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): number {
  return fraction;
}

/**
 * React hook — subscribes to the per-frame subtick/day fraction.
 * Returns a number in [0, 1] representing how far through the current
 * authoritative day the simulation is. Returns 0 when paused.
 *
 * Only import this in components that genuinely need day-level precision
 * (TopBar date, contract remaining-time labels). Other components should
 * read the integer `state.tick` via `useSelector(selectTick)`.
 */
export function useTickFraction(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
