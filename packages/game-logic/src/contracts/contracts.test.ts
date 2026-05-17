import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	RELIABILITY_BASELINE_SCORE,
	RELIABILITY_MARKET_OFFER_COUNT,
	reliabilityMarketPolicyForScore,
} from "../balance/reliability.js";
import {
	acceptContract,
	advanceContract,
	ContractAcceptanceError,
	evaluateContract,
	contractTermBand,
	generateContract,
	generateContractForTermBand,
	marketDifficulty,
	monthlyRateMultiplierForTerm,
	refreshContractMarket,
} from "../contracts/index.js";
import {
	CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS,
	CONTRACT_TERM_DISCOUNT_FLOOR,
	MARKET_REFRESH_SIZE,
} from "../economy/constants.js";
import { createRng } from "../sim/rng.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	GameState,
	PlayerId,
	RackPlacement,
	RackPlacementId,
	Region,
	RegionId,
	Tick,
} from "../types.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const playerId = (value: string): PlayerId => value as PlayerId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const regionId = (value: string): RegionId => value as RegionId;
const tick = (value: number): Tick => value as Tick;

function generatedThemeId(contract: Contract): string {
	return contract.id.match(/^contract-(.+)-[0-9a-f]+$/)?.[1] ?? "unknown";
}

function placement(id: string, specId: keyof typeof RACK_CATALOG, row: number, position: number): RackPlacement {
	const spec = RACK_CATALOG[specId];
	return {
		id: rackPlacementId(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tick(0),
		health: "healthy",
		row,
		position,
	};
}

function makeDatacenter(
	id: string,
	placements: RackPlacement[] = [
		placement("rack-1", "C2", 0, 0),
		placement("rack-2", "M2", 0, 1),
		placement("rack-3", "S2", 1, 0),
		placement("rack-4", "G1", 1, 1),
	],
): Datacenter {
	return {
		id: datacenterId(id),
		name: `Warehouse ${id}`,
		spec: DATACENTER_CATALOG.warehouse,
		placements,
		builtAtTick: tick(0),
		regionId: "us_west" as import("../types.js").RegionId,
		maintenanceStaff: 0,
	};
}

function makeContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractId(id),
		name: `Contract ${id}`,
		requirements: {
			vCpu: 128,
			ramGb: 2_048,
			storageTb: 250,
			gpuFlops: 200,
		},
		monthlyPayment: 20_000,
		penaltyPerMonth: 8_000,
		termMonths: 6,
		status: "offered",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tick(0),
		expiresAtTick: tick(6),
		...overrides,
	};
}

function makeRegion(id: RegionId, memberDcIds: DatacenterId[] = []): Region {
	return {
		id,
		name: id,
		code: id.toUpperCase(),
		city: `${id} City`,
		coordinates: { x: 0, y: 0 },
		powerCostPerKwh: 0.1,
		staffWage: 1_000,
		taxRate: 0.1,
		totalPowerAvailable: 100,
		totalStaffAvailable: 5,
		powerUsed: 0,
		staffUsed: 0,
		fabric: { memberDcIds },
	};
}

function makeState(overrides: Partial<GameState> = {}): GameState {
	return {
		tick: tick(2),
		seed: 42,
		rngState: 42,
		player: {
			id: playerId("player-1"),
			name: "Player One",
			cash: 250_000,
			reliability: {
				score: RELIABILITY_BASELINE_SCORE,
				recentOutcomes: [],
			},
		},
		datacenters: [makeDatacenter("dc-1")],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		map: { regions: [] },
		...overrides,
	};
}

test("generateContract is deterministic for the same seed and difficulty", () => {
	const first = generateContract(createRng(12345), 0.45);
	const second = generateContract(createRng(12345), 0.45);

	assert.deepEqual(first, second);
	assert.equal(first.status, "offered");
	assert.equal(first.name, "Global Cloud Orion Streaming Encode Farm");
	assert.ok(first.monthlyPayment > first.penaltyPerMonth);
	assert.ok(first.requirements.vCpu > 0 || first.requirements.ramGb > 0 || first.requirements.storageTb > 0);
});

const MODERN_CONTRACT_NAME_SUFFIXES = [
	"LLM Cluster",
	"Foundation Model Pod",
	"Training Fabric",
	"Inference Mesh",
	"Serving Fleet",
	"Vector Gateway",
	"Simulation Grid",
	"Compute Sweep",
	"Monte Carlo Farm",
	"OLTP Failover Ring",
	"Transactional Core",
	"Business Continuity Stack",
	"Archive Vault",
	"Compliance Repository",
	"Deep Backup Lake",
	"Edge POP Rollout",
	"Caching Mesh",
	"Regional Delivery Grid",
	"Render Pipeline",
	"Transcode Swarm",
	"Streaming Encode Farm",
] as const;

test("generateContract names use expanded enterprise nomenclature", () => {
	const names = Array.from({ length: 20 }, (_, i) => generateContract(createRng(2_000 + i), 0.6).name);

	assert.ok(names.every((name) => name.split(" ").length >= 4));
	assert.ok(
		names.some((name) => MODERN_CONTRACT_NAME_SUFFIXES.some((suffix) => name.endsWith(suffix))),
		`expected at least one generated name to use the new deliverable vocabulary: ${names.join(", ")}`,
	);
	assert.ok(names.every((name) => !["AI Training", "AI Inference", "HPC Simulation"].includes(name)));
});

test("generateContract uses workload-specific duration bands", () => {
	const rng = createRng(4_242);
	const samples = Array.from({ length: 400 }, () => generateContract(rng, 0.55));
	const byTheme = new Map<string, Contract[]>();
	for (const contract of samples) {
		const themeId = generatedThemeId(contract);
		const existing = byTheme.get(themeId) ?? [];
		existing.push(contract);
		byTheme.set(themeId, existing);
	}

	const videoRender = byTheme.get("video_render") ?? [];
	const enterpriseDb = byTheme.get("enterprise_db") ?? [];
	const coldStorage = byTheme.get("cold_storage") ?? [];

	assert.ok(videoRender.length > 0, "expected to sample video_render contracts");
	assert.ok(enterpriseDb.length > 0, "expected to sample enterprise_db contracts");
	assert.ok(coldStorage.length > 0, "expected to sample cold_storage contracts");
	assert.ok(videoRender.some((contract) => contract.termMonths <= 4));
	assert.ok(Math.max(...videoRender.map((contract) => contract.termMonths)) <= 6);
	assert.ok(enterpriseDb.some((contract) => contract.termMonths >= 18));
	assert.ok(coldStorage.some((contract) => contract.termMonths >= 24));
});

test("refreshContractMarket is deterministic, removes expired offers, and tops up to the configured size", () => {
	const retained = makeContract("retained", {
		status: "offered",
		offeredAtTick: tick(1),
		expiresAtTick: tick(4),
	});
	const expired = makeContract("expired", {
		status: "offered",
		offeredAtTick: tick(0),
		expiresAtTick: tick(2),
	});
	const input = makeState({
		tick: tick(2),
		rngState: 99,
		contractMarket: [retained, expired],
	});

	const first = refreshContractMarket(input);
	const second = refreshContractMarket(input);

	assert.deepEqual(first, second);
	assert.equal(first.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.ok(first.contractMarket.some((contract) => contract.id === retained.id));
	assert.ok(first.contractMarket.every((contract) => contract.id !== expired.id));
	assert.notEqual(first.rngState, input.rngState);
});

test("acceptContract moves an offered contract into the active list with assignment metadata", () => {
	const offeredContract = makeContract("market-1");
	const state = makeState({ contractMarket: [offeredContract] });

	const nextState = acceptContract(state, offeredContract.id, state.datacenters[0]!.id);

	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.equal(nextState.activeContracts.length, 1);
	assert.deepEqual(nextState.activeContracts[0], {
		...offeredContract,
		lifecycleState: "serving",
		status: "active",
		startedAtTick: state.tick,
		acceptedAtTick: state.tick,
		assignedDcId: state.datacenters[0]!.id,
	});
});

test("acceptContract rejects unknown datacenters and already active contracts", () => {
	const offeredContract = makeContract("market-1");
	const state = makeState({
		contractMarket: [offeredContract],
		activeContracts: [
			makeContract("active-1", {
				id: contractId("active-1"),
				status: "active",
				startedAtTick: tick(1),
				assignedDcId: datacenterId("dc-1"),
			}),
		],
	});

	assert.throws(() => acceptContract(state, offeredContract.id, datacenterId("missing-dc")), {
		message: /Unknown datacenter/,
	});
	assert.throws(() => acceptContract(state, contractId("active-1"), datacenterId("dc-1")), {
		message: /Contract already active/,
	});
});

test("acceptContract rejects contracts that do not fit current available datacenter capacity", () => {
	const committed = makeContract("active-1", {
		status: "active",
		startedAtTick: tick(1),
		assignedDcId: datacenterId("dc-1"),
		requirements: { vCpu: 300, ramGb: 5_000, storageTb: 1_100, gpuFlops: 450 },
	});
	const offeredContract = makeContract("market-1", {
		requirements: { vCpu: 130, ramGb: 1_500, storageTb: 200, gpuFlops: 60 },
	});
	const state = makeState({
		contractMarket: [offeredContract],
		activeContracts: [committed],
	});

	assert.throws(
		() => acceptContract(state, offeredContract.id, datacenterId("dc-1")),
		(error: unknown) => {
			assert.ok(error instanceof ContractAcceptanceError);
			assert.deepEqual(error.data, {
				code: "insufficient_capacity",
				dcId: datacenterId("dc-1"),
				required: offeredContract.requirements,
				available: { vCpu: 116, ramGb: 1_272, storageTb: 176, gpuFlops: 50 },
			});
			return true;
		},
	);
	assert.deepEqual(state.contractMarket, [offeredContract]);
	assert.deepEqual(state.activeContracts, [committed]);
});

test("acceptContract allows an exact-fit contract on remaining available capacity", () => {
	const committed = makeContract("active-1", {
		status: "active",
		startedAtTick: tick(1),
		assignedDcId: datacenterId("dc-1"),
		requirements: { vCpu: 300, ramGb: 5_000, storageTb: 1_100, gpuFlops: 450 },
	});
	const offeredContract = makeContract("market-1", {
		requirements: { vCpu: 116, ramGb: 1_272, storageTb: 176, gpuFlops: 50 },
	});
	const state = makeState({
		contractMarket: [offeredContract],
		activeContracts: [committed],
	});

	const nextState = acceptContract(state, offeredContract.id, datacenterId("dc-1"));

	assert.equal(nextState.activeContracts.length, 2);
	assert.deepEqual(nextState.activeContracts.at(-1), {
		...offeredContract,
		lifecycleState: "serving",
		status: "active",
		startedAtTick: state.tick,
		acceptedAtTick: state.tick,
		assignedDcId: datacenterId("dc-1"),
	});
});

test("acceptContract allows split-capacity contracts across a linked regional fabric pool", () => {
	const regionA = regionId("region-a");
	const fiberUpgrades = { currentNodeByTrack: { networkType: "fiber" as const } };
	const dcA: Datacenter = {
		...makeDatacenter("dc-fabric-a", [placement("rack-a", "C1", 0, 0)]),
		regionId: regionA,
		upgrades: fiberUpgrades,
	};
	const dcB: Datacenter = {
		...makeDatacenter("dc-fabric-b", [placement("rack-b", "C1", 0, 0)]),
		regionId: regionA,
		upgrades: fiberUpgrades,
	};
	const offeredContract = makeContract("market-fabric", {
		requirements: { vCpu: 192, ramGb: 700, storageTb: 20, gpuFlops: 0 },
	});
	const state = makeState({
		datacenters: [dcA, dcB],
		contractMarket: [offeredContract],
		map: { regions: [makeRegion(regionA, [dcA.id, dcB.id])] },
	});

	const nextState = acceptContract(state, offeredContract.id, dcA.id);

	assert.equal(nextState.activeContracts.length, 1);
	assert.deepEqual(nextState.activeContracts[0], {
		...offeredContract,
		lifecycleState: "serving",
		status: "active",
		startedAtTick: state.tick,
		acceptedAtTick: state.tick,
		assignedDcId: dcA.id,
	});
});

test("acceptContract still rejects split-capacity contracts when the same datacenters are not fabric-linked", () => {
	const regionA = regionId("region-a");
	const dcA: Datacenter = {
		...makeDatacenter("dc-fabric-a", [placement("rack-a", "C1", 0, 0)]),
		regionId: regionA,
	};
	const dcB: Datacenter = {
		...makeDatacenter("dc-fabric-b", [placement("rack-b", "C1", 0, 0)]),
		regionId: regionA,
	};
	const offeredContract = makeContract("market-fabric", {
		requirements: { vCpu: 192, ramGb: 700, storageTb: 20, gpuFlops: 0 },
	});
	const state = makeState({
		datacenters: [dcA, dcB],
		contractMarket: [offeredContract],
		map: { regions: [makeRegion(regionA)] },
	});

	assert.throws(
		() => acceptContract(state, offeredContract.id, dcA.id),
		(error: unknown) => {
			assert.ok(error instanceof ContractAcceptanceError);
			assert.deepEqual(error.data, {
				code: "insufficient_capacity",
				dcId: dcA.id,
				required: offeredContract.requirements,
				available: { vCpu: 128, ramGb: 512, storageTb: 16, gpuFlops: 0 },
			});
			return true;
		},
	);
});

test("evaluateContract reports whether a datacenter can satisfy a contract", () => {
	const healthyDatacenter = makeDatacenter("dc-1");
	const constrainedDatacenter = makeDatacenter("dc-2", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("workload-1", {
		requirements: { vCpu: 200, ramGb: 3_000, storageTb: 400, gpuFlops: 200 },
	});

	assert.equal(evaluateContract(healthyDatacenter, contract), "fulfilled");
	assert.equal(evaluateContract(constrainedDatacenter, contract), "breached");
});

test("advanceContract transitions between active, breached, and expired states", () => {
	const datacenter = makeDatacenter("dc-1");
	const breachedDatacenter = makeDatacenter("dc-2", [placement("rack-1", "C1", 0, 0)]);
	const baseContract = makeContract("lifecycle-1", {
		status: "active",
		startedAtTick: tick(2),
		assignedDcId: datacenter.id,
		requirements: { vCpu: 200, ramGb: 3_000, storageTb: 400, gpuFlops: 200 },
		termMonths: 6,
	});

	assert.equal(advanceContract(baseContract, datacenter, 5).status, "active");
	assert.equal(advanceContract(baseContract, breachedDatacenter, 5).status, "breached");
	assert.equal(advanceContract(baseContract, datacenter, 8).status, "expired");
	assert.equal(advanceContract(baseContract, breachedDatacenter, 8).status, "expired");
});

test("refreshContractMarket adjusts offer count by reliability band while preserving retained offers", () => {
	const retained = makeContract("retained", {
		status: "offered",
		offeredAtTick: tick(6),
		expiresAtTick: tick(12),
	});
	const diamondState = makeState({
		tick: tick(8),
		rngState: 99,
		player: {
			...makeState().player,
			reliability: {
				score: 80,
				recentOutcomes: [],
			},
		},
		contractMarket: [retained],
	});
	const silverState = {
		...diamondState,
		player: {
			...diamondState.player,
			reliability: {
				score: 20,
				recentOutcomes: [],
			},
		},
	};

	const diamondMarket = refreshContractMarket(diamondState);
	const silverMarket = refreshContractMarket(silverState);

	assert.equal(diamondMarket.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT.diamond);
	assert.equal(silverMarket.contractMarket.length, RELIABILITY_MARKET_OFFER_COUNT["silver"]);
	assert.ok(diamondMarket.contractMarket.some((contract) => contract.id === retained.id));
	assert.ok(silverMarket.contractMarket.some((contract) => contract.id === retained.id));
	assert.deepEqual(refreshContractMarket(diamondState), diamondMarket);
});

test("acceptContract backfills the market slot immediately to keep MARKET_REFRESH_SIZE offers", () => {
	const offers = Array.from({ length: MARKET_REFRESH_SIZE }, (_, i) =>
		makeContract(`offer-${i}`, {
			status: "offered",
			offeredAtTick: tick(0),
			expiresAtTick: tick(6),
		}),
	);
	const state = makeState({ contractMarket: offers });

	const nextState = acceptContract(state, offers[0]!.id, state.datacenters[0]!.id);

	assert.equal(nextState.contractMarket.length, MARKET_REFRESH_SIZE);
	assert.ok(nextState.activeContracts.length === 1);
	assert.equal(nextState.activeContracts[0]!.status, "active");
});

test("market refresh and acceptance stay deterministic for identical reliability state", () => {
	const initialState = makeState({
		tick: tick(8),
		rngState: 321,
		player: {
			...makeState().player,
			reliability: {
				score: 80,
				recentOutcomes: [],
			},
		},
	});

	const firstRefresh = refreshContractMarket(initialState);
	const secondRefresh = refreshContractMarket(initialState);

	assert.deepEqual(firstRefresh, secondRefresh);

	const acceptedContractId = firstRefresh.contractMarket[0]!.id;
	const firstAccepted = acceptContract(firstRefresh, acceptedContractId, firstRefresh.datacenters[0]!.id);
	const secondAccepted = acceptContract(secondRefresh, acceptedContractId, secondRefresh.datacenters[0]!.id);

	assert.deepEqual(firstAccepted, secondAccepted);
});

test("marketDifficulty clamps low for ticks 0-5 and caps at 0.85 for later ticks", () => {
	assert.ok(marketDifficulty(0, 0) <= 0.25);
	assert.ok(marketDifficulty(3, 1) <= 0.25);
	assert.ok(marketDifficulty(5, 1) <= 0.25);
	assert.ok(marketDifficulty(100, 1) <= 0.85);
	assert.ok(marketDifficulty(200, 1) <= 0.85);
});

test("generateContract at low difficulty never requires GPU", () => {
	const rng = createRng(42);
	for (let i = 0; i < 20; i++) {
		const contract = generateContract(rng, 0.1);
		assert.equal(contract.requirements.gpuFlops, 0, `${contract.name} should not require GPU at low difficulty`);
	}
});

test("generateContract biases average term length by reliability policy", () => {
	const diamondPolicy = reliabilityMarketPolicyForScore(80);
	const goldPolicy = reliabilityMarketPolicyForScore(RELIABILITY_BASELINE_SCORE);
	const silverPolicy = reliabilityMarketPolicyForScore(20);
	const diamondRng = createRng(2026);
	const goldRng = createRng(2026);
	const silverRng = createRng(2026);
	const sampleSize = 200;

	const averageTerm = (terms: number[]): number => terms.reduce((sum, term) => sum + term, 0) / terms.length;
	const diamondTerms = Array.from({ length: sampleSize }, () => generateContract(diamondRng, 0.5, diamondPolicy).termMonths);
	const goldTerms = Array.from({ length: sampleSize }, () => generateContract(goldRng, 0.5, goldPolicy).termMonths);
	const silverTerms = Array.from({ length: sampleSize }, () => generateContract(silverRng, 0.5, silverPolicy).termMonths);

	assert.ok(averageTerm(diamondTerms) > averageTerm(goldTerms));
	assert.ok(averageTerm(goldTerms) > averageTerm(silverTerms));
});

test("monthlyRateMultiplierForTerm discounts longer commitments", () => {
	assert.equal(monthlyRateMultiplierForTerm(CONTRACT_TERM_DISCOUNT_BASELINE_MONTHS), 1);
	assert.ok(monthlyRateMultiplierForTerm(12) < monthlyRateMultiplierForTerm(8));
	assert.equal(monthlyRateMultiplierForTerm(48), CONTRACT_TERM_DISCOUNT_FLOOR);
});

test("generateContractForTermBand can intentionally target short and long offers", () => {
	const policy = reliabilityMarketPolicyForScore(RELIABILITY_BASELINE_SCORE);
	const shortContract = generateContractForTermBand(createRng(101), 0.55, "short", policy);
	const longContract = generateContractForTermBand(createRng(202), 0.55, "long", policy);

	assert.equal(contractTermBand(shortContract.termMonths), "short");
	assert.equal(contractTermBand(longContract.termMonths), "long");
	assert.ok(shortContract.name.split(" ").length >= 4);
	assert.ok(longContract.name.split(" ").length >= 4);
});

test("refreshContractMarket deliberately mixes short and long offers", () => {
	const state = makeState({
		tick: tick(10),
		rngState: 777,
		contractMarket: [],
	});

	const refreshed = refreshContractMarket(state);
	const bands = refreshed.contractMarket.map((contract) => contractTermBand(contract.termMonths));
	const uniqueNames = new Set(refreshed.contractMarket.map((contract) => contract.name));

	assert.ok(bands.includes("short"), `expected short-term offers, got ${bands.join(", ")}`);
	assert.ok(bands.includes("long"), `expected long-term offers, got ${bands.join(", ")}`);
	assert.ok(uniqueNames.size >= 3, `expected naming variety, got ${Array.from(uniqueNames).join(", ")}`);
	assert.deepEqual(refreshContractMarket(state), refreshed);
});

test("generateContract produces rush, anchor, and standard urgency types over a large sample", () => {
	const rng = createRng(9999);
	const urgencies = new Set<string>();
	for (let i = 0; i < 200; i++) {
		const contract = generateContract(rng, 0.5);
		urgencies.add(contract.urgency);
	}
	assert.ok(urgencies.has("standard"), "should produce standard contracts");
	assert.ok(urgencies.has("rush"), "should produce rush contracts");
	assert.ok(urgencies.has("anchor"), "should produce anchor contracts");
});

test("rush contracts have shorter term and higher payment than standard of same difficulty", () => {
	const rng = createRng(7777);
	let rush: Contract | undefined;
	let standard: Contract | undefined;
	for (let i = 0; i < 200 && (!rush || !standard); i++) {
		const c = generateContract(rng, 0.5);
		if (c.urgency === "rush" && !rush) rush = c;
		if (c.urgency === "standard" && !standard) standard = c;
	}
	assert.ok(rush, "should find a rush contract");
	assert.ok(standard, "should find a standard contract");
	assert.ok(rush!.termMonths <= 2, `rush term ${rush!.termMonths} should be <= 2`);
	assert.ok(rush!.expiresAtTick <= 2, `rush offer window ${rush!.expiresAtTick} should be <= 2`);
});

test("anchor contracts can surface long-lived enterprise commitments", () => {
	const rng = createRng(5555);
	let anchor: Contract | undefined;
	for (let i = 0; i < 500 && !anchor; i++) {
		const candidate = generateContract(rng, 0.5);
		if (
			candidate.urgency === "anchor" &&
			["enterprise_db", "cold_storage"].includes(generatedThemeId(candidate))
		) {
			anchor = candidate;
		}
	}
	assert.ok(anchor, "should find a long-term enterprise anchor contract");
	assert.ok(anchor!.termMonths >= 18, `anchor term ${anchor!.termMonths} should be >= 18`);
});

test("advanceContract keeps an already breached contract breached while it remains live", () => {
	const dc = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("breach-1", {
		status: "breached",
		startedAtTick: tick(2),
		assignedDcId: dc.id,
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		termMonths: 10,
	});

	const result = advanceContract(contract, dc, 4);
	assert.equal(result.status, "breached");
});

test("advanceContract keeps a newly-breachd contract as breached for one tick", () => {
	const dc = makeDatacenter("dc-1", [placement("rack-1", "C1", 0, 0)]);
	const contract = makeContract("active-1", {
		status: "active",
		startedAtTick: tick(2),
		assignedDcId: dc.id,
		requirements: { vCpu: 500, ramGb: 5_000, storageTb: 500, gpuFlops: 500 },
		termMonths: 10,
	});

	const result = advanceContract(contract, dc, 4);
	assert.equal(result.status, "breached");
});
