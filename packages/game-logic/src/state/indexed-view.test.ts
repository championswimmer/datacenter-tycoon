import assert from "node:assert/strict";
import test from "node:test";

import { withDerivedContractViews } from "../contracts/lifecycle.js";
import { createPerformanceFixture } from "../perf/fixtures.js";
import type { Contract, ContractId, GameState, PlayerId, Tick } from "../types.js";
import { createIndexedGameStateView } from "./indexed-view.js";

const contractId = (value: string): ContractId => value as ContractId;
const playerId = (value: string): PlayerId => value as PlayerId;
const tick = (value: number): Tick => value as Tick;

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		gameId: "indexed-view-test" as GameState["gameId"],
		game: {
			speed: 1,
			paused: false,
		},
		tick: tick(2),
		subtick: 0,
		seed: 123,
		rngState: 123,
		difficulty: "hard",
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 100_000,
			reliability: { score: 50, recentOutcomes: [] },
		},
		datacenters: [],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: true,
		audioSettings: {
			master: true,
			music: true,
			sfx: true,
			money: true,
			ambient: true,
		},
		map: { regions: [] },
		...overrides,
	};
}

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 64,
			ramGb: 256,
			storageTb: 16,
			gpuFlops: 0,
		},
		monthlyPayment: 10_000,
		penaltyPerMonth: 4_000,
		termMonths: 6,
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
		lifecycleState: "market_open",
		status: "offered",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		...overrides,
	};
}

function assertNoMapInstances(value: unknown): void {
	if (value instanceof Map) {
		assert.fail("GameState should remain plain and serializable; found a Map instance");
	}
	if (!value || typeof value !== "object") {
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			assertNoMapInstances(entry);
		}
		return;
	}
	for (const entry of Object.values(value)) {
		assertNoMapInstances(entry);
	}
}

test("createIndexedGameStateView matches normalized contract lifecycle buckets", () => {
	const legacyActive = makeContract("legacy-live", {
		lifecycleState: "breached",
		status: "breached",
		assignedDcId: "dc-1" as Contract["assignedDcId"],
		startedAtTick: tick(1),
	});
	const canonicalLive = makeContract("legacy-live", {
		lifecycleState: "serving",
		status: "active",
		assignedDcId: "dc-1" as Contract["assignedDcId"],
		startedAtTick: tick(1),
	});
	const historical = makeContract("historical", {
		lifecycleState: "completed",
		status: "expired",
		assignedDcId: "dc-1" as Contract["assignedDcId"],
		startedAtTick: tick(0),
		closedAtTick: tick(2),
	});
	const openMarket = makeContract("open-market");
	const state = makeState({
		contracts: [canonicalLive, historical, openMarket],
		activeContracts: [legacyActive, historical],
		contractMarket: [openMarket],
	});

	const view = createIndexedGameStateView(state);

	assert.deepEqual(
		view.contracts.map((contract) => contract.id),
		[legacyActive.id, historical.id, openMarket.id],
	);
	assert.equal(view.contractById.get(legacyActive.id)?.status, "breached");
	assert.deepEqual(view.liveContracts.map((contract) => contract.id), [legacyActive.id]);
	assert.deepEqual(view.historicalContracts.map((contract) => contract.id), [historical.id]);
	assert.deepEqual(view.openMarketContracts.map((contract) => contract.id), [openMarket.id]);
});

test("createIndexedGameStateView resolves datacenter and region lookups identically to array scans", () => {
	const fixture = createPerformanceFixture("small", { seed: 20260518 });
	const view = createIndexedGameStateView(fixture.state);

	for (const datacenter of fixture.state.datacenters) {
		assert.equal(view.datacenterById.get(datacenter.id), datacenter);
	}
	for (const region of fixture.state.map.regions) {
		assert.equal(view.regionById.get(region.id), region);
	}
	assert.deepEqual(view.contracts, fixture.state.contracts);
	assert.equal(view.contractById.size, fixture.state.contracts.length);
	assert.equal(view.liveContracts.length, fixture.state.activeContracts.filter((contract) => contract.assignedDcId !== undefined).length);
	assert.equal(view.openMarketContracts.length, fixture.state.contractMarket.length);
});

test("createIndexedGameStateView leaves persisted GameState plain and serializable", () => {
	const fixtureState = createPerformanceFixture("medium", { seed: 88 }).state;
	const state = withDerivedContractViews(fixtureState);

	createIndexedGameStateView(state);

	assertNoMapInstances(state);
	assert.doesNotThrow(() => JSON.stringify(state));
});
