import { Profiler, type ReactElement } from "react";
import { cleanup, render, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  newGame,
  reduce,
  serialize,
  deserialize,
  type Contract,
  type GameState,
} from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../store/gameStore.js";
import { StoreProvider } from "../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../store/ids.js";
import { StartScreen } from "../ui/start/StartScreen.js";
import { Shell } from "../ui/shell/Shell.js";
import { ActiveList } from "../ui/contracts/ActiveList.js";
import { MarketList } from "../ui/contracts/MarketList.js";
import { Grid } from "../ui/floor/Grid.js";
import type { RackMaintenanceView } from "../store/selectors.js";
import { selectMarketContractViews } from "../store/selectors.js";
import type { RackActivityView } from "@datacenter-tycoon/game-logic";

interface RenderMetric {
  scenario: string;
  commits: number;
  totalActualDurationMs: number;
  maxActualDurationMs: number;
  wallClockMs: number;
}

interface SaveMetric {
  scenario: string;
  serializeMs: number;
  deserializeMs: number;
  bytes: number;
}

const TEST_PLAYER = "Perf Harness";

afterEach(() => {
  cleanup();
  window.location.hash = "#/";
  window.innerWidth = 1440;
});

function measureRenderScenario(scenario: string, ui: ReactElement): RenderMetric {
  let commits = 0;
  let totalActualDurationMs = 0;
  let maxActualDurationMs = 0;

  const startedAt = performance.now();
  render(
    <Profiler
      id={scenario}
      onRender={(_id, _phase, actualDuration) => {
        commits += 1;
        totalActualDurationMs += actualDuration;
        maxActualDurationMs = Math.max(maxActualDurationMs, actualDuration);
      }}
    >
      {ui}
    </Profiler>,
  );
  const finishedAt = performance.now();

  return {
    scenario,
    commits,
    totalActualDurationMs: roundMetric(totalActualDurationMs),
    maxActualDurationMs: roundMetric(maxActualDurationMs),
    wallClockMs: roundMetric(finishedAt - startedAt),
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildLargeFacilityState(): GameState {
  let state = newGame(42, {
    playerName: TEST_PLAYER,
    startingCash: 50_000_000,
  });

  const regionIds = state.map.regions.slice(0, 3).map((region) => region.id);
  const rackSpecs = [RACK_CATALOG.C1!.id, RACK_CATALOG.M1!.id, RACK_CATALOG.S1!.id, RACK_CATALOG.G1!.id] as const;

  for (const regionId of regionIds) {
    const dcId = nextDcId();
    state = reduce(state, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG.garage!.id,
      dcId,
      regionId,
    });

    const spec = DATACENTER_CATALOG.garage!;
    let cursor = 0;
    for (let row = 0; row < spec.rows; row += 1) {
      for (let position = 0; position < spec.positionsPerRow; position += 1) {
        state = reduce(state, {
          type: "PlaceRack",
          dcId,
          specId: rackSpecs[cursor % rackSpecs.length]!,
          row,
          position,
          placementId: nextRackPlacementId(),
        });
        cursor += 1;
      }
    }
  }

  for (let month = 0; month < 12; month += 1) {
    state = reduce(state, { type: "Tick" });
  }

  return state;
}

function buildContractsState(): GameState {
  let state = buildLargeFacilityState();
  const [assignedDcA, assignedDcB] = state.datacenters;

  const activeContracts: Contract[] = [
    {
      id: "perf-active-1" as Contract["id"],
      name: "Metro Burst Compute",
      requirements: { vCpu: 32, ramGb: 0, storageTb: 0, gpuFlops: 0 },
      monthlyPayment: 42_000,
      penaltyPerMonth: 10_000,
      termMonths: 6,
      slaTargetPercent: 90,
      currentSlaWindow: { sampledDays: 18, servedDays: 17, failedDays: 1 },
      lifecycleState: "serving",
      status: "active",
      urgency: "rush",
      tier: 2,
      offeredAtTick: 3,
      expiresAtTick: 18,
      startedAtTick: 6,
      assignedDcId: assignedDcA!.id,
    },
    {
      id: "perf-active-2" as Contract["id"],
      name: "Regional Memory Grid",
      requirements: { vCpu: 0, ramGb: 128, storageTb: 0, gpuFlops: 0 },
      monthlyPayment: 36_000,
      penaltyPerMonth: 8_000,
      termMonths: 9,
      slaTargetPercent: 90,
      currentSlaWindow: { sampledDays: 20, servedDays: 18, failedDays: 2 },
      lifecycleState: "serving",
      status: "active",
      urgency: "standard",
      tier: 2,
      offeredAtTick: 4,
      expiresAtTick: 24,
      startedAtTick: 5,
      assignedDcId: assignedDcB!.id,
    },
  ];

  const historicalContracts: Contract[] = [
    {
      id: "perf-history-1" as Contract["id"],
      name: "Archive Retention",
      requirements: { vCpu: 0, ramGb: 32, storageTb: 24, gpuFlops: 0 },
      monthlyPayment: 12_000,
      penaltyPerMonth: 3_000,
      termMonths: 4,
      slaTargetPercent: 90,
      currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
      lifecycleState: "completed",
      status: "expired",
      urgency: "standard",
      tier: 1,
      offeredAtTick: 1,
      expiresAtTick: 5,
      startedAtTick: 1,
      assignedDcId: assignedDcA!.id,
    },
  ];

  const marketContracts: Contract[] = [
    {
      id: "perf-market-1" as Contract["id"],
      name: "AI Model Training Job",
      requirements: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 64 },
      monthlyPayment: 150_000,
      penaltyPerMonth: 30_000,
      termMonths: 8,
      slaTargetPercent: 95,
      currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
      lifecycleState: "market_open",
      status: "offered",
      urgency: "anchor",
      tier: 3,
      offeredAtTick: state.tick,
      expiresAtTick: state.tick + 6,
      regionAffinity: {
        key: "eu",
        allowedRegionIds: state.map.regions
          .filter((region) => region.id.toString().startsWith("eu_"))
          .map((region) => region.id),
      },
    },
    {
      id: "perf-market-2" as Contract["id"],
      name: "Edge Compute Burst",
      requirements: { vCpu: 48, ramGb: 64, storageTb: 0, gpuFlops: 0 },
      monthlyPayment: 28_000,
      penaltyPerMonth: 7_000,
      termMonths: 3,
      slaTargetPercent: 90,
      currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
      lifecycleState: "market_open",
      status: "offered",
      urgency: "rush",
      tier: 2,
      offeredAtTick: state.tick,
      expiresAtTick: state.tick + 3,
    },
  ];

  return {
    ...state,
    contracts: [...historicalContracts, ...activeContracts, ...marketContracts],
    activeContracts,
    contractMarket: marketContracts,
    player: {
      ...state.player,
      reliability: {
        score: 77,
        lastDelta: 3,
        recentOutcomes: [
          {
            contractId: activeContracts[0]!.id,
            contractName: activeContracts[0]!.name,
            tick: state.tick - 1,
            kind: "fulfilled",
          },
        ],
      },
    },
  };
}

function buildMaintenanceMap(state: GameState): Map<RackMaintenanceView["placementId"], RackMaintenanceView> {
  return new Map(
    state.datacenters.flatMap((datacenter) =>
      datacenter.placements.map((placement) => [
        placement.id,
        {
          placementId: placement.id,
          ageMonths: Math.max(0, state.tick - placement.installedAtTick),
          status: "healthy" as const,
          repairProgressDays: 0,
          repairCompletionPercent: 0,
          repairEtaSubticks: 0,
          repairEtaDays: 0,
          repairEtaTicks: 0,
          failureProbability: 0.01,
        },
      ]),
    ),
  );
}

function buildActivityMap(state: GameState): Map<RackActivityView["placementId"], RackActivityView> {
  return new Map(
    state.datacenters.flatMap((datacenter) =>
      datacenter.placements.map((placement) => [
        placement.id,
        {
          placementId: placement.id,
          specId: placement.specId,
          kind: RACK_CATALOG[placement.specId]!.kind,
          status: "active" as const,
          reservedPowerKw: RACK_CATALOG[placement.specId]!.powerDrawKw,
          billedPowerKw: RACK_CATALOG[placement.specId]!.powerDrawKw * 0.85,
        },
      ]),
    ),
  );
}

function measureSaveScenario(state: GameState): SaveMetric {
  const serializeStartedAt = performance.now();
  const payload = serialize(state);
  const serializeFinishedAt = performance.now();

  const deserializeStartedAt = performance.now();
  deserialize(payload);
  const deserializeFinishedAt = performance.now();

  return {
    scenario: "save-load-cycle",
    serializeMs: roundMetric(serializeFinishedAt - serializeStartedAt),
    deserializeMs: roundMetric(deserializeFinishedAt - deserializeStartedAt),
    bytes: new TextEncoder().encode(payload).byteLength,
  };
}

describe("web performance baseline harness", () => {
  it("records repeatable render, tick, and save metrics for the main web scenarios", () => {
    window.location.hash = "#/contracts";

    const contractsState = buildContractsState();
    const shellStore = createGameStore({
      ...contractsState,
      game: {
        ...contractsState.game,
        speed: 0,
      },
    });
    const floorDatacenter = contractsState.datacenters[0]!;
    const maintenanceMap = buildMaintenanceMap(contractsState);
    const activityMap = buildActivityMap(contractsState);

    const renderMetrics: RenderMetric[] = [
      measureRenderScenario(
        "start-screen-load",
        <StartScreen
          hasSavedGame
          latestSave={{
            gameId: contractsState.gameId,
            tick: contractsState.tick,
            cash: contractsState.player.cash,
            playerName: TEST_PLAYER,
            updatedAt: Date.now(),
          }}
          selectedDifficulty="hard"
          onSelectDifficulty={() => {}}
          onPlay={() => {}}
          onLoadGame={() => {}}
          onNewGame={() => {}}
        />,
      ),
      measureRenderScenario(
        "first-shell-render",
        <StoreProvider store={shellStore}>
          <Shell />
        </StoreProvider>,
      ),
      measureRenderScenario(
        "active-contracts-page",
        <StoreProvider store={createGameStore(contractsState)}>
          <ActiveList />
        </StoreProvider>,
      ),
      measureRenderScenario(
        "market-contracts-page",
        <StoreProvider store={createGameStore(contractsState)}>
          <MarketList contractViews={selectMarketContractViews(contractsState)} />
        </StoreProvider>,
      ),
      measureRenderScenario(
        "large-floor-grid",
        <Grid
          datacenter={floorDatacenter}
          rackMaintenanceByPlacementId={maintenanceMap}
          rackActivityByPlacementId={activityMap}
          hasActiveContract
          hasFault={false}
          onSlotClick={() => {}}
          onDecommission={() => {}}
          onMove={() => {}}
        />,
      ),
    ];

    const tickStore = createGameStore(contractsState);
    let tickCommits = 0;
    let tickDuration = 0;
    let tickMaxDuration = 0;
    render(
      <Profiler
        id="high-speed-tick-burst"
        onRender={(_id, _phase, actualDuration) => {
          tickCommits += 1;
          tickDuration += actualDuration;
          tickMaxDuration = Math.max(tickMaxDuration, actualDuration);
        }}
      >
        <StoreProvider store={tickStore}>
          <ActiveList />
        </StoreProvider>
      </Profiler>,
    );

    const tickStartedAt = performance.now();
    act(() => {
      for (let month = 0; month < 12; month += 1) {
        tickStore.dispatch({ type: "Tick" });
      }
    });
    const tickFinishedAt = performance.now();

    renderMetrics.push({
      scenario: "high-speed-tick-burst",
      commits: tickCommits,
      totalActualDurationMs: roundMetric(tickDuration),
      maxActualDurationMs: roundMetric(tickMaxDuration),
      wallClockMs: roundMetric(tickFinishedAt - tickStartedAt),
    });

    const saveMetric = measureSaveScenario(contractsState);

    console.table(renderMetrics);
    console.table([saveMetric]);

    expect(renderMetrics).toHaveLength(6);
    for (const metric of renderMetrics) {
      expect(metric.commits).toBeGreaterThan(0);
      expect(metric.maxActualDurationMs).toBeGreaterThanOrEqual(0);
      expect(metric.wallClockMs).toBeGreaterThanOrEqual(0);
    }

    expect(saveMetric.bytes).toBeGreaterThan(0);
    expect(saveMetric.serializeMs).toBeGreaterThanOrEqual(0);
    expect(saveMetric.deserializeMs).toBeGreaterThanOrEqual(0);
  });
});
