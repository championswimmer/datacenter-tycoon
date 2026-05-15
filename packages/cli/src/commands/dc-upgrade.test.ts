import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "@datacenter-tycoon/game-logic";
import type { Action } from "@datacenter-tycoon/game-logic";
import type {
	DatacenterInfrastructureView,
	DatacenterListItem,
	DatacenterMaintenanceStaffingView,
	DatacenterUpgradeView,
	ListResult,
	QueryParams,
} from "../protocol/messages.js";
import type { CommandClient } from "./common.js";
import { runDcUpgradeCommand } from "./dc-upgrade.js";

function argv(positionals: string[], flags: Record<string, string | boolean> = {}): import("../argv.js").ParsedArgv {
	return { command: undefined, positionals, flags, rawArgs: [] };
}

function makeMaintenance(): DatacenterMaintenanceStaffingView {
	return {
		dcId: "dc-1",
		currentStaff: 0,
		maxStaff: 10,
		canIncrease: true,
		canDecrease: false,
		availableRegionalStaff: 20,
		staffWagePerHead: 5000,
		extraWagesMonthly: 0,
		repairSpeedDaysPerTick: 30,
		repairingRackCount: 0,
		totalRackCount: 0,
		averageRackAgeMonths: 0,
	};
}

function makeInfrastructure(fiber = false): DatacenterInfrastructureView {
	return {
		dcId: "dc-1" as never,
		base: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: DATACENTER_CATALOG.garage.coolingType,
			networkType: DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		effective: {
			gridImportCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			onsiteGenerationCapacityKw: 0,
			rackPowerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
			coolingCapacityBtuPerHr: fiber ? 250_000 : DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
			coolingType: fiber ? "hybrid" : DATACENTER_CATALOG.garage.coolingType,
			networkType: fiber ? "fiber" : DATACENTER_CATALOG.garage.networkType,
			bandwidthGbps: fiber ? 320 : DATACENTER_CATALOG.garage.bandwidthGbps,
		},
		fabricEligible: fiber,
	};
}

function makeUpgradeView(fiber = false): DatacenterUpgradeView {
	return {
		dcId: "dc-1" as never,
		infrastructure: makeInfrastructure(fiber),
		fixedMonthlyUpgradeOpex: fiber ? 2_150 : 0,
		fabricEligible: fiber,
		tracks: [
			{
				dcId: "dc-1" as never,
				trackId: "cooling",
				label: "Cooling loop",
				presentation: "level",
				currentNode: fiber
					? { id: "hybrid", label: "Hybrid cooling", capexCost: 180_000, fixedMonthlyOpex: 900, infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 250_000 } }
					: { id: "air", label: "Air cooling", capexCost: 0, fixedMonthlyOpex: 0, infrastructure: { coolingType: "air", coolingCapacityBtuPerHr: 120_000 } },
				nextNode: fiber ? null : { id: "hybrid", label: "Hybrid cooling", capexCost: 180_000, fixedMonthlyOpex: 900, fixedMonthlyOpexDelta: 900, infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 250_000 } },
				maxNode: { id: "hybrid", label: "Hybrid cooling", capexCost: 180_000, fixedMonthlyOpex: 900, infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 250_000 } },
				currentNodeIndex: fiber ? 1 : 0,
				totalNodes: 2,
				maxed: fiber,
			},
			{
				dcId: "dc-1" as never,
				trackId: "networkType",
				label: "Network uplink",
				presentation: "level",
				currentNode: fiber
					? { id: "fiber", label: "Fiber uplink", capexCost: 180_000, fixedMonthlyOpex: 1_250, infrastructure: { networkType: "fiber", bandwidthGbps: 320 } }
					: { id: "cat6", label: "Cat6 uplink", capexCost: 0, fixedMonthlyOpex: 0, infrastructure: { networkType: "cat6", bandwidthGbps: 80 } },
				nextNode: fiber ? null : { id: "cat8", label: "Cat8 uplink", capexCost: 75_000, fixedMonthlyOpex: 350, fixedMonthlyOpexDelta: 350, infrastructure: { networkType: "cat8", bandwidthGbps: 160 } },
				maxNode: { id: "fiber", label: "Fiber uplink", capexCost: 180_000, fixedMonthlyOpex: 1_250, infrastructure: { networkType: "fiber", bandwidthGbps: 320 } },
				currentNodeIndex: fiber ? 2 : 0,
				totalNodes: 3,
				maxed: fiber,
			},
		],
	};
}

function makeDatacenterItem(fiber = false): DatacenterListItem {
	return {
		datacenter: {
			id: "dc-1" as never,
			name: "Garage Datacenter",
			spec: DATACENTER_CATALOG.garage,
			placements: [],
			builtAtTick: 0,
			regionId: "us-west" as never,
			maintenanceStaff: 0,
		},
		capacity: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
		capacitySummary: {
			dcId: "dc-1" as never,
			installed: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
			usable: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
			committed: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
			available: { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
		},
		infrastructure: makeInfrastructure(fiber),
		upgrades: makeUpgradeView(fiber),
		powerKw: 0,
		powerCapacityKw: DATACENTER_CATALOG.garage.powerCapacityKw,
		heatOutputBtuPerHr: 0,
		coolingCapacityBtuPerHr: fiber ? 250_000 : DATACENTER_CATALOG.garage.coolingCapacityBtuPerHr,
		bandwidthGbps: 0,
		bandwidthCapacityGbps: fiber ? 320 : DATACENTER_CATALOG.garage.bandwidthGbps,
		slotsUsed: 0,
		totalSlots: DATACENTER_CATALOG.garage.rows * DATACENTER_CATALOG.garage.positionsPerRow,
		maintenance: makeMaintenance(),
	};
}

function makeClient(): { client: CommandClient; dispatched: Action[] } {
	const dispatched: Action[] = [];
	let upgraded = false;
	const client: CommandClient = {
		connect: async () => undefined,
		dispatch: async (action: Action) => {
			dispatched.push(action);
			if (action.type === "UpgradeDatacenter") {
				upgraded = true;
			}
			return { tick: 0 };
		},
		query: async (params: QueryParams): Promise<ListResult> => {
			if (params.kind === "list" && params.target === "datacenters") {
				return { kind: "datacenters", items: [makeDatacenterItem(upgraded)] };
			}
			throw new Error(`Unexpected query: ${JSON.stringify(params)}`);
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
	return { client, dispatched };
}

function captureLog(): { logged: string[]; restore: () => void } {
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};
	return { logged, restore: () => { console.log = originalLog; } };
}

test("dct dc upgrade <dcId> prints canonical upgrade status", async () => {
	const { client } = makeClient();
	const { logged, restore } = captureLog();
	try {
		await runDcUpgradeCommand(argv(["dc-1"]), () => client);
	} finally {
		restore();
	}

	const output = logged.join("\n");
	assert.match(output, /Datacenter upgrades: dc-1/);
	assert.match(output, /Fabric ready  : NO/);
	assert.match(output, /Cooling loop: Air cooling/);
	assert.match(output, /Network uplink: Cat6 uplink/);
});

test("dct dc upgrade apply dispatches UpgradeDatacenter and shows refreshed view", async () => {
	const { client, dispatched } = makeClient();
	const { logged, restore } = captureLog();
	try {
		await runDcUpgradeCommand(argv(["apply", "dc-1", "networkType", "cat8"]), () => client);
	} finally {
		restore();
	}

	assert.equal(dispatched.length, 1);
	assert.deepEqual(dispatched[0], {
		type: "UpgradeDatacenter",
		dcId: "dc-1",
		trackId: "networkType",
		targetNodeId: "cat8",
	});
	const output = logged.join("\n");
	assert.match(output, /Applied upgrade networkType → cat8/);
	assert.match(output, /Fabric ready  : YES/);
	assert.match(output, /Network       : 0.0 \/ 320 Gbps \(fiber\)/);
});
