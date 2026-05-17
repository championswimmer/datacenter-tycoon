import type { RegionFabric } from "../types.js";

const EMPTY_MEMBER_IDS: RegionFabric["memberDcIds"] = [];

export function createEmptyRegionFabric(): RegionFabric {
	return {
		memberDcIds: [...EMPTY_MEMBER_IDS],
	};
}

export function ensureRegionFabric(fabric?: RegionFabric): RegionFabric {
	return fabric ?? createEmptyRegionFabric();
}

export function hasRegionFabric(fabric?: RegionFabric): boolean {
	return ensureRegionFabric(fabric).memberDcIds.length > 0;
}
