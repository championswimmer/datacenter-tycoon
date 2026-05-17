import assert from "node:assert/strict";
import test from "node:test";

import { DAYS_PER_TICK, DATACENTER_CATALOG, RACK_CATALOG, newGame, reduce, type Contract, type ContractId, type DatacenterId, type RackPlacementId } from "@datacenter-tycoon/game-logic";

import { GameRuntime, type IntervalScheduler } from "./runtime.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

class FakeScheduler implements IntervalScheduler {
	private nextHandleId = 1;
	readonly intervals = new Map<number, { callback: () => void; delayMs: number }>();
	readonly setCalls: number[] = [];
	readonly clearedHandles: number[] = [];

	setInterval(callback: () => void, delayMs: number): number {
		const handleId = this.nextHandleId;
		this.nextHandleId += 1;
		this.intervals.set(handleId, { callback, delayMs });
		this.setCalls.push(delayMs);
		return handleId;
	}

	clearInterval(handle: unknown): void {
		const handleId = handle as number;
		if (this.intervals.delete(handleId)) {
			this.clearedHandles.push(handleId);
		}
	}

	triggerLatest(): void {
		const latestHandle = Math.max(...this.intervals.keys());
		const interval = this.intervals.get(latestHandle);
		if (!interval) {
			throw new Error("No interval registered");
		}

		interval.callback();
	}
}

function buildState() {
	let state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rp-1"),
	});
	return state;
}

test("GameRuntime dispatching Tick advances state and emits runtime events", () => {
	const runtime = new GameRuntime({ state: buildState() });
	const tickEvents: number[] = [];
	const stateEvents: number[] = [];
	const ledgerEventCounts: number[] = [];
	const subtickEvents: number[] = [];

	runtime.on("tick", (event) => {
		tickEvents.push(event.tick);
	});
	runtime.on("subtick", (event) => {
		subtickEvents.push(event.subtick);
	});
	runtime.on("state", (event) => {
		stateEvents.push(event.tick);
	});
	runtime.on("ledger", (event) => {
		ledgerEventCounts.push(event.entries.length);
	});

	const nextState = runtime.dispatch({ type: "Tick" });

	assert.equal(nextState.tick, 1);
	assert.deepEqual(tickEvents, [1]);
	assert.deepEqual(subtickEvents, []);
	assert.deepEqual(stateEvents, [1]);
	assert.deepEqual(ledgerEventCounts, [1]);
	assert.equal(runtime.getSnapshot().tick, 1);
	assert.equal(runtime.getStatus().rackCount, 1);
	assert.equal(runtime.getStatus().difficulty, "hard");
});

test("GameRuntime setSpeed reschedules the subtick loop and interval callbacks advance one day at a time", () => {
	const scheduler = new FakeScheduler();
	const runtime = new GameRuntime({ state: newGame(7), scheduler });
	const subtickEvents: number[] = [];
	const tickEvents: number[] = [];

	runtime.on("subtick", (event) => {
		subtickEvents.push(event.subtick);
	});
	runtime.on("tick", (event) => {
		tickEvents.push(event.tick);
	});

	runtime.start();
	assert.deepEqual(scheduler.setCalls, [1000 / DAYS_PER_TICK]);

	runtime.setSpeed(4);
	assert.deepEqual(scheduler.setCalls, [1000 / DAYS_PER_TICK, 250 / DAYS_PER_TICK]);
	assert.equal(scheduler.clearedHandles.length, 1);

	scheduler.triggerLatest();
	assert.equal(runtime.getSnapshot().tick, 0);
	assert.equal(runtime.getSnapshot().subtick, 1);
	assert.deepEqual(subtickEvents, [1]);
	assert.deepEqual(tickEvents, []);

	for (let day = 1; day < DAYS_PER_TICK; day += 1) {
		scheduler.triggerLatest();
	}
	assert.equal(runtime.getSnapshot().tick, 1);
	assert.equal(runtime.getSnapshot().subtick, 0);
	assert.deepEqual(tickEvents, [1]);
});

test("GameRuntime pause, resume, and tickNow cooperate with zero-speed scheduling", () => {
	const scheduler = new FakeScheduler();
	const runtime = new GameRuntime({ state: newGame(9), scheduler, initialSpeedTps: 2 });

	runtime.start();
	assert.deepEqual(scheduler.setCalls, [500 / DAYS_PER_TICK]);

	assert.deepEqual(runtime.pause(), { paused: true, speedTps: 2 });
	assert.equal(scheduler.intervals.size, 0);

	const pausedTick = runtime.tickNow(2);
	assert.equal(pausedTick.tick, 2);

	assert.deepEqual(runtime.setSpeed(0), { paused: true, speedTps: 0 });
	assert.equal(scheduler.intervals.size, 0);

	assert.deepEqual(runtime.resume(), { paused: false, speedTps: 2 });
	assert.equal(scheduler.setCalls.at(-1), 500 / DAYS_PER_TICK);
});

test("GameRuntime query returns status, catalogs, and derived listings", () => {
	const runtime = new GameRuntime({ state: buildState(), paused: true });

	const status = runtime.query({ kind: "status" });
	assert.equal(status.tick, 0);
	assert.equal(status.subtick, 0);
	assert.equal(status.dayOfMonth, 1);
	assert.equal(status.datacenterCount, 1);
	assert.equal(status.rackCount, 1);
	assert.equal(status.paused, true);
	assert.equal(status.difficulty, "hard");

	const datacenters = runtime.query({ kind: "list", target: "datacenters" });
	assert.equal(datacenters.kind, "datacenters");
	assert.equal(datacenters.items[0]?.slotsUsed, 1);
	assert.equal(datacenters.items[0]?.capacity.vCpu, RACK_CATALOG.C1.vCpu);
	assert.equal(datacenters.items[0]?.capacitySummary.available.vCpu, RACK_CATALOG.C1.vCpu);

	const racks = runtime.query({ kind: "list", target: "racks", dcId: "dc-1" });
	assert.equal(racks.kind, "racks");
	assert.equal(racks.items[0]?.spec.id, RACK_CATALOG.C1.id);

	const contracts = runtime.query({ kind: "list", target: "contracts" });
	assert.equal(contracts.kind, "contracts");
	assert.ok(Array.isArray(contracts.market));
	assert.ok(Array.isArray(contracts.active));
	assert.ok(Array.isArray(contracts.history));

	const catalog = runtime.query({ kind: "catalog", target: "racks" });
	assert.equal(catalog.kind, "racks");
	assert.ok(catalog.items.length >= 1);
});

const contractId = (value: string): ContractId => value as ContractId;

function buildStateWithExpiredContract() {
	const state = buildState();
	const expiredContract: Contract = {
		id: contractId("expired-contract-1"),
		name: "Expired Contract",
		requirements: { vCpu: 8, ramGb: 32, storageTb: 1, gpuFlops: 0 },
		monthlyPayment: 1_000,
		penaltyPerMonth: 500,
		termMonths: 1,
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
		lifecycleState: "completed",
		status: "expired",
		urgency: "standard",
		tier: 1,
		offeredAtTick: 0 as import("@datacenter-tycoon/game-logic").Tick,
		expiresAtTick: 2 as import("@datacenter-tycoon/game-logic").Tick,
		startedAtTick: 1 as import("@datacenter-tycoon/game-logic").Tick,
		assignedDcId: "dc-1" as DatacenterId,
	};
	return {
		...state,
		contracts: [expiredContract],
		activeContracts: [],
		contractMarket: [],
	};
}

test("activeContractCount is zero when all accepted contracts are expired", () => {
	const runtime = new GameRuntime({ state: buildStateWithExpiredContract(), paused: true });
	const status = runtime.getStatus();
	assert.equal(status.activeContractCount, 0, "expired contracts must not count as active");
});

test("activeContractCount counts only live (active or breached) contracts", () => {
	const state = buildState();
	const liveContract: Contract = {
		id: contractId("live-contract-1"),
		name: "Live Contract",
		requirements: { vCpu: 8, ramGb: 32, storageTb: 1, gpuFlops: 0 },
		monthlyPayment: 1_000,
		penaltyPerMonth: 500,
		termMonths: 6,
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
		lifecycleState: "serving",
		status: "active",
		urgency: "standard",
		tier: 1,
		offeredAtTick: 0 as import("@datacenter-tycoon/game-logic").Tick,
		expiresAtTick: 6 as import("@datacenter-tycoon/game-logic").Tick,
		startedAtTick: 1 as import("@datacenter-tycoon/game-logic").Tick,
		assignedDcId: "dc-1" as DatacenterId,
	};
	const expiredContract: Contract = {
		id: contractId("expired-contract-2"),
		name: "Expired Contract",
		requirements: { vCpu: 8, ramGb: 32, storageTb: 1, gpuFlops: 0 },
		monthlyPayment: 1_000,
		penaltyPerMonth: 500,
		termMonths: 1,
		slaTargetPercent: 90,
		currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
		lifecycleState: "completed",
		status: "expired",
		urgency: "standard",
		tier: 1,
		offeredAtTick: 0 as import("@datacenter-tycoon/game-logic").Tick,
		expiresAtTick: 2 as import("@datacenter-tycoon/game-logic").Tick,
		startedAtTick: 1 as import("@datacenter-tycoon/game-logic").Tick,
		assignedDcId: "dc-1" as DatacenterId,
	};
	const mixedState = {
		...state,
		contracts: [liveContract, expiredContract],
		activeContracts: [],
		contractMarket: [],
	};
	const runtime = new GameRuntime({ state: mixedState, paused: true });
	const status = runtime.getStatus();
	assert.equal(status.activeContractCount, 1, "only the live contract should count");

	const contractList = runtime.query({ kind: "list", target: "contracts" });
	assert.equal(contractList.kind, "contracts");
	assert.equal(contractList.active.length, 1);
	assert.equal(contractList.history.length, 1);
});
