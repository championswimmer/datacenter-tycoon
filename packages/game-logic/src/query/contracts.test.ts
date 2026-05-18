import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	bucketContractsFromState,
	contractAllowsRegion,
	contractDealScore,
	summarizeContractAssignmentFit,
	summarizeOpenMarketContractFits,
	summarizeContractRegionAffinity,
	type Contract,
	type ContractId,
	type Datacenter,
	type DatacenterId,
	type GameState,
	type RackPlacement,
	type RackPlacementId,
	withDerivedContractViews,
} from "../index.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: 0,
		health: "healthy",
		row,
		position,
	};
}

function makeDatacenter(
	id: string,
	placements: RackPlacement[],
	regionId: Datacenter["regionId"] = "region-a" as Datacenter["regionId"],
): Datacenter {
	return {
		id: datacenterId(id),
		name: id,
		spec: DATACENTER_CATALOG.garage,
		placements,
		builtAtTick: 0,
		regionId,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: id,
		requirements: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
		monthlyPayment: 10_000,
		penaltyPerMonth: 2_000,
		termMonths: 6,
		lifecycleState: "market_open",
		status: "offered",
		urgency: "standard",
		tier: 1,
		offeredAtTick: 0,
		expiresAtTick: 6,
		...overrides,
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return withDerivedContractViews({
		gameId: "game-1" as GameState["gameId"],
		game: { speed: 1, paused: false },
		tick: 0,
		seed: 1,
		rngState: 1,
		difficulty: "hard",
		player: {
			id: "player-1" as GameState["player"]["id"],
			name: "Player",
			cash: 1_000_000,
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

test("bucketContractsFromState derives market, live, and historical buckets from canonical contracts", () => {
	const state = makeState({
		contracts: [
			makeContract("market-open"),
			makeContract("live", {
				lifecycleState: "serving",
				status: "active",
				assignedDcId: datacenterId("dc-1"),
				startedAtTick: 1,
			}),
			makeContract("history", {
				lifecycleState: "completed",
				status: "expired",
				assignedDcId: datacenterId("dc-1"),
				startedAtTick: 1,
				closedAtTick: 7,
			}),
		],
	});

	const buckets = bucketContractsFromState(state);
	assert.deepEqual(buckets.market.map((contract) => contract.id), [contractId("market-open")]);
	assert.deepEqual(buckets.live.map((contract) => contract.id), [contractId("live")]);
	assert.deepEqual(buckets.historical.map((contract) => contract.id), [contractId("history")]);
});

test("summarizeContractRegionAffinity reports unrestricted and restricted contracts consistently", () => {
	const unrestricted = makeContract("unrestricted");
	const restricted = makeContract("restricted", {
		regionAffinity: {
			key: "eu",
			allowedRegionIds: ["region-b" as GameState["map"]["regions"][number]["id"]],
		},
	});
	const regions = [
		{ id: "region-a" as GameState["map"]["regions"][number]["id"] },
		{ id: "region-b" as GameState["map"]["regions"][number]["id"] },
	];

	assert.deepEqual(summarizeContractRegionAffinity(unrestricted, regions), {
		restricted: false,
		key: null,
		allowedRegionIds: regions.map((region) => region.id),
	});
	assert.deepEqual(summarizeContractRegionAffinity(restricted), {
		restricted: true,
		key: "eu",
		allowedRegionIds: restricted.regionAffinity!.allowedRegionIds,
	});
	assert.equal(contractAllowsRegion(unrestricted, regions[0]!.id), true);
	assert.equal(contractAllowsRegion(restricted, regions[0]!.id), false);
});

test("summarizeContractAssignmentFit distinguishes exact, partial, and impossible fits", () => {
	const exactState = makeState({
		datacenters: [makeDatacenter("dc-exact", [placement("rack-a", "C1", 0, 0)])],
		contracts: [makeContract("exact")],
	});
	const exactFit = summarizeContractAssignmentFit(exactState, contractId("exact"));
	assert.equal(exactFit?.fitStatus, "fits");
	assert.deepEqual(exactFit?.eligibleDcIds, [datacenterId("dc-exact")]);

	const partialState = makeState({
		datacenters: [
			makeDatacenter("dc-left", [placement("rack-left", "C0", 0, 0)]),
			makeDatacenter("dc-right", [placement("rack-right", "C0", 0, 0)]),
		],
		contracts: [
			makeContract("partial", {
				requirements: { vCpu: 100, ramGb: 400, storageTb: 10, gpuFlops: 0 },
			}),
		],
	});
	const partialFit = summarizeContractAssignmentFit(partialState, contractId("partial"));
	assert.equal(partialFit?.fitStatus, "partial");
	assert.deepEqual(partialFit?.networkAvailable, { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 });
	assert.deepEqual(partialFit?.fittingDcIds, []);
	// bestPoolAvailable should be the best single pool, not the sum of all pools
	assert.deepEqual(partialFit?.bestPoolAvailable, { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 });

	const noneState = makeState({
		datacenters: [
			makeDatacenter("dc-left", [placement("rack-left", "C0", 0, 0)]),
			makeDatacenter("dc-right", [placement("rack-right", "C0", 0, 0)]),
		],
		contracts: [
			makeContract("none", {
				requirements: { vCpu: 200, ramGb: 700, storageTb: 20, gpuFlops: 0 },
			}),
		],
	});
	assert.equal(summarizeContractAssignmentFit(noneState, contractId("none"))?.fitStatus, "none");
});

test("summarizeContractAssignmentFit filters eligible datacenters by contract region affinity", () => {
	const state = makeState({
		datacenters: [
			makeDatacenter("dc-usa", [placement("rack-a", "C1", 0, 0)], "region-a" as GameState["map"]["regions"][number]["id"]),
			makeDatacenter("dc-eu", [placement("rack-b", "C1", 0, 0)], "region-b" as GameState["map"]["regions"][number]["id"]),
		],
		contracts: [
			makeContract("regional", {
				requirements: { vCpu: 64, ramGb: 256, storageTb: 8, gpuFlops: 0 },
				regionAffinity: {
					key: "eu",
					allowedRegionIds: ["region-b" as GameState["map"]["regions"][number]["id"]],
				},
			}),
		],
	});
	const fit = summarizeContractAssignmentFit(state, contractId("regional"));

	assert.deepEqual(fit?.regionAffinity, {
		restricted: true,
		key: "eu",
		allowedRegionIds: ["region-b" as GameState["map"]["regions"][number]["id"]],
	});
	assert.deepEqual(fit?.eligibleDcIds, [datacenterId("dc-eu")]);
	assert.equal(fit?.candidates.find((candidate) => candidate.dcId === datacenterId("dc-usa"))?.regionEligible, false);
	assert.equal(fit?.candidates.find((candidate) => candidate.dcId === datacenterId("dc-eu"))?.regionEligible, true);
});

test("summarizeOpenMarketContractFits matches per-contract fit summaries across shared pools", () => {
	const state = makeState({
		datacenters: [
			makeDatacenter("dc-a", [placement("rack-a", "C1", 0, 0)], "region-a" as GameState["map"]["regions"][number]["id"]),
			makeDatacenter("dc-b", [placement("rack-b", "C1", 0, 0)], "region-a" as GameState["map"]["regions"][number]["id"]),
			makeDatacenter("dc-c", [placement("rack-c", "M1", 0, 0)], "region-b" as GameState["map"]["regions"][number]["id"]),
		],
		contracts: [
			makeContract("offer-a", {
				requirements: { vCpu: 128, ramGb: 512, storageTb: 12, gpuFlops: 0 },
			}),
			makeContract("offer-b", {
				requirements: { vCpu: 200, ramGb: 800, storageTb: 20, gpuFlops: 0 },
				regionAffinity: {
					key: "eu",
					allowedRegionIds: ["region-b" as GameState["map"]["regions"][number]["id"]],
				},
			}),
			makeContract("live-a", {
				lifecycleState: "serving",
				status: "active",
				assignedDcId: datacenterId("dc-a"),
				startedAtTick: 1,
				requirements: { vCpu: 64, ramGb: 128, storageTb: 4, gpuFlops: 0 },
			}),
		],
		map: {
			regions: [
				{ id: "region-a" as GameState["map"]["regions"][number]["id"], fabric: { memberDcIds: [datacenterId("dc-a"), datacenterId("dc-b")] } },
				{ id: "region-b" as GameState["map"]["regions"][number]["id"], fabric: { memberDcIds: [] } },
			],
		},
	});

	const batch = summarizeOpenMarketContractFits(state);
	const perContract = state.contractMarket.map((contract) => summarizeContractAssignmentFit(state, contract.id));

	assert.equal(batch.length, state.contractMarket.length);
	assert.deepEqual(batch, perContract);
	assert.equal(batch[0]?.fitStatus, "fits");
	assert.equal(batch[1]?.fitStatus, "none");
	assert.deepEqual(batch[0]?.fittingDcIds, [datacenterId("dc-a"), datacenterId("dc-b")]);
	assert.deepEqual(batch[1]?.eligibleDcIds, [datacenterId("dc-c")]);
});

test("contractDealScore stays in game-logic for consumer sorting and filtering", () => {
	const baseline = makeContract("baseline", {
		requirements: { vCpu: 64, ramGb: 256, storageTb: 0, gpuFlops: 0 },
		monthlyPayment: 2_560,
	});
	const premium = { ...baseline, id: contractId("premium"), monthlyPayment: 3_840 };

	assert.ok(contractDealScore(baseline) > 0);
	assert.equal(contractDealScore(premium) / contractDealScore(baseline), 1.5);
});
