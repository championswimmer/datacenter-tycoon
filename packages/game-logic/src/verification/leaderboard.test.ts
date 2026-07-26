import assert from "node:assert/strict";
import test from "node:test";

import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { createPerformanceFixture } from "../perf/fixtures.js";
import { summarizeLeaderboardFromState } from "../query/leaderboard.js";
import { summarizeOpenMarketContractFits } from "../query/contracts.js";
import { createVerifiedGenesisState } from "../state/newGame.js";
import { reduce } from "../state/reduce.js";
import type { ContractId, DatacenterId, GameId, RackPlacementId, RegionId } from "../types.js";
import {
	LEADERBOARD_VERIFICATION_ACTION_TYPES,
	replayLeaderboardVerificationActions,
	type LeaderboardVerificationAction,
} from "./leaderboard.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const gameId = (value: string): GameId => value as GameId;
const contractId = (value: string): ContractId => value as ContractId;

function reduceVerificationActions(
	initialState: ReturnType<typeof createVerifiedGenesisState> | ReturnType<typeof createPerformanceFixture>["state"],
	actions: readonly LeaderboardVerificationAction[],
) {
	const state = actions.reduce((currentState, action) => reduce(currentState, action), initialState);
	return {
		state,
		summary: summarizeLeaderboardFromState(state),
	};
}

test("leaderboard verification action types exclude presentation-only reducer actions", () => {
	assert.deepEqual(LEADERBOARD_VERIFICATION_ACTION_TYPES, [
		"BuildDatacenter",
		"PlaceRack",
		"RemoveRack",
		"MoveRack",
		"AcceptContract",
		"CancelContract",
		"FabricLink",
		"UpgradeDatacenter",
		"SetMaintenanceStaff",
		"Subtick",
		"Tick",
	]);
});

test("replayLeaderboardVerificationActions matches reducer output for a server-generated contract acceptance", () => {
	const initialState = createVerifiedGenesisState({
		seed: 42,
		difficulty: "easy",
		gameId: gameId("verified-run-accept-contract"),
		playerName: "Verifier",
	});
	const regionId = initialState.map.regions[0]!.id as RegionId;
	const dcId = datacenterId("dc-verified-1");
	let state = initialState;
	const actions: LeaderboardVerificationAction[] = [];
	let acceptedContractId: ContractId | null = null;

	const apply = (action: LeaderboardVerificationAction) => {
		actions.push(action);
		state = reduce(state, action);
	};

	apply({
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.warehouse.id,
		dcId,
		regionId,
	});

	const rackSpecs = [
		RACK_CATALOG.C0.id,
		RACK_CATALOG.C0.id,
		RACK_CATALOG.C1.id,
		RACK_CATALOG.M0.id,
		RACK_CATALOG.M0.id,
		RACK_CATALOG.M1.id,
		RACK_CATALOG.S0.id,
		RACK_CATALOG.S0.id,
		RACK_CATALOG.S1.id,
		RACK_CATALOG.G0.id,
	] as const;

	for (let index = 0; index < rackSpecs.length; index += 1) {
		const datacenter = state.datacenters.find((candidate) => candidate.id === dcId);
		assert.ok(datacenter, "Expected built datacenter to exist before placing racks.");
		const position = index % datacenter.spec.positionsPerRow;
		const row = Math.floor(index / datacenter.spec.positionsPerRow);
		apply({
			type: "PlaceRack",
			dcId,
			specId: rackSpecs[index]!,
			row,
			position,
			placementId: rackPlacementId(`verified-rack-${index}`),
		});

		const fittingContract = summarizeOpenMarketContractFits(state).find(
			(summary) => summary.fitStatus === "fits" && summary.fittingDcIds.includes(dcId),
		);
		if (fittingContract) {
			acceptedContractId = fittingContract.contractId;
			break;
		}
	}

	assert.ok(acceptedContractId, "Expected at least one generated market contract to fit the built warehouse.");
	apply({
		type: "AcceptContract",
		contractId: acceptedContractId,
		dcId,
	});

	const direct = reduceVerificationActions(initialState, actions);
	const replayed = replayLeaderboardVerificationActions(initialState, actions);

	assert.deepEqual(replayed.state, direct.state);
	assert.deepEqual(replayed.summary, direct.summary);
	assert.equal(replayed.state.rngState, direct.state.rngState);
	assert.ok(replayed.state.activeContracts.some((contract) => contract.id === acceptedContractId));
});

test("replayLeaderboardVerificationActions preserves rngState and leaderboard summaries across subticks and a five-month batch", () => {
	const fixture = createPerformanceFixture("stress", { seed: 4242 });
	const actions: LeaderboardVerificationAction[] = [
		{ type: "Subtick" },
		{ type: "Subtick" },
		{ type: "Subtick" },
		{ type: "Tick" },
		{ type: "Tick" },
		{ type: "Tick" },
		{ type: "Tick" },
		{ type: "Tick" },
	];

	const direct = reduceVerificationActions(fixture.state, actions);
	const replayed = replayLeaderboardVerificationActions(fixture.state, actions);
	const newlyFailedRackCount = direct.state.datacenters.reduce(
		(count, datacenter) =>
			count
			+ datacenter.placements.filter((placement) => (placement.lastFailureAtTick ?? -1) > fixture.state.tick)
				.length,
		0,
	);

	assert.equal(direct.state.tick - fixture.state.tick, 5);
	assert.ok(fixture.state.subtick > 0, "Expected the performance fixture to start mid-month.");
	assert.ok(newlyFailedRackCount > 0, "Expected deterministic replay to include at least one rack failure.");
	assert.deepEqual(replayed.summary, direct.summary);
	assert.equal(replayed.state.rngState, direct.state.rngState);
	assert.deepEqual(replayed.state.player.reliability, direct.state.player.reliability);
});

test("replayLeaderboardVerificationActions rejects invented contract ids during replay", () => {
	const initialState = createVerifiedGenesisState({
		seed: 7,
		difficulty: "easy",
		gameId: gameId("verified-run-invalid-contract"),
		playerName: "Verifier",
	});
	const actions: LeaderboardVerificationAction[] = [
		{
			type: "BuildDatacenter",
			specId: DATACENTER_CATALOG.garage.id,
			dcId: datacenterId("dc-invalid-contract"),
			regionId: initialState.map.regions[0]!.id,
		},
		{
			type: "AcceptContract",
			contractId: contractId("contract-does-not-exist"),
			dcId: datacenterId("dc-invalid-contract"),
		},
	];

	assert.throws(() => replayLeaderboardVerificationActions(initialState, actions), {
		message: /Unknown market contract/,
	});
});
