import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
  RACK_CATALOG,
  MARKET_REFRESH_SIZE,
} from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";
import { MarketList } from "./MarketList.js";
import { selectMarketContractViews } from "../../store/selectors.js";

function buildMarketState(): GameState {
  let state = newGame(42, { playerName: "Acme Corp" });
  const dcId = nextDcId();
  const firstRegionId = state.map.regions[0]!.id;
  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId,
    regionId: firstRegionId,
  });
  state = reduce(state, {
    type: "PlaceRack",
    dcId,
    specId: RACK_CATALOG.C1!.id,
    row: 0,
    position: 0,
    placementId: nextRackPlacementId(),
  });

  const contract: Contract = {
    id: "contract-market-1" as Contract["id"],
    name: "Burst Compute",
    requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
    monthlyPayment: 12000,
    penaltyPerMonth: 4000,
    termMonths: 3,
    slaTargetPercent: 90,
    currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
    lifecycleState: "market_open",
    status: "offered",
    urgency: "standard",
    tier: 1,
    offeredAtTick: state.tick,
    expiresAtTick: (state.tick + 6) as Contract["expiresAtTick"],
  };

  return {
    ...state,
    contractMarket: [contract],
    activeContracts: [],
  };
}

function buildRegionalAssignmentState(): GameState {
  let state = newGame(42, { playerName: "Acme Corp", startingCash: 8_000_000 });
  const euDcId = nextDcId();
  const usaDcId = nextDcId();
  const euRegionId = state.map.regions.find((region) => region.id.toString().startsWith("eu_"))!.id;
  const usaRegionId = state.map.regions.find((region) => region.id.toString().startsWith("us_"))!.id;

  for (const [dcId, regionId] of [[euDcId, euRegionId], [usaDcId, usaRegionId]] as const) {
    state = reduce(state, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG.garage!.id,
      dcId,
      regionId,
    });
    state = reduce(state, {
      type: "PlaceRack",
      dcId,
      specId: RACK_CATALOG.C1!.id,
      row: 0,
      position: 0,
      placementId: nextRackPlacementId(),
    });
  }

  const contract: Contract = {
    id: "contract-market-region" as Contract["id"],
    name: "Regional Burst Compute",
    requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
    monthlyPayment: 12_000,
    penaltyPerMonth: 4_000,
    termMonths: 3,
    slaTargetPercent: 90,
    currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
    lifecycleState: "market_open",
    status: "offered",
    urgency: "standard",
    tier: 1,
    regionAffinity: {
      key: "eu",
      allowedRegionIds: state.map.regions
        .filter((region) => region.id.toString().startsWith("eu_"))
        .map((region) => region.id),
    },
    offeredAtTick: state.tick,
    expiresAtTick: (state.tick + 6) as Contract["expiresAtTick"],
  };

  return {
    ...state,
    contractMarket: [contract],
    activeContracts: [],
  };
}

function buildWrongRegionState(): GameState {
  let state = newGame(42, { playerName: "Acme Corp", startingCash: 4_000_000 });
  const usaDcId = nextDcId();
  const usaRegionId = state.map.regions.find((region) => region.id.toString().startsWith("us_"))!.id;
  const euRegionIds = state.map.regions
    .filter((region) => region.id.toString().startsWith("eu_"))
    .map((region) => region.id);

  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId: usaDcId,
    regionId: usaRegionId,
  });
  state = reduce(state, {
    type: "PlaceRack",
    dcId: usaDcId,
    specId: RACK_CATALOG.C1!.id,
    row: 0,
    position: 0,
    placementId: nextRackPlacementId(),
  });

  const contract: Contract = {
    id: "contract-market-wrong-region" as Contract["id"],
    name: "EU Sovereignty Compute",
    requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
    monthlyPayment: 12_000,
    penaltyPerMonth: 4_000,
    termMonths: 3,
    slaTargetPercent: 90,
    currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
    lifecycleState: "market_open",
    status: "offered",
    urgency: "standard",
    tier: 1,
    regionAffinity: {
      key: "eu",
      allowedRegionIds: euRegionIds,
    },
    offeredAtTick: state.tick,
    expiresAtTick: (state.tick + 6) as Contract["expiresAtTick"],
  };

  return {
    ...state,
    contractMarket: [contract],
    activeContracts: [],
  };
}

function renderMarket(state = buildMarketState()) {
  const store = createGameStore(state);
  const contractIds = new Set(store.getState().contractMarket.map((contract) => contract.id));
  render(
    <StoreProvider store={store}>
      <MarketList contractViews={selectMarketContractViews(store.getState()).filter((view) => contractIds.has(view.contract.id))} />
    </StoreProvider>,
  );
  return store;
}

describe("MarketList", () => {
  it("renders free capacity comparison beside requirements", () => {
    renderMarket();
    expect(screen.getByText("FREE CAPACITY")).toBeTruthy();
    expect(screen.getByText("Burst Compute")).toBeTruthy();
    expect(screen.getByText(/90% SLA/)).toBeTruthy();
    expect(screen.getByText(/up to 3 failed days\/mo/)).toBeTruthy();
  });

  it("shows months-based expiry label (not ticks)", () => {
    // state.tick = 0, expiresAtTick = 6 → 6 months left
    renderMarket();
    expect(screen.getByText("6 months left")).toBeTruthy();
  });

  it("uses authoritative subtick plus animation fraction for offer expiry", () => {
    const state = { ...buildMarketState(), tick: 0, subtick: 10 };
    renderMarket(state);
    expect(screen.getByText("5 months 20 days left")).toBeTruthy();
  });

  it("renders affinity badges and allowed-region copy for restricted offers", () => {
    const state = buildMarketState();
    const allowedRegionIds = state.map.regions
      .filter((region) => region.id.toString().startsWith("eu_"))
      .map((region) => region.id);
    state.contractMarket = [{
      ...state.contractMarket[0]!,
      name: "EU Compliance Stack",
      regionAffinity: {
        key: "eu",
        allowedRegionIds,
      },
    }];

    renderMarket(state);

    expect(screen.getByText("EU ONLY")).toBeTruthy();
    expect(screen.getByText(/Allowed regions:/i)).toBeTruthy();
    expect(screen.getByText(/DUB · Dublin · EU West/i)).toBeTruthy();
  });

  it("shows silver-tier market hints when reliability is limiting longer work", () => {
    const state = buildMarketState();
    state.player.reliability = {
      score: 20,
      lastDelta: -12,
      recentOutcomes: [
        {
          contractId: "contract-bad" as Contract["id"],
          contractName: "Lost Customer",
          tick: 1,
          kind: "cancelled",
        },
      ],
    };

    renderMarket(state);

    expect(screen.getByText(/Low reliability is limiting longer-term work/i)).toBeTruthy();
  });

  it("shows platinum market hints on long-term opportunities", () => {
    const state = buildMarketState();
    state.player.reliability = {
      score: 77,
      lastDelta: 3,
      recentOutcomes: [
        {
          contractId: "contract-good" as Contract["id"],
          contractName: "Trusted Anchor",
          tick: 1,
          kind: "fulfilled",
        },
      ],
    };
    state.contractMarket = [
      {
        ...state.contractMarket[0]!,
        urgency: "anchor",
        termMonths: 12,
      },
    ];

    renderMarket(state);

    expect(screen.getByText(/Platinum reliability is helping surface longer-term offers like this/i)).toBeTruthy();
  });

  it("shows a wrong-region fit badge when no datacenter exists in the contract whitelist", () => {
    renderMarket(buildWrongRegionState());

    expect(screen.getByTitle("No eligible datacenter region")).toBeTruthy();
    expect(screen.queryByTitle("Insufficient capacity")).toBeNull();
  });

  it("shows only region-eligible datacenters in the accept picker for restricted offers", () => {
    const store = renderMarket(buildRegionalAssignmentState());
    const euDcName = store.getState().datacenters.find((dc) => dc.regionId.toString().startsWith("eu_"))!.name;
    const usaDcName = store.getState().datacenters.find((dc) => dc.regionId.toString().startsWith("us_"))!.name;

    fireEvent.click(screen.getByText("ACCEPT CONTRACT"));

    expect(screen.getByText(/Click an eligible datacenter to accept this contract/i)).toBeTruthy();
    expect(screen.getByText(/Only datacenters in the allowed regions can accept this contract/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(euDcName) })).toBeTruthy();
    expect(screen.queryByRole("button", { name: new RegExp(usaDcName) })).toBeNull();
    expect(screen.getByText(/Unavailable outside allowed regions/i)).toBeTruthy();
    expect(screen.getByText(usaDcName)).toBeTruthy();
  });

  it("keeps unrestricted offers assignable from every datacenter", () => {
    const restrictedState = buildRegionalAssignmentState();
    const unrestrictedState: GameState = {
      ...restrictedState,
      contractMarket: [{
        ...restrictedState.contractMarket[0]!,
        id: "contract-market-global" as Contract["id"],
        regionAffinity: undefined,
      }],
    };
    const store = renderMarket(unrestrictedState);
    const dcNames = store.getState().datacenters.map((dc) => dc.name);

    fireEvent.click(screen.getByText("ACCEPT CONTRACT"));

    expect(screen.queryByText(/Unavailable outside allowed regions/i)).toBeNull();
    for (const dcName of dcNames) {
      expect(screen.getByText(dcName)).toBeTruthy();
    }
  });

  it("accepts a contract directly when a fitting datacenter is clicked", () => {
    const store = renderMarket();
    const dcName = store.getState().datacenters[0]!.name;

    fireEvent.click(screen.getByText("ACCEPT CONTRACT"));

    expect(screen.getByText(/Click an eligible datacenter to accept this contract/i)).toBeTruthy();
    expect(screen.queryByText("CONFIRM ACCEPT")).toBeNull();

    fireEvent.click(screen.getByText(dcName));

    expect(store.getState().contractMarket).toHaveLength(MARKET_REFRESH_SIZE);
    expect(store.getState().activeContracts).toHaveLength(1);
    expect(store.getState().activeContracts[0]?.name).toBe("Burst Compute");
  });
});
