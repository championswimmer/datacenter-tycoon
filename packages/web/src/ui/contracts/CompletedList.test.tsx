import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, newGame } from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { CompletedList } from "./CompletedList.js";

function buildHistoricalState(): GameState {
  const state = newGame(42, { playerName: "Acme Corp" });
  const assignedDcId = (state.datacenters[0]?.id ?? "dc-history") as NonNullable<Contract["assignedDcId"]>;
  const assignedRegionId = state.map.regions.find((region) => region.id.toString().startsWith("eu_"))?.id
    ?? state.map.regions[0]!.id;
  const allowedRegionIds = state.map.regions
    .filter((region) => region.id.toString().startsWith("eu_"))
    .map((region) => region.id);

  const historicalContract: Contract = {
    id: "contract-history-1" as Contract["id"],
    name: "EU Archive Vault",
    requirements: { vCpu: 0, ramGb: 64, storageTb: 10, gpuFlops: 0 },
    monthlyPayment: 8000,
    penaltyPerMonth: 3000,
    termMonths: 12,
    slaTargetPercent: 90,
    currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
    lifecycleState: "completed",
    status: "expired",
    urgency: "standard",
    tier: 1,
    regionAffinity: {
      key: "eu",
      allowedRegionIds,
    },
    offeredAtTick: 0,
    expiresAtTick: 12,
    startedAtTick: 0,
    assignedDcId,
  };

  return {
    ...state,
    datacenters: [{
      id: assignedDcId,
      name: "Frankfurt DC",
      spec: DATACENTER_CATALOG.garage!,
      placements: [],
      builtAtTick: 0,
      regionId: assignedRegionId,
      maintenanceStaff: 0,
    }],
    contracts: [historicalContract],
    contractMarket: [],
    activeContracts: [],
  };
}

function renderCompleted(state = buildHistoricalState()) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <CompletedList />
    </StoreProvider>,
  );
  return store;
}

describe("CompletedList", () => {
  it("renders affinity badges and allowed-region copy for historical contracts", () => {
    renderCompleted();

    expect(screen.getByText("EU ONLY")).toBeTruthy();
    expect(screen.getByText(/Allowed regions:/i)).toBeTruthy();
    expect(screen.getByText(/DUB · Dublin · EU West/i)).toBeTruthy();
  });
});
