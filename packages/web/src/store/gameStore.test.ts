import { describe, it, expect, vi } from "vitest";
import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  RELIABILITY_MARKET_OFFER_COUNT,
  deserialize,
  newGame,
  reduce,
  serialize,
  type GameState,
} from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";

function hydrate(state: GameState): GameState {
  return deserialize(serialize(state));
}

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

  it("dispatch() keeps platinum reliability market expansion after hydration", () => {
    const hydrated = hydrate({
      ...newGame(seed),
      contractMarket: [],
      player: {
        ...newGame(seed).player,
        reliability: {
          score: 77,
          lastDelta: 3,
          recentOutcomes: [
            {
              contractId: "platinum-save" as GameState["player"]["reliability"]["recentOutcomes"][number]["contractId"],
              contractName: "Platinum Save",
              tick: 2,
              kind: "fulfilled",
            },
          ],
        },
      },
    });
    const store = createGameStore(hydrated);

    store.dispatch({ type: "Tick" });

    expect(store.getState().player.reliability.score).toBe(77);
    expect(store.getState().contractMarket).toHaveLength(RELIABILITY_MARKET_OFFER_COUNT.platinum);
  });

  it("dispatch() keeps silver reliability market contraction after hydration", () => {
    const hydrated = hydrate({
      ...newGame(seed),
      contractMarket: [],
      player: {
        ...newGame(seed).player,
        reliability: {
          score: 20,
          lastDelta: -12,
          recentOutcomes: [
            {
              contractId: "silver-save" as GameState["player"]["reliability"]["recentOutcomes"][number]["contractId"],
              contractName: "Silver Save",
              tick: 2,
              kind: "cancelled",
            },
          ],
        },
      },
    });
    const store = createGameStore(hydrated);

    store.dispatch({ type: "Tick" });

    expect(store.getState().player.reliability.score).toBe(20);
    expect(store.getState().contractMarket).toHaveLength(RELIABILITY_MARKET_OFFER_COUNT["silver"]);
  });

  it("dispatch() lowers opex after a short active contract completes and billing returns to idle baseline", () => {
    let state = newGame(seed, { startingCash: 1_000_000 });
    const dcId = "dc-store-opex-1" as GameState["datacenters"][number]["id"];

    state = reduce(state, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG.garage!.id,
      dcId,
      regionId: state.map.regions[0]!.id,
    });
    state = reduce(state, {
      type: "PlaceRack",
      dcId,
      specId: RACK_CATALOG.C1!.id,
      row: 0,
      position: 0,
      placementId: "rack-store-opex-1" as GameState["datacenters"][number]["placements"][number]["id"],
    });

    state = {
      ...state,
      contractMarket: [
        {
          id: "store-opex-contract" as GameState["contractMarket"][number]["id"],
          name: "Store Opex Contract",
          requirements: { vCpu: 32, ramGb: 64, storageTb: 0, gpuFlops: 0 },
          monthlyPayment: 40_000,
          penaltyPerMonth: 6_000,
          termMonths: 1,
          lifecycleState: "market_open",
          status: "offered",
          urgency: "standard",
          tier: 1,
          offeredAtTick: state.tick,
          expiresAtTick: state.tick + 6,
        },
      ],
    };
    state = reduce(state, {
      type: "AcceptContract",
      contractId: "store-opex-contract" as GameState["contractMarket"][number]["id"],
      dcId,
    });

    const store = createGameStore(state);
    store.dispatch({ type: "Tick" });
    store.dispatch({ type: "Tick" });

    const opexEntries = store
      .getState()
      .ledger
      .filter((entry) => entry.type === "opex")
      .sort((a, b) => a.tick - b.tick);

    expect(opexEntries.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(opexEntries[1]!.amount)).toBeLessThan(Math.abs(opexEntries[0]!.amount));
  });
});
