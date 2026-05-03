import { REGION_CATALOG } from "../catalog/regions.js";
import type { MapState, Region } from "../types.js";
import { createRng } from "./rng.js";

const POWER_COST_VARIATION = 0.1; // ±10%
const STAFF_WAGE_VARIATION = 0.05; // ±5%

function cloneRegion(region: Region): Region {
	return { ...region };
}

function applyVariation(base: number, variation: number, rng: { next: () => number }): number {
	const delta = (rng.next() * 2 - 1) * variation;
	return Math.round(base * (1 + delta) * 100) / 100;
}

export function generateMap(seed: number): MapState {
	const rng = createRng(seed);

	const regions = Object.values(REGION_CATALOG).map((region) => {
		const cloned = cloneRegion(region);
		cloned.powerCostPerKwh = applyVariation(region.powerCostPerKwh, POWER_COST_VARIATION, rng);
		cloned.staffWage = Math.round(applyVariation(region.staffWage, STAFF_WAGE_VARIATION, rng));
		return cloned;
	});

	return { regions };
}
