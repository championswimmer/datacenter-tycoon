import { beforeEach, describe, expect, it, vi } from "vitest";
import { DATACENTER_CATALOG, RACK_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";
import { nextDcId, nextRackPlacementId } from "./ids.js";

const musicStart = vi.fn();
const musicStop = vi.fn();
const ambientStart = vi.fn();
const ambientStop = vi.fn();
const ambientSetUsage = vi.fn();
const ambientSetSpeed = vi.fn();
const ambientSetPaused = vi.fn();
const playSound = vi.fn();

vi.mock("../audio/AudioEngine.js", () => ({
  music: {
    start: musicStart,
    stop: musicStop,
  },
  ambient: {
    start: ambientStart,
    stop: ambientStop,
    setUsage: ambientSetUsage,
    setSpeed: ambientSetSpeed,
    setPaused: ambientSetPaused,
  },
  playSound,
}));

const { attachAudioEvents } = await import("./audioEvents.js");

function stateWithOneRack(): GameState {
  let state = newGame(42, { startingCash: 2_000_000, playerName: "Audio Test" });
  const dcId = nextDcId();
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
    placementId: nextRackPlacementId(),
  });
  return state;
}

describe("attachAudioEvents", () => {
  beforeEach(() => {
    musicStart.mockClear();
    musicStop.mockClear();
    ambientStart.mockClear();
    ambientStop.mockClear();
    ambientSetUsage.mockClear();
    ambientSetSpeed.mockClear();
    ambientSetPaused.mockClear();
    playSound.mockClear();
  });

  it("does not recompute ambient usage on ticks that leave datacenter capacity unchanged", () => {
    const store = createGameStore(stateWithOneRack());
    const stop = attachAudioEvents(store);

    store.dispatch({ type: "Tick" });
    expect(musicStart).toHaveBeenCalledTimes(1);
    expect(ambientStart).toHaveBeenCalledTimes(1);
    expect(ambientSetUsage).toHaveBeenCalledTimes(1);
    expect(ambientSetSpeed).toHaveBeenCalledTimes(1);
    expect(ambientSetPaused).toHaveBeenCalledTimes(1);

    store.dispatch({ type: "Tick" });
    expect(ambientSetUsage).toHaveBeenCalledTimes(1);
    expect(ambientSetSpeed).toHaveBeenCalledTimes(1);
    expect(ambientSetPaused).toHaveBeenCalledTimes(1);

    stop();
  });

  it("only plays contract-accepted SFX when the active contract id set changes", () => {
    let state = stateWithOneRack();
    const dcId = state.datacenters[0]!.id;
    const offered = {
      ...(state.contractMarket.find((contract) => contract.requirements.vCpu > 0) ?? state.contractMarket[0]!),
      requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
      termMonths: 6,
    };
    state = {
      ...state,
      contracts: [offered],
      contractMarket: [offered],
      activeContracts: [],
    };

    const store = createGameStore(state);
    const stop = attachAudioEvents(store);

    store.dispatch({ type: "AcceptContract", contractId: offered.id, dcId });
    expect(playSound).toHaveBeenCalledWith("contract_accepted", false);
    const acceptedCallCount = playSound.mock.calls.length;

    store.dispatch({ type: "Tick" });
    expect(playSound.mock.calls.filter(([sound]) => sound === "contract_accepted")).toHaveLength(1);
    expect(playSound.mock.calls.length).toBeGreaterThanOrEqual(acceptedCallCount);

    stop();
  });
});
