import type { Money, RegionId } from "../types.js";

export interface RegionalOpexProfile {
	powerMultiplier: number;
	wageMultiplier: number;
	sourceNote: string;
	gameplayNote: string;
}

export const BASE_REGION_OPEX = {
	powerCostPerKwh: 0.08,
	staffWagePerMonth: 6_500 as Money,
} as const;

export const REGIONAL_OPEX_PROFILES = {
	us_east: {
		powerMultiplier: 1,
		wageMultiplier: 1,
		sourceNote: "US East baseline using EIA-backed power references and BLS support-specialist wages.",
		gameplayNote: "Premium labor baseline; benchmark region for multiplier comparisons.",
	},
	us_west: {
		powerMultiplier: 0.8,
		wageMultiplier: 0.95,
		sourceNote: "Pacific Northwest power is typically cheaper than Northern Virginia for large industrial users.",
		gameplayNote: "Slightly cheaper labor and clearly cheaper power than US East.",
	},
	eu_west: {
		powerMultiplier: 2.25,
		wageMultiplier: 0.9,
		sourceNote: "Eurostat and KPMG benchmarks show materially higher electricity costs in Ireland than US regions.",
		gameplayNote: "High power-cost region with labor still below the US gameplay baseline.",
	},
	eu_central: {
		powerMultiplier: 2.13,
		wageMultiplier: 0.92,
		sourceNote: "Germany remains a high-cost European electricity market in 2024 benchmarks.",
		gameplayNote: "Very expensive power and slightly higher labor than EU West.",
	},
	ap_northeast: {
		powerMultiplier: 2,
		wageMultiplier: 0.78,
		sourceNote: "Japan commercial and industrial power remains well above US-East reference pricing.",
		gameplayNote: "High power costs but labor below Europe for the intended gameplay curve.",
	},
	ap_southeast: {
		powerMultiplier: 2.25,
		wageMultiplier: 0.8,
		sourceNote: "Singapore power pricing is comparable to high-cost European markets in available benchmarks.",
		gameplayNote: "Very expensive power, but labor still cheaper than Europe and the US.",
	},
	sa_east: {
		powerMultiplier: 1.63,
		wageMultiplier: 0.35,
		sourceNote: "Brazil power prices sit above the US baseline but below the most expensive EU and AP markets.",
		gameplayNote: "Mid-cost power offset by a notably cheaper labor market.",
	},
	me_central: {
		powerMultiplier: 1.13,
		wageMultiplier: 0.65,
		sourceNote: "Dubai power is relatively competitive compared with Europe and AP while labor is below US levels.",
		gameplayNote: "Near-baseline power with discounted labor.",
	},
} as const satisfies Record<string, RegionalOpexProfile>;

export type RegionalOpexProfileKey = keyof typeof REGIONAL_OPEX_PROFILES;

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function roundPowerCost(value: number): number {
	return Math.round(value * 100) / 100;
}

function regionKey(regionId: RegionId | string): RegionalOpexProfileKey {
	return String(regionId) as RegionalOpexProfileKey;
}

export function getRegionalOpexProfile(regionId: RegionId | string): RegionalOpexProfile {
	const profile = REGIONAL_OPEX_PROFILES[regionKey(regionId)];
	if (!profile) {
		throw new Error(`Unknown regional OpEx profile: ${String(regionId)}`);
	}

	return profile;
}

export function powerCostForRegionProfile(profile: Pick<RegionalOpexProfile, "powerMultiplier">): number {
	return roundPowerCost(BASE_REGION_OPEX.powerCostPerKwh * profile.powerMultiplier);
}

export function staffWageForRegionProfile(profile: Pick<RegionalOpexProfile, "wageMultiplier">): Money {
	return roundMoney(BASE_REGION_OPEX.staffWagePerMonth * profile.wageMultiplier);
}

export function powerCostForRegion(regionId: RegionId | string): number {
	return powerCostForRegionProfile(getRegionalOpexProfile(regionId));
}

export function staffWageForRegion(regionId: RegionId | string): Money {
	return staffWageForRegionProfile(getRegionalOpexProfile(regionId));
}

export function regionalOpexMultiplierLabel(regionId: RegionId | string): string {
	const profile = getRegionalOpexProfile(regionId);
	return `Power ${profile.powerMultiplier.toFixed(2)}x / Labor ${profile.wageMultiplier.toFixed(2)}x`;
}
