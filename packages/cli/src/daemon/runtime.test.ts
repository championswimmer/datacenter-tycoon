import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG, RACK_CATALOG, newGame, reduce, type DatacenterId, type RackPlacementId , DEFAULT_REGION_ID } from "@datacenter-tycoon/game-logic";

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
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: DEFAULT_REGION_ID,
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

	runtime.on("tick", (event) => {
		tickEvents.push(event.tick);
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
	assert.deepEqual(stateEvents, [1]);
	assert.deepEqual(ledgerEventCounts, [1]);
	assert.equal(runtime.getSnapshot().tick, 1);
	assert.equal(runtime.getStatus().rackCount, 1);
});

test("GameRuntime setSpeed reschedules the tick loop and interval callbacks tick the game", () => {
	const scheduler = new FakeScheduler();
	const runtime = new GameRuntime({ state: newGame(7), scheduler });

	runtime.start();
	assert.deepEqual(scheduler.setCalls, [1000]);

	runtime.setSpeed(4);
	assert.deepEqual(scheduler.setCalls, [1000, 250]);
	assert.equal(scheduler.clearedHandles.length, 1);

	scheduler.triggerLatest();
	assert.equal(runtime.getSnapshot().tick, 1);
});

test("GameRuntime pause, resume, and tickNow cooperate with zero-speed scheduling", () => {
	const scheduler = new FakeScheduler();
	const runtime = new GameRuntime({ state: newGame(9), scheduler, initialSpeedTps: 2 });

	runtime.start();
	assert.deepEqual(scheduler.setCalls, [500]);

	assert.deepEqual(runtime.pause(), { paused: true, speedTps: 2 });
	assert.equal(scheduler.intervals.size, 0);

	const pausedTick = runtime.tickNow(2);
	assert.equal(pausedTick.tick, 2);

	assert.deepEqual(runtime.setSpeed(0), { paused: true, speedTps: 0 });
	assert.equal(scheduler.intervals.size, 0);

	assert.deepEqual(runtime.resume(), { paused: false, speedTps: 2 });
	assert.equal(scheduler.setCalls.at(-1), 500);
});

test("GameRuntime query returns status, catalogs, and derived listings", () => {
	const runtime = new GameRuntime({ state: buildState(), paused: true });

	const status = runtime.query({ kind: "status" });
	assert.equal(status.tick, 0);
	assert.equal(status.datacenterCount, 1);
	assert.equal(status.rackCount, 1);
	assert.equal(status.paused, true);

	const datacenters = runtime.query({ kind: "list", target: "datacenters" });
	assert.equal(datacenters.kind, "datacenters");
	assert.equal(datacenters.items[0]?.slotsUsed, 1);
	assert.equal(datacenters.items[0]?.capacity.vCpu, RACK_CATALOG.C1.vCpu);

	const racks = runtime.query({ kind: "list", target: "racks", dcId: "dc-1" });
	assert.equal(racks.kind, "racks");
	assert.equal(racks.items[0]?.spec.id, RACK_CATALOG.C1.id);

	const catalog = runtime.query({ kind: "catalog", target: "racks" });
	assert.equal(catalog.kind, "racks");
	assert.ok(catalog.items.length >= 1);
});
