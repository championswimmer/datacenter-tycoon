import { describe, it, expect, vi } from "vitest";
import { newGame } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";

const seed = 42;

describe("createGameStore", () => {
  it("getState() returns the initial state", () => {
    const initial = newGame(seed);
    const store = createGameStore(initial);
    expect(store.getState()).toBe(initial);
  });

  it("dispatch() applies the action and updates state", () => {
    const store = createGameStore(newGame(seed));
    const before = store.getState().tick;
    store.dispatch({ type: "Tick" });
    expect(store.getState().tick).toBe(before + 1);
  });

  it("dispatch() notifies all subscribers", () => {
    const store = createGameStore(newGame(seed));
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    store.subscribe(cb1);
    store.subscribe(cb2);
    store.dispatch({ type: "Tick" });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("subscribe() returns an unsubscribe function that stops notifications", () => {
    const store = createGameStore(newGame(seed));
    const cb = vi.fn();
    const unsub = store.subscribe(cb);
    store.dispatch({ type: "Tick" });
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    store.dispatch({ type: "Tick" });
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });

  it("unsubscribing one listener does not affect others", () => {
    const store = createGameStore(newGame(seed));
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = store.subscribe(cb1);
    store.subscribe(cb2);
    unsub1();
    store.dispatch({ type: "Tick" });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("a subscriber that unsubscribes during dispatch doesn't break others", () => {
    const store = createGameStore(newGame(seed));
    const cb2 = vi.fn();
    let unsub: () => void;
    const cb1 = vi.fn(() => unsub());
    unsub = store.subscribe(cb1);
    store.subscribe(cb2);
    store.dispatch({ type: "Tick" });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    // second dispatch: cb1 must be silent
    store.dispatch({ type: "Tick" });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(2);
  });

  it("getState() inside subscriber sees the updated state", () => {
    const store = createGameStore(newGame(seed));
    let tickSeenInSubscriber = -1;
    store.subscribe(() => {
      tickSeenInSubscriber = store.getState().tick;
    });
    store.dispatch({ type: "Tick" });
    expect(tickSeenInSubscriber).toBe(1);
  });
});
