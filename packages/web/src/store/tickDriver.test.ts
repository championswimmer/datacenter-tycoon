import { describe, it, expect, vi, beforeEach } from "vitest";
import { startTickDriver, SPEED_INTERVALS_MS, type Speed } from "./tickDriver.js";
import type { Action } from "@datacenter-tycoon/game-logic";

/** Minimal fake-rAF harness: collects registered callbacks so the test drives frames. */
function createFakeRaf() {
  let handle = 0;
  const pending = new Map<number, FrameRequestCallback>();

  const raf = vi.fn((cb: FrameRequestCallback) => {
    handle++;
    pending.set(handle, cb);
    return handle;
  });

  const caf = vi.fn((h: number) => {
    pending.delete(h);
  });

  /** Fire all pending callbacks with the given timestamp, then clear the queue. */
  const flush = (now: number) => {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const cb of callbacks) cb(now);
  };

  return { raf, caf, flush };
}

describe("startTickDriver", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let speed: Speed;

  beforeEach(() => {
    dispatch = vi.fn();
    speed = 1;
  });

  it("dispatches no ticks when paused (speed 0)", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 0;
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);

    // Simulate 5 frames spanning 5000 ms — no tick should fire
    let now = performance.now();
    for (let i = 0; i < 5; i++) {
      now += 1000;
      flush(now);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches ~1 tick per 1000 ms at speed 1", () => {
    const { raf, caf, flush } = createFakeRaf();
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);

    let now = performance.now();
    // 5 frames, each 1000 ms apart → should fire 5 Tick actions
    for (let i = 0; i < 5; i++) {
      now += SPEED_INTERVALS_MS[1];
      flush(now);
    }
    // The first iteration has no accumulated time yet (last = now at start)
    // so from the first flush onward we get 1 tick per frame
    expect(dispatch).toHaveBeenCalledTimes(5);
    expect(dispatch).toHaveBeenCalledWith({ type: "Tick" });
  });

  it("dispatches ~2 ticks per 1000 ms at speed 2", () => {
    const { raf, caf, flush } = createFakeRaf();
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);
    speed = 2;

    let now = performance.now();
    // 5 frames, each 500 ms apart → 1 tick per frame → 5 ticks total
    for (let i = 0; i < 5; i++) {
      now += SPEED_INTERVALS_MS[2];
      flush(now);
    }
    expect(dispatch).toHaveBeenCalledTimes(5);
  });

  it("dispatches multiple ticks per frame when frames are slow", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 1 tick / 250 ms
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);

    let now = performance.now();
    // One big frame of 1000 ms → 4 ticks (1000 / 250)
    now += 1000;
    flush(now);
    expect(dispatch).toHaveBeenCalledTimes(4);
  });

  it("drains accumulator on pause so no burst fires on resume", () => {
    const { raf, caf, flush } = createFakeRaf();
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);

    let now = performance.now();
    // Accumulate 3 seconds while paused
    speed = 0;
    now += 3000;
    flush(now);
    expect(dispatch).not.toHaveBeenCalled();

    // Resume — should not burst 3 ticks
    speed = 1;
    now += 1000; // exactly 1 tick's worth since resume
    flush(now);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("stop() cancels the driver loop", () => {
    const { raf, caf, flush } = createFakeRaf();
    const stop = startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);
    stop();

    let now = performance.now();
    now += 5000;
    // caf was called → no pending callbacks, flush is a no-op
    flush(now);
    expect(dispatch).not.toHaveBeenCalled();
    expect(caf).toHaveBeenCalledOnce();
  });

  it("caps catchup ticks to MAX_TICKS_PER_FRAME (8) on a very long frame", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 250 ms / tick
    startTickDriver(dispatch as (a: Action) => void, () => speed, raf, caf);

    let now = performance.now();
    // 30 seconds gap → theoretically 120 ticks; should be capped at 8
    now += 30_000;
    flush(now);
    expect(dispatch).toHaveBeenCalledTimes(8);
  });
});
