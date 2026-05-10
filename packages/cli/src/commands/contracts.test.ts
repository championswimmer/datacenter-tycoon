import assert from "node:assert/strict";
import test from "node:test";

import { newGame, type Action, type GameState } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runAcceptContractCommand, runCancelContractCommand, runContractCommand, runContractDetailsCommand } from "./contracts.js";
import { runLsCommand } from "./ls.js";

function createSnapshot(): GameState {
	const snapshot = newGame(7);
	const marketContract = snapshot.contractMarket[0]!;
	return {
		...snapshot,
		activeContracts: [
			{
				...marketContract,
				status: "breached",
				startedAtTick: 3,
				assignedDcId: "dc-1" as GameState["activeContracts"][number]["assignedDcId"],
			},
		],
		contractMarket: snapshot.contractMarket.slice(1),
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
	const [breachedSource, cancelledSource, expiredSource] = snapshot.contractMarket.slice(0, 3);
	return {
		...snapshot,
		activeContracts: [
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
		],
		contractMarket: snapshot.contractMarket.slice(3),
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
				return { kind: "market-contracts", items: snapshot.contractMarket };
			}
			if (params.kind === "list" && params.target === "active-contracts") {
				return { kind: "active-contracts", items: snapshot.activeContracts };
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
	const targetContractId = snapshot.activeContracts[0]!.id;
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
			contract: { id: string; status: string; assignedDcId: string | null; bucket: string; monthlyPayment: number };
			recentOutcomes: Array<{ contractId: string; kind: string; tick: number }>;
		};
	};
	assert.equal(parsed.ok, true);
	assert.equal(parsed.data.contract.bucket, "active");
	assert.equal(parsed.data.contract.id, targetContractId);
	assert.equal(parsed.data.contract.status, "breached");
	assert.equal(parsed.data.contract.assignedDcId, "dc-1");
	assert.equal(typeof parsed.data.contract.monthlyPayment, "number");
	assert.equal(parsed.data.recentOutcomes.length, 1);
	assert.equal(parsed.data.recentOutcomes[0]?.kind, "breached");
	assert.equal(parsed.data.recentOutcomes[0]?.tick, 4);
	assert.equal(parsed.data.recentOutcomes[0]?.contractId, targetContractId);
});

test("runContractDetailsCommand text output shows the assigned datacenter", async () => {
	const snapshot = createSnapshot();
	const targetContractId = snapshot.activeContracts[0]!.id;
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
	assert.doesNotMatch(logged[0] ?? "", /DC: unassigned/);
});

test("contract list and details json use the same canonical monthlyPayment schema", async () => {
	const snapshot = createSnapshot();
	const targetContractId = snapshot.activeContracts[0]!.id;
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

test("runContractCommand preserves breached, cancelled, and expired statuses in details output", async () => {
	const snapshot = createStatusSnapshot();
	const actions: Action[] = [];
	const logged: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		logged.push(String(message ?? ""));
	};

	try {
		await runContractCommand(parseArgv(["contract", "details", snapshot.activeContracts[0]!.id, "--json"]), () => createFakeClient(actions, snapshot));
		await runContractCommand(parseArgv(["contract", "details", snapshot.activeContracts[1]!.id, "--json"]), () => createFakeClient(actions, snapshot));
		await runContractCommand(parseArgv(["contract", "details", snapshot.activeContracts[2]!.id, "--json"]), () => createFakeClient(actions, snapshot));
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
	// snapshot.activeContracts[2] is expired
	const expiredContractId = snapshot.activeContracts[2]!.id;
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

test("runContractDetailsCommand text output labels active/breached contract as LIVE", async () => {
	const snapshot = createStatusSnapshot();
	// snapshot.activeContracts[0] is breached (live)
	const breachedContractId = snapshot.activeContracts[0]!.id;
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
