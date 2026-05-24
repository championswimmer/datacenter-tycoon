import { powerCostForRegion, staffWageForRegion } from "../balance/regional-opex.js";
import type { ContractRegionAffinityKey, Region, RegionId } from "../types.js";

const regionId = (value: string): RegionId => value as RegionId;

function baseRegion(regionKey: string, region: Omit<Region, "id" | "powerCostPerKwh" | "staffWage">): Region {
	return {
		id: regionId(regionKey),
		powerCostPerKwh: powerCostForRegion(regionKey),
		staffWage: staffWageForRegion(regionKey),
		...region,
	};
}

export const CONTRACT_REGION_AFFINITY_REGION_IDS: Record<ContractRegionAffinityKey, readonly RegionId[]> = {
	eu: [regionId("eu_west"), regionId("eu_central")],
	asia: [regionId("ap_northeast"), regionId("ap_southeast")],
	usa: [regionId("us_east"), regionId("us_west")],
};

export const REGION_CATALOG: Record<string, Region> = {
	us_east: baseRegion("us_east", {
		name: "US East",
		code: "IAD",
		city: "Ashburn",
		coordinates: { x: 24, y: 35.5 },
		taxRate: 0.06,
		totalPowerAvailable: 10_000,
		totalStaffAvailable: 800,
		powerUsed: 0,
		staffUsed: 0,
	}),
	us_west: baseRegion("us_west", {
		name: "US West",
		code: "PDX",
		city: "Boardman",
		coordinates: { x: 15, y: 33 },
		taxRate: 0.07,
		totalPowerAvailable: 8_000,
		totalStaffAvailable: 400,
		powerUsed: 0,
		staffUsed: 0,
	}),
	eu_west: baseRegion("eu_west", {
		name: "EU West",
		code: "DUB",
		city: "Dublin",
		coordinates: { x: 44, y: 26 },
		taxRate: 0.125,
		totalPowerAvailable: 5_000,
		totalStaffAvailable: 350,
		powerUsed: 0,
		staffUsed: 0,
	}),
	eu_central: baseRegion("eu_central", {
		name: "EU Central",
		code: "FRA",
		city: "Frankfurt",
		coordinates: { x: 46, y: 29 },
		taxRate: 0.28,
		totalPowerAvailable: 6_000,
		totalStaffAvailable: 450,
		powerUsed: 0,
		staffUsed: 0,
	}),
	ap_northeast: baseRegion("ap_northeast", {
		name: "AP Northeast",
		code: "NRT",
		city: "Tokyo",
		coordinates: { x: 83, y: 36 },
		taxRate: 0.22,
		totalPowerAvailable: 4_500,
		totalStaffAvailable: 400,
		powerUsed: 0,
		staffUsed: 0,
	}),
	ap_southeast: baseRegion("ap_southeast", {
		name: "AP Southeast",
		code: "SIN",
		city: "Singapore",
		coordinates: { x: 75, y: 54 },
		taxRate: 0.17,
		totalPowerAvailable: 4_000,
		totalStaffAvailable: 350,
		powerUsed: 0,
		staffUsed: 0,
	}),
	sa_east: baseRegion("sa_east", {
		name: "SA East",
		code: "GRU",
		city: "São Paulo",
		coordinates: { x: 34.5, y: 65.5 },
		taxRate: 0.34,
		totalPowerAvailable: 3_500,
		totalStaffAvailable: 450,
		powerUsed: 0,
		staffUsed: 0,
	}),
	me_central: baseRegion("me_central", {
		name: "ME Central",
		code: "DXB",
		city: "Dubai",
		coordinates: { x: 61, y: 43 },
		taxRate: 0.09,
		totalPowerAvailable: 5_500,
		totalStaffAvailable: 300,
		powerUsed: 0,
		staffUsed: 0,
	}),
};

export function regionMatchesContractAffinity(regionId: RegionId, affinityKey: ContractRegionAffinityKey): boolean {
	return CONTRACT_REGION_AFFINITY_REGION_IDS[affinityKey].includes(regionId);
}

export function regionIdsForContractAffinity(
	affinityKey: ContractRegionAffinityKey,
	regions: readonly Pick<Region, "id">[] = Object.values(REGION_CATALOG),
): RegionId[] {
	return regions.filter((region) => regionMatchesContractAffinity(region.id, affinityKey)).map((region) => region.id);
}
