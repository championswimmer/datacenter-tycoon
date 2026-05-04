import type { Money, RackSpec, RegionId } from "../types.js";

export const SAME_REGION_MOVE_COST_PERCENT = 0.10;
export const CROSS_REGION_MOVE_COST_PERCENT = 0.25;

export function calculateMoveCost(
	rackSpec: RackSpec,
	sourceRegionId: RegionId,
	targetRegionId: RegionId,
): Money {
	const percent = sourceRegionId === targetRegionId
		? SAME_REGION_MOVE_COST_PERCENT
		: CROSS_REGION_MOVE_COST_PERCENT;
	return Math.round(rackSpec.capexCost * percent);
}
