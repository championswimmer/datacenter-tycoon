import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Fixed integer start time — avoids floating-point variance in acc computations.
const T0 = 0;

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
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    let now = T0;
    for (let i = 0; i < 5; i++) {
      now += 10000;
      flush(now);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches ~1 tick per 10000 ms at speed 1", () => {
    const { raf, caf, flush } = createFakeRaf();
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    let now = T0;
    for (let i = 0; i < 5; i++) {
      now += SPEED_INTERVALS_MS[1];
      flush(now);
    }
    expect(dispatch).toHaveBeenCalledTimes(5);
    expect(dispatch).toHaveBeenCalledWith({ type: "Tick" });
  });

  it("dispatches ~1 tick per 5000 ms at speed 2", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 2;
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    let now = T0;
    for (let i = 0; i < 5; i++) {
      now += SPEED_INTERVALS_MS[2];
      flush(now);
    }
    expect(dispatch).toHaveBeenCalledTimes(5);
  });

  it("dispatches multiple ticks per frame when frames are slow", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 1 tick / 2500 ms
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // One big frame of 10000 ms → 4 ticks (10000 / 2500)
    flush(T0 + 10000);
    expect(dispatch).toHaveBeenCalledTimes(4);
  });

  it("drains accumulator on pause so no burst fires on resume", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1;
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // Pause while 30000 ms elapse — no ticks should fire
    speed = 0;
    flush(T0 + 30000);
    expect(dispatch).not.toHaveBeenCalled();

    // Resume — should fire exactly 1 tick (10000 ms elapsed since pause frame)
    speed = 1;
    flush(T0 + 40000);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("stop() cancels the driver loop", () => {
    const { raf, caf, flush } = createFakeRaf();
    const stop = startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);
    stop();

    flush(T0 + 50000);
    expect(dispatch).not.toHaveBeenCalled();
    expect(caf).toHaveBeenCalledOnce();
  });

  it("caps catchup ticks to MAX_TICKS_PER_FRAME (8) on a very long frame", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 2500 ms / tick
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // 300 seconds gap → theoretically 120 ticks; should be capped at 8
    flush(T0 + 300_000);
    expect(dispatch).toHaveBeenCalledTimes(8);
  });
});

describe("startTickDriver onFrame (tick fraction)", () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let onFrame: ReturnType<typeof vi.fn>;
  let speed: Speed;

  beforeEach(() => {
    dispatch = vi.fn();
    onFrame = vi.fn();
    speed = 1;
  });

  it("onFrame called with 0 while paused", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 0;
    startTickDriver(dispatch as (a: Action) => void, () => speed, onFrame, raf, caf, T0);

    flush(T0 + 5000);
    expect(onFrame).toHaveBeenCalledWith(0);
  });

  it("onFrame increases monotonically until tick fires, then resets", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1; // 10000 ms per tick
    startTickDriver(dispatch as (a: Action) => void, () => speed, onFrame, raf, caf, T0);

    // Half-way through the tick
    flush(T0 + 5000);
    const halfFraction = onFrame.mock.calls[0]?.[0] as number;
    expect(halfFraction).toBeCloseTo(0.5, 5);

    // Three-quarters through
    flush(T0 + 7500);
    const threeFraction = onFrame.mock.calls[1]?.[0] as number;
    expect(threeFraction).toBeGreaterThan(halfFraction);

    // Full tick fires — accumulator resets, fraction should be small (near 0)
    flush(T0 + 10000);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const afterTick = onFrame.mock.calls[2]?.[0] as number;
    expect(afterTick).toBeCloseTo(0, 5);
  });

  it("onFrame is clamped to 1 when acc overshoots just before a tick", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1; // 10000 ms per tick
    startTickDriver(dispatch as (a: Action) => void, () => speed, onFrame, raf, caf, T0);

    // Advance 9999 ms without crossing the tick boundary
    flush(T0 + 9999);
    const fraction = onFrame.mock.calls[0]?.[0] as number;
    expect(fraction).toBeLessThanOrEqual(1);
    expect(fraction).toBeGreaterThan(0.99);
  });

  it("existing callers still work without passing onFrame", () => {
    const { raf, caf, flush } = createFakeRaf();
    // No onFrame — should not throw
    expect(() => {
      startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);
      flush(T0 + 10000);
    }).not.toThrow();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
