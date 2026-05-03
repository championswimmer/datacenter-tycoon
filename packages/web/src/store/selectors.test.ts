import { describe, it, expect } from "vitest";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
  RACK_CATALOG,
  DEFAULT_REGION_ID,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import {
  selectTick,
  selectCash,
  selectPlayerName,
  selectAllDatacenters,
  selectDatacenter,
  selectActiveContracts,
  selectMarket,
  selectLedger,
  selectCapacity,
  selectOpexBreakdown,
  selectResourceUsage,
  selectMonthlyPnl,
  selectFreeCapacity,
  selectTotalRacks,
  selectTotalServers,
} from "./selectors.js";
import { nextDcId, nextRackPlacementId } from "./ids.js";

// ── Fixture builders ───────────────────────────────────────────────────────────

function freshState(): GameState {
  return newGame(42, { playerName: "Test Player" });
}

function stateWithOneDc(): GameState {
  const state = freshState();
  const dcId = nextDcId();
  return reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG["garage"]!.id,
    dcId,
    regionId: DEFAULT_REGION_ID,
  });
}

function stateWithDcAndRack(): GameState {
  let state = freshState();
  const dcId = nextDcId();
  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG["garage"]!.id,
    dcId,
    regionId: DEFAULT_REGION_ID,
  });
  state = reduce(state, {
    type: "PlaceRack",
    dcId,
    specId: RACK_CATALOG["C1"]!.id,
    row: 0,
    position: 0,
    placementId: nextRackPlacementId(),
  });
  return state;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("selectTick", () => {
  it("returns 0 on a fresh game", () => {
    expect(selectTick(freshState())).toBe(0);
  });

  it("increments after a Tick action", () => {
    const state = reduce(freshState(), { type: "Tick" });
    expect(selectTick(state)).toBe(1);
  });
});

describe("selectCash", () => {
  it("returns starting cash on a fresh game", () => {
    expect(selectCash(freshState())).toBeGreaterThan(0);
  });

  it("decreases after building a datacenter (capex)", () => {
    const before = selectCash(freshState());
    const after = selectCash(stateWithOneDc());
    expect(after).toBeLessThan(before);
  });
});

describe("selectPlayerName", () => {
  it("returns the player name from options", () => {
    expect(selectPlayerName(freshState())).toBe("Test Player");
  });
});

describe("selectAllDatacenters", () => {
  it("returns empty array on fresh game", () => {
    expect(selectAllDatacenters(freshState())).toHaveLength(0);
  });

  it("returns one DC after building", () => {
    expect(selectAllDatacenters(stateWithOneDc())).toHaveLength(1);
  });
});

describe("selectDatacenter", () => {
  it("returns undefined for unknown id", () => {
    const state = freshState();
    expect(selectDatacenter(state, "nonexistent" as ReturnType<typeof nextDcId>)).toBeUndefined();
  });

  it("returns the datacenter when found", () => {
    const state = stateWithOneDc();
    const dc = selectAllDatacenters(state)[0]!;
    expect(selectDatacenter(state, dc.id)).toBeDefined();
    expect(selectDatacenter(state, dc.id)!.id).toBe(dc.id);
  });
});

describe("selectMarket", () => {
  it("returns non-empty market on fresh game (auto-populated)", () => {
    expect(selectMarket(freshState()).length).toBeGreaterThan(0);
  });
});

describe("selectActiveContracts", () => {
  it("returns empty on fresh game", () => {
    expect(selectActiveContracts(freshState())).toHaveLength(0);
  });
});

describe("selectLedger", () => {
  it("returns empty on fresh game", () => {
    expect(selectLedger(freshState())).toHaveLength(0);
  });

  it("has a capex entry after building a datacenter", () => {
    const state = stateWithOneDc();
    const entries = selectLedger(state);
    expect(entries.some((e) => e.type === "capex")).toBe(true);
  });

  it("respects limit parameter and returns newest first", () => {
    let state = freshState();
    // Fire 3 ticks to create ledger entries (empty state, no DCs → no opex yet, but state still ticks)
    for (let i = 0; i < 3; i++) state = reduce(state, { type: "Tick" });
    // Now build DC and place racks to generate real ledger entries
    const dcId = nextDcId();
    state = reduce(state, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG["garage"]!.id,
      dcId,
    regionId: DEFAULT_REGION_ID,
    });
    for (let i = 0; i < 3; i++) state = reduce(state, { type: "Tick" });
    const all = selectLedger(state);
    const limited = selectLedger(state, 2);
    expect(limited.length).toBeLessThanOrEqual(2);
    // newest-first: first entry should have tick >= second entry
    if (limited.length === 2) {
      expect(limited[0]!.tick).toBeGreaterThanOrEqual(limited[1]!.tick);
    }
    expect(all.length).toBeGreaterThanOrEqual(limited.length);
  });
});

describe("selectCapacity", () => {
  it("returns zero capacity on fresh game (no racks)", () => {
    const { total } = selectCapacity(freshState());
    expect(total.vCpu).toBe(0);
    expect(total.ramGb).toBe(0);
    expect(total.storageTb).toBe(0);
    expect(total.gpuFlops).toBe(0);
  });

  it("returns non-zero capacity after placing a rack", () => {
    const { total } = selectCapacity(stateWithDcAndRack());
    expect(total.vCpu).toBeGreaterThan(0);
  });

  it("perDc array has one entry per datacenter", () => {
    const state = stateWithDcAndRack();
    const { perDc } = selectCapacity(state);
    expect(perDc).toHaveLength(state.datacenters.length);
  });

  it("total is the sum of perDc capacities", () => {
    const state = stateWithDcAndRack();
    const { total, perDc } = selectCapacity(state);
    const summedVCpu = perDc.reduce((s, { capacity }) => s + capacity.vCpu, 0);
    expect(total.vCpu).toBe(summedVCpu);
  });
});

describe("selectOpexBreakdown", () => {
  it("returns 0 total opex on fresh game (no DCs)", () => {
    expect(selectOpexBreakdown(freshState()).total).toBe(0);
  });

  it("returns positive opex after placing racks", () => {
    expect(selectOpexBreakdown(stateWithDcAndRack()).total).toBeGreaterThan(0);
  });

  it("total equals sum of perDc totals", () => {
    const state = stateWithDcAndRack();
    const { total, perDc } = selectOpexBreakdown(state);
    const summed = Math.round(
      perDc.reduce((s, { result }) => s + result.total, 0) * 100,
    ) / 100;
    expect(total).toBe(summed);
  });
});

describe("selectResourceUsage", () => {
  it("returns zero usage on fresh game", () => {
    const { total } = selectResourceUsage(freshState());
    expect(total.powerKw).toBe(0);
    expect(total.slotsUsed).toBe(0);
  });

  it("reflects rack power draw after placement", () => {
    const { total } = selectResourceUsage(stateWithDcAndRack());
    expect(total.powerKw).toBeGreaterThan(0);
    expect(total.slotsUsed).toBe(1);
  });
});

describe("selectMonthlyPnl", () => {
  it("returns all zeros on fresh game (no ticks)", () => {
    const pnl = selectMonthlyPnl(freshState());
    expect(pnl.revenue).toBe(0);
    expect(pnl.opex).toBe(0);
    expect(pnl.net).toBe(0);
  });

  it("shows negative net after ticking with a DC (opex with no revenue)", () => {
    let state = stateWithDcAndRack();
    state = reduce(state, { type: "Tick" });
    const pnl = selectMonthlyPnl(state);
    expect(pnl.opex).toBeGreaterThan(0);
    expect(pnl.net).toBeLessThan(0);
  });
});

describe("selectTotalRacks", () => {
  it("returns 0 on fresh game", () => {
    expect(selectTotalRacks(freshState())).toBe(0);
  });

  it("returns 1 after placing a rack", () => {
    expect(selectTotalRacks(stateWithDcAndRack())).toBe(1);
  });
});

describe("selectTotalServers", () => {
  it("returns 0 on fresh game", () => {
    expect(selectTotalServers(freshState())).toBe(0);
  });

  it("returns 1 after placing a rack", () => {
    expect(selectTotalServers(stateWithDcAndRack())).toBe(1);
  });
});

describe("selectFreeCapacity", () => {
  it("equals total capacity when no contracts are active", () => {
    const state = stateWithDcAndRack();
    const { total } = selectCapacity(state);
    const free = selectFreeCapacity(state);
    expect(free.vCpu).toBe(total.vCpu);
    expect(free.ramGb).toBe(total.ramGb);
  });

  it("is never negative", () => {
    const free = selectFreeCapacity(freshState());
    expect(free.vCpu).toBeGreaterThanOrEqual(0);
    expect(free.ramGb).toBeGreaterThanOrEqual(0);
    expect(free.storageTb).toBeGreaterThanOrEqual(0);
    expect(free.gpuFlops).toBeGreaterThanOrEqual(0);
  });
});
