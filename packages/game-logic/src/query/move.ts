import { RACK_CATALOG } from "../catalog/racks.js";
import { calculateMoveCost } from "../economy/move.js";
import { canPlaceRack } from "../entities/datacenter.js";
import type {
	Datacenter,
	DatacenterId,
	GameState,
	GridPosition,
	RackPlacement,
	RackPlacementId,
	RegionId,
} from "../types.js";

export interface MoveRackTarget {
	targetDcId: DatacenterId;
	targetRegionId: RegionId;
	availableSlots: number;
	firstAvailableSlot: GridPosition | null;
	moveCost: number;
	sameRegion: boolean;
}

function getDatacenterOrThrow(datacenters: readonly Datacenter[], dcId: DatacenterId): Datacenter {
	const datacenter = datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

function getPlacementOrThrow(datacenter: Datacenter, placementId: RackPlacementId): RackPlacement {
	const placement = datacenter.placements.find((candidate) => candidate.id === placementId);
	if (!placement) {
		throw new Error(`Unknown rack placement: ${placementId}`);
	}

	return placement;
}

function listValidSlots(datacenter: Datacenter, placement: RackPlacement): GridPosition[] {
	const spec = RACK_CATALOG[placement.specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${placement.specId}`);
	}

	const validSlots: GridPosition[] = [];
	for (let row = 0; row < datacenter.spec.rows; row += 1) {
		for (let position = 0; position < datacenter.spec.positionsPerRow; position += 1) {
			const candidatePosition = { row, position };
			const check = canPlaceRack(datacenter, spec, candidatePosition);
			if (check.ok) {
				validSlots.push(candidatePosition);
			}
		}
	}

	return validSlots;
}

export function listRackMoveTargets(
	state: Pick<GameState, "datacenters">,
	sourceDcId: DatacenterId,
	placementId: RackPlacementId,
): MoveRackTarget[] {
	const sourceDatacenter = getDatacenterOrThrow(state.datacenters, sourceDcId);
	const placement = getPlacementOrThrow(sourceDatacenter, placementId);
	const spec = RACK_CATALOG[placement.specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${placement.specId}`);
	}

	return state.datacenters
		.filter((datacenter) => datacenter.id !== sourceDcId)
		.map((targetDatacenter) => {
			const validSlots = listValidSlots(targetDatacenter, placement);
			return {
				targetDcId: targetDatacenter.id,
				targetRegionId: targetDatacenter.regionId,
				availableSlots: validSlots.length,
				firstAvailableSlot: validSlots[0] ?? null,
				moveCost: calculateMoveCost(spec, sourceDatacenter.regionId, targetDatacenter.regionId),
				sameRegion: sourceDatacenter.regionId === targetDatacenter.regionId,
			};
		});
}

export function findRackMoveTarget(
	state: Pick<GameState, "datacenters">,
	sourceDcId: DatacenterId,
	placementId: RackPlacementId,
	targetDcId: DatacenterId,
): MoveRackTarget | undefined {
	return listRackMoveTargets(state, sourceDcId, placementId).find((target) => target.targetDcId === targetDcId);
}
