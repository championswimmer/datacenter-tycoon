import { DEFAULT_MAINTENANCE_STAFF, MAX_MAINTENANCE_STAFF } from "../balance/maintenance.js";
import { acceptContract } from "../contracts/market.js";
import { contractsFromState, isLiveContract, withDerivedContractViews } from "../contracts/lifecycle.js";
import { createDatacenterUpgradeProgress } from "../catalog/datacenter-upgrades.js";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { applyCapex } from "../economy/capex.js";
import { calculateMoveCost } from "../economy/move.js";
import { applyDatacenterUpgrade, canMoveRack, canPlaceRack, validateDatacenterUpgradeRequest } from "../entities/datacenter.js";
import { applyValidatedFabricLink, validateFabricLinkRequest } from "../entities/fabric.js";
import { canBuildInRegion } from "../entities/region.js";
import { advanceSubtick } from "../sim/subtick.js";
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
	RegionId,
} from "../types.js";

export type Action =
	| { type: "BuildDatacenter"; specId: DatacenterSpecId; dcId: DatacenterId; regionId: RegionId }
	| {
			type: "PlaceRack";
			dcId: DatacenterId;
			specId: RackSpecId;
			row: number;
			position: number;
			placementId: RackPlacementId;
	  }
	| { type: "RemoveRack"; dcId: DatacenterId; placementId: RackPlacementId }
	| {
			type: "MoveRack";
			dcId: DatacenterId;
			placementId: RackPlacementId;
			targetDcId: DatacenterId;
			row: number;
			position: number;
	  }
	| { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
	| { type: "CancelContract"; contractId: ContractId }
	| { type: "FabricLink"; sourceDcId: DatacenterId; targetDcId: DatacenterId }
	| { type: "UpgradeDatacenter"; dcId: DatacenterId; trackId: import("../types.js").DatacenterUpgradeTrackId; targetNodeId: string }
	| { type: "SetMaintenanceStaff"; dcId: DatacenterId; maintenanceStaff: number }
	| { type: "SetAudioEnabled"; enabled: boolean }
	| { type: "UpdateAudioSettings"; settings: Partial<import("../types.js").AudioSettings> }
	| { type: "SetSpeed"; speed: number }
	| { type: "SetPaused"; paused: boolean }
	| { type: "Subtick" }
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

function buildDatacenter(state: GameState, specId: DatacenterSpecId, dcId: DatacenterId, regionId: RegionId): GameState {
	assertUniqueDatacenterId(state, dcId);
	const spec = getDatacenterSpec(specId);
	const region = state.map.regions.find((r) => r.id === regionId);
	if (!region) {
		throw new Error(`Unknown region: ${regionId}`);
	}
	if (!canBuildInRegion(region, spec, state.datacenters)) {
		throw new Error(`Insufficient power or staff in region: ${regionId}`);
	}

	const sameSpecCount = state.datacenters.filter((datacenter) => datacenter.spec.id === spec.id).length;
	const namedDatacenter: Datacenter = {
		id: dcId,
		name: sameSpecCount === 0 ? spec.name : `${spec.name} ${sameSpecCount + 1}`,
		spec,
		placements: [],
		builtAtTick: state.tick,
		regionId,
		maintenanceStaff: DEFAULT_MAINTENANCE_STAFF,
		upgrades: createDatacenterUpgradeProgress(spec.id),
	};

	const updatedRegions = state.map.regions.map((r) =>
		r.id === regionId
			? {
					...r,
					powerUsed: r.powerUsed + spec.powerCapacityKw,
					staffUsed: r.staffUsed + spec.staffCount,
				}
			: r,
	);

	const debitedState = applyCapex(state, spec.capexCost, `Build datacenter: ${spec.name}`);
	return {
		...debitedState,
		datacenters: [...debitedState.datacenters, namedDatacenter],
		map: { ...debitedState.map, regions: updatedRegions },
	};
}

function createRackPlacementError(datacenter: Datacenter, reason: string): Error {
	const error = new Error(`Cannot place rack: ${reason}`) as Error & { data?: unknown };
	if (reason === "out_of_bounds") {
		error.data = {
			code: "out_of_bounds",
			dcId: datacenter.id,
			rows: datacenter.spec.rows,
			positionsPerRow: datacenter.spec.positionsPerRow,
		};
	}
	return error;
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
		throw createRackPlacementError(datacenter, placementCheck.reason);
	}

	const placement: RackPlacement = {
		id: placementId,
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: state.tick,
		health: "healthy",
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

function moveRack(
	state: GameState,
	dcId: DatacenterId,
	placementId: RackPlacementId,
	targetDcId: DatacenterId,
	row: number,
	position: number,
): GameState {
	const sourceDc = getDatacenter(state, dcId);
	const placement = sourceDc.placements.find((p) => p.id === placementId);
	if (!placement) {
		throw new Error(`Unknown rack placement: ${placementId}`);
	}

	if (dcId === targetDcId) {
		throw new Error("Cannot move rack to the same datacenter");
	}

	const targetDc = getDatacenter(state, targetDcId);
	const spec = getRackSpec(placement.specId);
	const moveCheck = canMoveRack(sourceDc, targetDc, placement, { row, position });
	if (!moveCheck.ok) {
		const reason = moveCheck.reason.replace(/^Cannot place rack: /, "");
		if (
			reason === "slot_taken" ||
			reason === "out_of_bounds" ||
			reason === "insufficient_power" ||
			reason === "insufficient_cooling" ||
			reason === "insufficient_bandwidth" ||
			reason === "cooling_type_mismatch"
		) {
			throw createRackPlacementError(targetDc, reason);
		}

		throw new Error(moveCheck.reason);
	}

	const cost = calculateMoveCost(spec, sourceDc.regionId, targetDc.regionId);
	const debitedState = applyCapex(state, cost, `Move rack: ${spec.name} to ${targetDc.name}`);

	const movedPlacement: RackPlacement = {
		...placement,
		row,
		position,
	};

	const updatedSourceDc = {
		...sourceDc,
		placements: sourceDc.placements.filter((p) => p.id !== placementId),
	};
	const updatedTargetDc = {
		...targetDc,
		placements: [...targetDc.placements, movedPlacement],
	};

	return replaceDatacenter(replaceDatacenter(debitedState, updatedSourceDc), updatedTargetDc);
}

function upgradeDatacenter(
	state: GameState,
	dcId: DatacenterId,
	trackId: import("../types.js").DatacenterUpgradeTrackId,
	targetNodeId: string,
): GameState {
	const datacenter = getDatacenter(state, dcId);
	const validated = validateDatacenterUpgradeRequest(datacenter, trackId, targetNodeId);
	const debitedState = applyCapex(
		state,
		validated.capexCost,
		`Upgrade datacenter: ${datacenter.name} ${validated.trackLabel} → ${validated.targetNode.label}`,
	);
	const refreshedDatacenter = applyDatacenterUpgrade(getDatacenter(debitedState, dcId), trackId, targetNodeId);
	return replaceDatacenter(debitedState, refreshedDatacenter);
}

function cancelContract(state: GameState, contractId: ContractId): GameState {
	const contracts = contractsFromState(state);
	const contract = contracts.find((candidate) => candidate.id === contractId);
	if (!contract) {
		throw new Error(`Unknown active contract: ${contractId}`);
	}

	if (!isLiveContract(contract)) {
		throw new Error(`Contract cannot be cancelled from lifecycle state: ${contract.lifecycleState}`);
	}

	return withDerivedContractViews({
		...state,
		contracts: contracts.map((candidate) =>
			candidate.id === contractId
				? {
						...candidate,
						lifecycleState: "cancelled",
						status: "cancelled",
						closedAtTick: state.tick,
				  }
				: candidate,
		),
	});
}

function linkRegionalFabric(state: GameState, sourceDcId: DatacenterId, targetDcId: DatacenterId): GameState {
	const validated = validateFabricLinkRequest(state, sourceDcId, targetDcId);
	const debitedState = applyCapex(
		state,
		validated.capexCost,
		validated.mode === "bootstrap"
			? `Create regional fabric: ${validated.sourceDc.name} ↔ ${validated.targetDc.name}`
			: `Join regional fabric: ${validated.sourceDc.name} ↔ ${validated.targetDc.name}`,
	);

	return {
		...debitedState,
		map: {
			...debitedState.map,
			regions: debitedState.map.regions.map((region) =>
				region.id === validated.regionId ? applyValidatedFabricLink(region, validated) : region,
			),
		},
	};
}

function clampMaintenanceStaff(maintenanceStaff: number): number {
	return Math.max(0, Math.min(MAX_MAINTENANCE_STAFF, maintenanceStaff));
}

function setMaintenanceStaff(state: GameState, dcId: DatacenterId, maintenanceStaff: number): GameState {
	if (!Number.isFinite(maintenanceStaff) || !Number.isInteger(maintenanceStaff)) {
		throw new Error(`Invalid maintenance staff: ${maintenanceStaff}`);
	}

	const datacenter = getDatacenter(state, dcId);
	const nextMaintenanceStaff = clampMaintenanceStaff(maintenanceStaff);
	const delta = nextMaintenanceStaff - datacenter.maintenanceStaff;
	if (delta === 0) {
		return replaceDatacenter(state, {
			...datacenter,
			maintenanceStaff: nextMaintenanceStaff,
		});
	}

	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) {
		throw new Error(`Unknown region: ${datacenter.regionId}`);
	}

	if (delta > 0 && region.staffUsed + delta > region.totalStaffAvailable) {
		throw new Error(`Insufficient staff available in region: ${region.id}`);
	}

	const updatedRegions = state.map.regions.map((candidate) =>
		candidate.id === region.id
			? {
					...candidate,
					staffUsed: candidate.staffUsed + delta,
				}
			: candidate,
	);

	return {
		...replaceDatacenter(state, {
			...datacenter,
			maintenanceStaff: nextMaintenanceStaff,
		}),
		map: {
			...state.map,
			regions: updatedRegions,
		},
	};
}

function assertNever(value: never): never {
	throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}

export function reduce(state: GameState, action: Action): GameState {
	switch (action.type) {
		case "BuildDatacenter":
			return buildDatacenter(state, action.specId, action.dcId, action.regionId);
		case "PlaceRack":
			return placeRack(state, action.dcId, action.specId, action.row, action.position, action.placementId);
		case "RemoveRack":
			return removeRack(state, action.dcId, action.placementId);
		case "MoveRack":
			return moveRack(state, action.dcId, action.placementId, action.targetDcId, action.row, action.position);
		case "AcceptContract":
			return acceptContract(state, action.contractId, action.dcId);
		case "CancelContract":
			return cancelContract(state, action.contractId);
		case "FabricLink":
			return linkRegionalFabric(state, action.sourceDcId, action.targetDcId);
		case "UpgradeDatacenter":
			return upgradeDatacenter(state, action.dcId, action.trackId, action.targetNodeId);
		case "SetMaintenanceStaff":
			return setMaintenanceStaff(state, action.dcId, action.maintenanceStaff);
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
		case "Subtick":
			return advanceSubtick(state);
		case "Tick":
			return tick(state);
		default:
			return assertNever(action);
	}
}
