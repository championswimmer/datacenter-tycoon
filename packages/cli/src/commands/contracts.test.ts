import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG, newGame, type Action, type GameState } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runAcceptContractCommand, runCancelContractCommand, runContractCommand } from "./contracts.js";
import { runLsCommand } from "./ls.js";

function createSnapshot(): GameState {
	const snapshot = newGame(7);
	const marketContract = snapshot.contractMarket[0]!;
	return {
		...snapshot,
		contracts: [
			{
				...marketContract,
				status: "breached",
				startedAtTick: 3,
				assignedDcId: "dc-1" as GameState["activeContracts"][number]["assignedDcId"],
			},
			...snapshot.contractMarket.slice(1),
		],
		activeContracts: [],
		contractMarket: [],
		player: {
			...snapshot.player,
			reliability: {
				...snapshot.player.reliability,
				recentOutcomes: [
					{
						contractId: marketContract.id,
						contractName: marketContract.name,
						tick: 4,
						kind: "breached",
					},
				],
			},
		},
	};
}

function createStatusSnapshot(): GameState {
	const snapshot = newGame(11);
	const [breachedSource, cancelledSource, expiredSource, ...market] = snapshot.contractMarket;
	return {
		...snapshot,
		contracts: [
			{
				...breachedSource!,
				status: "breached",
				startedAtTick: 1,
				assignedDcId: "dc-1" as GameState["activeContracts"][number]["assignedDcId"],
			},
			{
				...cancelledSource!,
				status: "cancelled",
				startedAtTick: 2,
				assignedDcId: "dc-1" as GameState["activeContracts"][number]["assignedDcId"],
			},
			{
				...expiredSource!,
				status: "expired",
				startedAtTick: 0,
				assignedDcId: "dc-2" as GameState["activeContracts"][number]["assignedDcId"],
			},
			...market,
		],
		activeContracts: [],
		contractMarket: [],
		player: {
			...snapshot.player,
			reliability: {
				...snapshot.player.reliability,
				recentOutcomes: [
					{ contractId: breachedSource!.id, contractName: breachedSource!.name, tick: 3, kind: "breached" },
					{ contractId: cancelledSource!.id, contractName: cancelledSource!.name, tick: 2, kind: "cancelled" },
					{ contractId: expiredSource!.id, contractName: expiredSource!.name, tick: 1, kind: "fulfilled" },
				],
			},
		},
	};
}

function createFakeClient(actions: Action[], snapshot: GameState = createSnapshot()): CommandClient {
	return {
		connect: async () => undefined,
		dispatch: async (action) => {
			actions.push(action);
			return { tick: 0 };
		},
		query: async (params) => {
			if (params.kind === "snapshot") {
				return snapshot;
			}
			if (params.kind === "list" && params.target === "market-contracts") {
				return { kind: "market-contracts", items: snapshot.contracts.slice(1) };
			}
			if (params.kind === "list" && params.target === "active-contracts") {
				return { kind: "active-contracts", items: [snapshot.contracts[0]] };
			}
			if (params.kind === "list" && params.target === "contracts") {
				return {
					kind: "contracts",
					market: snapshot.contracts.slice(1),
					active: [snapshot.contracts[0]!],
					history: [],
				};
			}
			return { tick: 0 };
		},
		control: async () => ({ ok: true }),
		close: async () => undefined,
	};
}

test("runAcceptContractCommand dispatches AcceptContract", async () => {
	const actions: Action[] = [];
	await runAcceptContractCommand(parseArgv(["accept-contract", "offer-1", "dc-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "AcceptContract", contractId: "offer-1", dcId: "dc-1" }]);
});

test("runCancelContractCommand dispatches CancelContract", async () => {
	const actions: Action[] = [];
	await runCancelContractCommand(parseArgv(["cancel-contract", "offer-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "CancelContract", contractId: "offer-1" }]);
});

test("runContractCommand routes accept subcommand", async () => {
	const actions: Action[] = [];
	await runContractCommand(parseArgv(["contract", "accept", "offer-1", "dc-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "AcceptContract", contractId: "offer-1", dcId: "dc-1" }]);
});

test("runContractCommand routes cancel subcommand", async () => {
	const actions: Action[] = [];
	await runContractCommand(parseArgv(["contract", "cancel", "offer-1", "--quiet"]), () => createFakeClient(actions));

	assert.deepEqual(actions, [{ type: "CancelContract", contractId: "offer-1" }]);
});

test("runContractDetailsCommand returns snapshot-backed contract details as json", async () => {
	const snapshot = createSnapshot();
	const targetContractId = snapshot.contracts[0]!.id;
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runContractCommand(parseArgv(["contract", "details", targetContractId, "--json"]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}

	assert.equal(actions.length, 0);
	assert.equal(logged.length, 1);
	const parsed = JSON.parse(logged[0] ?? "{}") as {
		ok: boolean;
		data: {
			contract: {
				id: string;
				status: string;
				assignedDcId: string | null;
				bucket: string;
				monthlyPayment: number;
				regionAffinity?: { key: string; label: string; allowedRegionIds: string[]; allowedRegions: string[] };
			};
			recentOutcomes: Array<{ contractId: string; kind: string; tick: number }>;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.contract.bucket, "active");
	assert.equal(parsed.data.contract.id, targetContractId);
	assert.equal(parsed.data.contract.status, "breached");
	assert.equal(parsed.data.contract.assignedDcId, "dc-1");
	assert.equal(typeof parsed.data.contract.monthlyPayment, "number");
	assert.equal(parsed.data.contract.regionAffinity, undefined);
	assert.equal(parsed.data.recentOutcomes.length, 1);
	assert.equal(parsed.data.recentOutcomes[0]?.kind, "breached");
	assert.equal(parsed.data.recentOutcomes[0]?.tick, 4);
	assert.equal(parsed.data.recentOutcomes[0]?.contractId, targetContractId);
});

test("runContractDetailsCommand text output shows the assigned datacenter", async () => {
	const snapshot = createSnapshot();
	const targetContractId = snapshot.contracts[0]!.id;
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runContractCommand(parseArgv(["contract", "details", targetContractId]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}

	assert.equal(actions.length, 0);
	assert.equal(logged.length, 1);
	assert.match(logged[0] ?? "", /Assigned DC: dc-1/);
	assert.match(logged[0] ?? "", /Regions: Any region/);
	assert.doesNotMatch(logged[0] ?? "", /Assigned DC: unassigned/);
});

test("contract list text output shows the assigned datacenter", async () => {
	const snapshot = createSnapshot();
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runLsCommand(parseArgv(["ls", "contracts"]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}

	assert.equal(actions.length, 0);
	assert.equal(logged.length, 1);
	assert.match(logged[0] ?? "", /DC: dc-1/);
	assert.match(logged[0] ?? "", /Regions: Any region/);
	assert.doesNotMatch(logged[0] ?? "", /DC: unassigned/);
});

test("contract list and details json use the same canonical monthlyPayment schema", async () => {
	const snapshot = createSnapshot();
	const targetContractId = snapshot.contracts[0]!.id;
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runLsCommand(parseArgv(["ls", "contracts", "--json"]), () => createFakeClient(actions, snapshot));
		await runContractCommand(parseArgv(["contract", "details", targetContractId, "--json"]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}

	const listPayload = JSON.parse(logged[0] ?? "{}") as {
		data: {
			market: Array<Record<string, unknown>>;
			active: Array<Record<string, unknown>>;
		};
	};
	const detailPayload = JSON.parse(logged[1] ?? "{}") as {
		data: {
			contract: Record<string, unknown>;
		};
	};

	assert.ok(listPayload.data.market[0]);
	assert.ok(listPayload.data.active[0]);
	assert.ok(detailPayload.data.contract);
	assert.equal("paymentPerMonth" in listPayload.data.market[0]!, false);
	assert.equal("paymentPerMonth" in detailPayload.data.contract, false);
	assert.equal(typeof listPayload.data.market[0]?.monthlyPayment, "number");
	assert.equal(typeof listPayload.data.active[0]?.monthlyPayment, "number");
	assert.equal(typeof detailPayload.data.contract.monthlyPayment, "number");
	assert.equal(listPayload.data.active[0]?.assignedDcId, "dc-1");
	assert.equal(detailPayload.data.contract.assignedDcId, "dc-1");
	assert.deepEqual(
		Object.keys(detailPayload.data.contract).sort(),
		Object.keys(listPayload.data.active[0] ?? {}).sort(),
	);
});

test("contract list and details json include region affinity only for restricted contracts", async () => {
	const base = newGame(7);
	const restrictedContract = {
		...base.contractMarket[0]!,
		id: "offer-eu" as typeof base.contractMarket[number]["id"],
		regionAffinity: {
			key: "eu" as const,
			allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
		},
	};
	const unrestrictedContract = {
		...base.contractMarket[1]!,
		id: "offer-global" as typeof base.contractMarket[number]["id"],
	};
	const snapshot: GameState = {
		...base,
		contracts: [restrictedContract, unrestrictedContract],
		contractMarket: [restrictedContract, unrestrictedContract],
		activeContracts: [],
	};
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	const affinityAwareClient = () => ({
		...createFakeClient(actions, snapshot),
		query: async (params: { kind: string; target?: string }) => {
			if (params.kind === "snapshot") {
				return snapshot;
			}
			if (params.kind === "list" && params.target === "contracts") {
				return {
					kind: "contracts" as const,
					market: snapshot.contractMarket,
					active: snapshot.activeContracts,
					history: [],
				};
			}
			return { tick: 0 };
		},
	});

	try {
		await runLsCommand(parseArgv(["ls", "contracts", "--json"]), affinityAwareClient);
		await runContractCommand(parseArgv(["contract", "details", restrictedContract.id, "--json"]), affinityAwareClient);
	} finally {
		console.log = originalLog;
	}

	const listPayload = JSON.parse(logged[0] ?? "{}") as {
		data: {
			market: Array<Record<string, unknown>>;
		};
	};
	const detailsPayload = JSON.parse(logged[1] ?? "{}") as {
		data: {
			contract: Record<string, unknown>;
		};
	};
	const restrictedListEntry = listPayload.data.market.find((contract) => contract.id === restrictedContract.id);
	const unrestrictedListEntry = listPayload.data.market.find((contract) => contract.id === unrestrictedContract.id);

	assert.deepEqual(restrictedListEntry?.regionAffinity, {
		key: "eu",
		label: "EU only",
		allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
		allowedRegions: [
			`${REGION_CATALOG.eu_west.code} · ${REGION_CATALOG.eu_west.city} · ${REGION_CATALOG.eu_west.name}`,
			`${REGION_CATALOG.eu_central.code} · ${REGION_CATALOG.eu_central.city} · ${REGION_CATALOG.eu_central.name}`,
		],
	});
	assert.equal("regionAffinity" in (unrestrictedListEntry ?? {}), false);
	assert.deepEqual(detailsPayload.data.contract.regionAffinity, restrictedListEntry?.regionAffinity);
});

test("contract list and details text show region affinity summaries", async () => {
	const base = newGame(7);
	const restrictedContract = {
		...base.contractMarket[0]!,
		id: "offer-eu" as typeof base.contractMarket[number]["id"],
		regionAffinity: {
			key: "eu" as const,
			allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
		},
	};
	const snapshot: GameState = {
		...base,
		contracts: [restrictedContract],
		contractMarket: [restrictedContract],
		activeContracts: [],
	};
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	const affinityAwareClient = () => ({
		...createFakeClient(actions, snapshot),
		query: async (params: { kind: string; target?: string }) => {
			if (params.kind === "snapshot") {
				return snapshot;
			}
			if (params.kind === "list" && params.target === "contracts") {
				return {
					kind: "contracts" as const,
					market: snapshot.contractMarket,
					active: [],
					history: [],
				};
			}
			return { tick: 0 };
		},
	});

	try {
		await runLsCommand(parseArgv(["ls", "contracts"]), affinityAwareClient);
		await runContractCommand(parseArgv(["contract", "details", restrictedContract.id]), affinityAwareClient);
	} finally {
		console.log = originalLog;
	}

	assert.match(logged[0] ?? "", /Regions: EU only/);
	assert.match(logged[0] ?? "", /DUB · Dublin · EU West/);
	assert.match(logged[1] ?? "", /Regions: EU only/);
	assert.match(logged[1] ?? "", /FRA · Frankfurt · EU Central/);
});

test("runAcceptContractCommand preserves structured capacity errors from the daemon", async () => {
	const required = { vCpu: 10, ramGb: 20, storageTb: 30, gpuFlops: 40 };
	const available = { vCpu: 1, ramGb: 2, storageTb: 3, gpuFlops: 4 };

	await assert.rejects(
		() =>
			runAcceptContractCommand(
				parseArgv(["accept-contract", "offer-1", "dc-1", "--json"]),
				() => ({
					...createFakeClient([]),
					dispatch: async () => {
						throw Object.assign(new Error("Datacenter dc-1 lacks available capacity for this contract"), {
							data: {
								code: "insufficient_capacity",
								dcId: "dc-1",
								required,
								available,
							},
						});
					},
				}),
			),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			assert.deepEqual((error as Error & { data?: unknown }).data, {
				code: "insufficient_capacity",
				dcId: "dc-1",
				required,
				available,
			});
			return true;
		},
	);
});

test("runAcceptContractCommand preserves structured region-mismatch errors from the daemon", async () => {
	await assert.rejects(
		() =>
			runAcceptContractCommand(
				parseArgv(["accept-contract", "offer-1", "dc-1", "--json"]),
				() => ({
					...createFakeClient([]),
					dispatch: async () => {
						throw Object.assign(new Error("Datacenter dc-1 is in region us_west, but this contract only allows eu_west, eu_central"), {
							data: {
								code: "region_not_allowed",
								dcId: "dc-1",
								dcRegionId: "us_west",
								affinityKey: "eu",
								allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
							},
						});
					},
				}),
			),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			assert.deepEqual((error as Error & { data?: unknown }).data, {
				code: "region_not_allowed",
				dcId: "dc-1",
				dcRegionId: "us_west",
				affinityKey: "eu",
				allowedRegionIds: [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id],
			});
			return true;
		},
	);
});

test("runContractCommand preserves breached, cancelled, and expired statuses in details output", async () => {
	const snapshot = createStatusSnapshot();
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runContractCommand(parseArgv(["contract", "details", snapshot.contracts[0]!.id, "--json"]), () => createFakeClient(actions, snapshot));
		await runContractCommand(parseArgv(["contract", "details", snapshot.contracts[1]!.id, "--json"]), () => createFakeClient(actions, snapshot));
		await runContractCommand(parseArgv(["contract", "details", snapshot.contracts[2]!.id, "--json"]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}

	assert.equal(actions.length, 0);
	const breachedPayload = JSON.parse(logged[0] ?? "{}") as { data: { contract: { status: string; assignedDcId: string | null } } };
	const cancelledPayload = JSON.parse(logged[1] ?? "{}") as { data: { contract: { status: string; assignedDcId: string | null } } };
	const expiredPayload = JSON.parse(logged[2] ?? "{}") as { data: { contract: { status: string; assignedDcId: string | null } } };
	assert.equal(breachedPayload.data.contract.status, "breached");
	assert.equal(breachedPayload.data.contract.assignedDcId, "dc-1");
	assert.equal(cancelledPayload.data.contract.status, "cancelled");
	assert.equal(cancelledPayload.data.contract.assignedDcId, "dc-1");
	assert.equal(expiredPayload.data.contract.status, "expired");
	assert.equal(expiredPayload.data.contract.assignedDcId, "dc-2");
});

test("runContractCommand rejects bare command and points users to ls contracts", async () => {
	await assert.rejects(() => runContractCommand(parseArgv(["contract"])), /To list all contracts, use: dct ls contracts/);
});

test("runContractDetailsCommand text output labels expired contract as HISTORICAL, not live", async () => {
	const snapshot = createStatusSnapshot();
	const expiredContractId = snapshot.contracts[2]!.id;
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message ?? "")); };
	try {
		await runContractCommand(parseArgv(["contract", "details", expiredContractId]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}
	const output = logged[0] ?? "";
	assert.match(output, /HISTORICAL/, "expired contract should be labeled HISTORICAL in details output");
	assert.ok(!output.includes("currently commits capacity"), "expired contract must not say it commits capacity");
});

test("runContractDetailsCommand text output labels active\/breached contract as LIVE", async () => {
	const snapshot = createStatusSnapshot();
	const breachedContractId = snapshot.contracts[0]!.id;
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => { logged.push(String(message ?? "")); };
	try {
		await runContractCommand(parseArgv(["contract", "details", breachedContractId]), () => createFakeClient(actions, snapshot));
	} finally {
		console.log = originalLog;
	}
	const output = logged[0] ?? "";
	assert.match(output, /LIVE/, "breached contract should be labeled LIVE in details output");
	assert.match(output, /currently commits capacity/);
});
