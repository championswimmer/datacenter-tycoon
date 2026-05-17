import { describe, it, expect, vi, beforeEach } from "vitest";
import { DAYS_PER_TICK, type Action } from "@datacenter-tycoon/game-logic";
import { startTickDriver, SPEED_INTERVALS_MS, type Speed } from "./tickDriver.js";

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

  it("dispatches no subticks when paused (speed 0)", () => {
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

  it("dispatches one full month as 30 Subtick actions at speed 1", () => {
    const { raf, caf, flush } = createFakeRaf();
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    let now = T0;
    for (let i = 0; i < DAYS_PER_TICK; i++) {
      now += SPEED_INTERVALS_MS[1] / DAYS_PER_TICK;
      flush(now);
    }
    expect(dispatch).toHaveBeenCalledTimes(DAYS_PER_TICK);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "Subtick" });
  });

  it("dispatches one full month as 30 Subtick actions at speed 2", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 2;
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    let now = T0;
    for (let i = 0; i < DAYS_PER_TICK; i++) {
      now += SPEED_INTERVALS_MS[2] / DAYS_PER_TICK;
      flush(now);
    }
    expect(dispatch).toHaveBeenCalledTimes(DAYS_PER_TICK);
  });

  it("dispatches multiple subticks per frame when frames are slow", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 1 month / 2500 ms
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // 250 ms is three day boundaries at speed 3.
    flush(T0 + 250);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it("drains accumulator on pause so no burst fires on resume", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1;
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // Pause while a whole month elapses — no subticks should fire.
    speed = 0;
    flush(T0 + 10000);
    expect(dispatch).not.toHaveBeenCalled();

    // Resume — only the post-resume elapsed time counts, so one day should fire.
    speed = 1;
    flush(T0 + 10000 + SPEED_INTERVALS_MS[1] / DAYS_PER_TICK);
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

  it("caps catchup subticks to MAX_SUBTICKS_PER_FRAME (8) on a very long frame", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 3; // 2500 ms / month
    startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);

    // 300 seconds gap → far more than 8 subticks; should still be capped at 8.
    flush(T0 + 300_000);
    expect(dispatch).toHaveBeenCalledTimes(8);
    expect(dispatch).toHaveBeenCalledWith({ type: "Subtick" });
  });
});

describe("startTickDriver onFrame (day fraction)", () => {
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

  it("onFrame increases monotonically within a day until a Subtick fires, then resets", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1;
    startTickDriver(dispatch as (a: Action) => void, () => speed, onFrame, raf, caf, T0);
    const dayStep = SPEED_INTERVALS_MS[1] / DAYS_PER_TICK;

    flush(T0 + dayStep / 2);
    const halfFraction = onFrame.mock.calls[0]?.[0] as number;
    expect(halfFraction).toBeCloseTo(0.5, 5);

    flush(T0 + dayStep * 0.75);
    const threeQuarterFraction = onFrame.mock.calls[1]?.[0] as number;
    expect(threeQuarterFraction).toBeGreaterThan(halfFraction);

    flush(T0 + dayStep);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const afterSubtick = onFrame.mock.calls[2]?.[0] as number;
    expect(afterSubtick).toBeCloseTo(0, 5);
  });

  it("onFrame is clamped to 1 when acc overshoots just before a subtick", () => {
    const { raf, caf, flush } = createFakeRaf();
    speed = 1;
    startTickDriver(dispatch as (a: Action) => void, () => speed, onFrame, raf, caf, T0);
    const dayStep = SPEED_INTERVALS_MS[1] / DAYS_PER_TICK;

    flush(T0 + dayStep - 0.001);
    const fraction = onFrame.mock.calls[0]?.[0] as number;
    expect(fraction).toBeLessThanOrEqual(1);
    expect(fraction).toBeGreaterThan(0.99);
  });

  it("existing callers still work without passing onFrame", () => {
    const { raf, caf, flush } = createFakeRaf();
    expect(() => {
      startTickDriver(dispatch as (a: Action) => void, () => speed, undefined, raf, caf, T0);
      flush(T0 + SPEED_INTERVALS_MS[1] / DAYS_PER_TICK);
    }).not.toThrow();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
