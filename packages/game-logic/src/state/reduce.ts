import { acceptContract } from "../contracts/market.js";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { applyCapex } from "../economy/capex.js";
import { canPlaceRack } from "../entities/datacenter.js";
import { tick } from "../sim/tick.js";
import type {
	ContractId,
	Datacenter,
	DatacenterId,
	DatacenterSpec,
	DatacenterSpecId,
	GameState,
	RackPlacement,
	RackPlacementId,
	RackSpec,
	RackSpecId,
} from "../types.js";

export type Action =
	| { type: "BuildDatacenter"; specId: DatacenterSpecId; dcId: DatacenterId }
	| {
			type: "PlaceRack";
			dcId: DatacenterId;
			specId: RackSpecId;
			row: number;
			position: number;
			placementId: RackPlacementId;
	  }
	| { type: "RemoveRack"; dcId: DatacenterId; placementId: RackPlacementId }
	| { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
	| { type: "CancelContract"; contractId: ContractId }
	| { type: "SetAudioEnabled"; enabled: boolean }
	| { type: "UpdateAudioSettings"; settings: Partial<import("../types.js").AudioSettings> }
	| { type: "SetSpeed"; speed: number }
	| { type: "SetPaused"; paused: boolean }
	| { type: "Tick" };

function getDatacenterSpec(specId: DatacenterSpecId): DatacenterSpec {
	const spec = DATACENTER_CATALOG[specId];
	if (!spec) {
		throw new Error(`Unknown datacenter spec: ${specId}`);
	}

	return spec;
}

function getRackSpec(specId: RackSpecId): RackSpec {
	const spec = RACK_CATALOG[specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${specId}`);
	}

	return spec;
}

function getDatacenter(state: GameState, dcId: DatacenterId): Datacenter {
	const datacenter = state.datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

function replaceDatacenter(state: GameState, updatedDatacenter: Datacenter): GameState {
	return {
		...state,
		datacenters: state.datacenters.map((datacenter) =>
			datacenter.id === updatedDatacenter.id ? updatedDatacenter : datacenter,
		),
	};
}

function assertUniqueDatacenterId(state: GameState, dcId: DatacenterId): void {
	if (state.datacenters.some((datacenter) => datacenter.id === dcId)) {
		throw new Error(`Datacenter already exists: ${dcId}`);
	}
}

function assertUniquePlacementId(state: GameState, placementId: RackPlacementId): void {
	if (
		state.datacenters.some((datacenter) =>
			datacenter.placements.some((placement) => placement.id === placementId),
		)
	) {
		throw new Error(`Rack placement already exists: ${placementId}`);
	}
}

function buildDatacenter(state: GameState, specId: DatacenterSpecId, dcId: DatacenterId): GameState {
	assertUniqueDatacenterId(state, dcId);
	const spec = getDatacenterSpec(specId);
	const sameSpecCount = state.datacenters.filter((datacenter) => datacenter.spec.id === spec.id).length;
	const namedDatacenter: Datacenter = {
		id: dcId,
		name: sameSpecCount === 0 ? spec.name : `${spec.name} ${sameSpecCount + 1}`,
		spec,
		placements: [],
		builtAtTick: state.tick,
	};

	const debitedState = applyCapex(state, spec.capexCost, `Build datacenter: ${spec.name}`);
	return {
		...debitedState,
		datacenters: [...debitedState.datacenters, namedDatacenter],
	};
}

function placeRack(
	state: GameState,
	dcId: DatacenterId,
	specId: RackSpecId,
	row: number,
	position: number,
	placementId: RackPlacementId,
): GameState {
	assertUniquePlacementId(state, placementId);
	const datacenter = getDatacenter(state, dcId);
	const spec = getRackSpec(specId);
	const placementCheck = canPlaceRack(datacenter, spec, { row, position });
	if (!placementCheck.ok) {
		throw new Error(`Cannot place rack: ${placementCheck.reason}`);
	}

	const placement: RackPlacement = {
		id: placementId,
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: state.tick,
		row,
		position,
	};
	const debitedState = applyCapex(state, spec.capexCost, `Purchase rack: ${spec.name}`);
	const refreshedDatacenter = {
		...getDatacenter(debitedState, dcId),
		placements: [...datacenter.placements, placement],
	};

	return replaceDatacenter(debitedState, refreshedDatacenter);
}

function removeRack(state: GameState, dcId: DatacenterId, placementId: RackPlacementId): GameState {
	const datacenter = getDatacenter(state, dcId);
	const placementExists = datacenter.placements.some((placement) => placement.id === placementId);
	if (!placementExists) {
		throw new Error(`Unknown rack placement: ${placementId}`);
	}

	return replaceDatacenter(state, {
		...datacenter,
		placements: datacenter.placements.filter((placement) => placement.id !== placementId),
	});
}

function cancelContract(state: GameState, contractId: ContractId): GameState {
	const contract = state.activeContracts.find((candidate) => candidate.id === contractId);
	if (!contract) {
		throw new Error(`Unknown active contract: ${contractId}`);
	}

	if (contract.status === "completed" || contract.status === "cancelled") {
		throw new Error(`Contract cannot be cancelled from status: ${contract.status}`);
	}

	return {
		...state,
		activeContracts: state.activeContracts.map((candidate) =>
			candidate.id === contractId ? { ...candidate, status: "cancelled" } : candidate,
		),
	};
}

function assertNever(value: never): never {
	throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}

export function reduce(state: GameState, action: Action): GameState {
	switch (action.type) {
		case "BuildDatacenter":
			return buildDatacenter(state, action.specId, action.dcId);
		case "PlaceRack":
			return placeRack(state, action.dcId, action.specId, action.row, action.position, action.placementId);
		case "RemoveRack":
			return removeRack(state, action.dcId, action.placementId);
		case "AcceptContract":
			return acceptContract(state, action.contractId, action.dcId);
		case "CancelContract":
			return cancelContract(state, action.contractId);
		case "SetAudioEnabled":
			return {
				...state,
				audioEnabled: action.enabled,
				audioSettings: { ...state.audioSettings, master: action.enabled },
			};
		case "UpdateAudioSettings":
			return {
				...state,
				audioSettings: { ...state.audioSettings, ...action.settings },
				audioEnabled: action.settings.master ?? state.audioSettings.master,
			};
		case "SetSpeed":
			return {
				...state,
				game: { ...state.game, speed: action.speed, paused: action.speed === 0 },
			};
		case "SetPaused":
			return {
				...state,
				game: { ...state.game, paused: action.paused },
			};
		case "Tick":
			return tick(state);
		default:
			return assertNever(action);
	}
}
