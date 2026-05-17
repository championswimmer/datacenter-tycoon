import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { DAYS_PER_TICK } from "../balance/maintenance.js";
import { withDerivedContractViews } from "../contracts/lifecycle.js";
import { advanceSubtick } from "../sim/subtick.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	GameState,
	PlayerId,
	RackPlacement,
	RackPlacementId,
	Tick,
} from "../types.js";
import {
	createEmptyContractSlaWindow,
	sampleContractSlaWindows,
	summarizeContractSlaProgress,
} from "./sla.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const playerId = (value: string): PlayerId => value as PlayerId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const tick = (value: number): Tick => value as Tick;

function placement(id: string, specId: keyof typeof RACK_CATALOG): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tick(0),
		health: "healthy",
		row: 0,
		position: 0,
	};
}

function makeDatacenter(id: string, placements: RackPlacement[] = [placement("rack-1", "C1")]): Datacenter {
	return {
		id: datacenterId(id),
		name: id,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: tick(0),
		regionId: "us_east" as Datacenter["regionId"],
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, dcId: DatacenterId, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: id,
		requirements: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 5_000,
		penaltyPerMonth: 1_500,
		termMonths: 6,
		slaTargetPercent: 90,
		currentSlaWindow: createEmptyContractSlaWindow(),
		lifecycleState: "serving",
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		startedAtTick: tick(0),
		acceptedAtTick: tick(0),
		assignedDcId: dcId,
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return withDerivedContractViews({
		gameId: "game-1" as GameState["gameId"],
		game: { speed: 1, paused: false },
		tick: 0,
		subtick: 0,
		seed: 1,
		rngState: 1,
		difficulty: "hard",
		player: {
			id: playerId("player-1"),
			name: "Player",
			cash: 100_000,
			reliability: { score: 50, recentOutcomes: [] },
		},
		datacenters: [],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: true,
		audioSettings: { master: true, music: true, sfx: true, money: true, ambient: true },
		map: { regions: [] },
		...overrides,
	});
}

test("sampleContractSlaWindows records a served day when committed healthy capacity is available", () => {
	const datacenter = makeDatacenter("dc-1");
	const contract = makeContract("contract-1", datacenter.id);
	const state = makeState({ datacenters: [datacenter], contracts: [contract] });

	const sampled = sampleContractSlaWindows(state, state.contracts);

	assert.deepEqual(sampled[0]?.currentSlaWindow, {
		sampledDays: 1,
		servedDays: 1,
		failedDays: 0,
	});
});

test("sampleContractSlaWindows records a failed day when the assigned pool cannot serve demand", () => {
	const datacenter = makeDatacenter("dc-1", [
		{
			...placement("rack-1", "C1"),
			health: "repairing",
			repairProgressDays: 0,
		},
	]);
	const contract = makeContract("contract-1", datacenter.id);
	const state = makeState({ datacenters: [datacenter], contracts: [contract] });

	const sampled = sampleContractSlaWindows(state, state.contracts);

	assert.deepEqual(sampled[0]?.currentSlaWindow, {
		sampledDays: 1,
		servedDays: 0,
		failedDays: 1,
	});
});

test("advanceSubtick samples live contracts once per day without touching historical offers", () => {
	const datacenter = makeDatacenter("dc-1");
	const live = makeContract("live", datacenter.id);
	const offered: Contract = {
		...makeContract("market", datacenter.id),
		lifecycleState: "market_open",
		status: "offered",
		assignedDcId: undefined,
		startedAtTick: undefined,
		acceptedAtTick: undefined,
	};
	const completed: Contract = {
		...makeContract("history", datacenter.id),
		lifecycleState: "completed",
		status: "expired",
		closedAtTick: tick(1),
	};
	const state = makeState({ datacenters: [datacenter], contracts: [live, offered, completed] });

	const nextState = advanceSubtick(state);

	assert.equal(nextState.subtick, 1);
	assert.deepEqual(nextState.contracts.find((contract) => contract.id === live.id)?.currentSlaWindow, {
		sampledDays: 1,
		servedDays: 1,
		failedDays: 0,
	});
	assert.deepEqual(nextState.contracts.find((contract) => contract.id === offered.id)?.currentSlaWindow, createEmptyContractSlaWindow());
	assert.deepEqual(nextState.contracts.find((contract) => contract.id === completed.id)?.currentSlaWindow, createEmptyContractSlaWindow());
});

test("summarizeContractSlaProgress exposes recoverable, at-risk, and missed windows", () => {
	const recoverable = summarizeContractSlaProgress({
		id: contractId("recoverable"),
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 3, servedDays: 3, failedDays: 0 },
	});
	const atRisk = summarizeContractSlaProgress({
		id: contractId("at-risk"),
		slaTargetPercent: 95,
		currentSlaWindow: { sampledDays: 2, servedDays: 1, failedDays: 1 },
	});
	const missed = summarizeContractSlaProgress({
		id: contractId("missed"),
		slaTargetPercent: 95,
		currentSlaWindow: { sampledDays: DAYS_PER_TICK - 1, servedDays: 0, failedDays: DAYS_PER_TICK - 1 },
	});

	assert.equal(recoverable.status, "recoverable");
	assert.equal(recoverable.maxFailedDays, 3);
	assert.equal(atRisk.status, "at_risk");
	assert.equal(atRisk.remainingFailureBudgetDays, 0);
	assert.equal(missed.status, "missed");
	assert.ok(missed.servedPercent < missed.slaTargetPercent);
});
