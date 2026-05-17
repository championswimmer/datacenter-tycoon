import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";

export function formatRegionLabel(regionId: string): string {
	const region = REGION_CATALOG[regionId] ?? Object.values(REGION_CATALOG).find((entry) => entry.id === regionId);
	if (!region) {
		return regionId;
	}

	return `${region.code} · ${region.city} · ${region.name}`;
}
