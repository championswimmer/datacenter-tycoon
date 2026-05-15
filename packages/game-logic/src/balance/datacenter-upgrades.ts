import type {
	CoolingType,
	DatacenterNetworkType,
	DatacenterUpgradeTrackId,
	DatacenterUpgradeTrackPresentation,
} from "../types.js";

export interface DatacenterUpgradeBalanceNode {
	id: string;
	label: string;
	capexCost: number;
	fixedMonthlyOpex?: number;
	infrastructure: {
		coolingType?: CoolingType;
		coolingCapacityBtuPerHr?: number;
		networkType?: DatacenterNetworkType;
		bandwidthGbps?: number;
		onsiteGenerationCapacityKw?: number;
	};
}

export interface DatacenterUpgradeTrackBalance {
	label: string;
	presentation: DatacenterUpgradeTrackPresentation;
	nodes: readonly DatacenterUpgradeBalanceNode[];
}

export interface DatacenterUpgradeBlueprintBalance {
	tracks: Record<DatacenterUpgradeTrackId, DatacenterUpgradeTrackBalance>;
}

/**
 * Topology notes:
 * - `tracks.*.nodes[].id` defines the legal monotonic progression path for a blueprint.
 * - The number of generator nodes determines each blueprint's generator-slot cap.
 *
 * Balance notes:
 * - `capexCost`, `fixedMonthlyOpex`, and numeric infrastructure deltas are the tuneable knobs.
 * - Reducers, selectors, CLI, and web must consume catalog/resolver outputs rather than hardcoding any of these values.
 */
export const DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE: DatacenterNetworkType = "fiber";

export const DATACENTER_UPGRADE_BALANCE: Record<string, DatacenterUpgradeBlueprintBalance> = {
	garage: {
		tracks: {
			cooling: {
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					{
						id: "air",
						label: "Air cooling",
						capexCost: 0,
						infrastructure: { coolingType: "air", coolingCapacityBtuPerHr: 120_000 },
					},
					{
						id: "hybrid",
						label: "Hybrid cooling",
						capexCost: 180_000,
						fixedMonthlyOpex: 900,
						infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 250_000 },
					},
				],
			},
			networkType: {
				label: "Network uplink",
				presentation: "level",
				nodes: [
					{
						id: "cat6",
						label: "Cat6 uplink",
						capexCost: 0,
						infrastructure: { networkType: "cat6", bandwidthGbps: 80 },
					},
					{
						id: "cat8",
						label: "Cat8 uplink",
						capexCost: 75_000,
						fixedMonthlyOpex: 350,
						infrastructure: { networkType: "cat8", bandwidthGbps: 160 },
					},
					{
						id: "fiber",
						label: "Fiber uplink",
						capexCost: 180_000,
						fixedMonthlyOpex: 1_250,
						infrastructure: { networkType: "fiber", bandwidthGbps: 320 },
					},
				],
			},
			onsiteGeneration: {
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					{
						id: "gen-0",
						label: "0 generators installed",
						capexCost: 0,
						infrastructure: { onsiteGenerationCapacityKw: 0 },
					},
					{
						id: "gen-1",
						label: "1 generator installed",
						capexCost: 120_000,
						fixedMonthlyOpex: 1_600,
						infrastructure: { onsiteGenerationCapacityKw: 25 },
					},
				],
			},
		},
	},
	warehouse: {
		tracks: {
			cooling: {
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					{
						id: "air",
						label: "Air cooling",
						capexCost: 0,
						infrastructure: { coolingType: "air", coolingCapacityBtuPerHr: 520_000 },
					},
					{
						id: "hybrid",
						label: "Hybrid cooling",
						capexCost: 360_000,
						fixedMonthlyOpex: 2_200,
						infrastructure: { coolingType: "hybrid", coolingCapacityBtuPerHr: 900_000 },
					},
					{
						id: "liquid",
						label: "Liquid cooling",
						capexCost: 840_000,
						fixedMonthlyOpex: 5_200,
						infrastructure: { coolingType: "liquid", coolingCapacityBtuPerHr: 1_400_000 },
					},
				],
			},
			networkType: {
				label: "Network uplink",
				presentation: "level",
				nodes: [
					{
						id: "cat8",
						label: "Cat8 uplink",
						capexCost: 0,
						infrastructure: { networkType: "cat8", bandwidthGbps: 400 },
					},
					{
						id: "fiber",
						label: "Fiber uplink",
						capexCost: 275_000,
						fixedMonthlyOpex: 2_000,
						infrastructure: { networkType: "fiber", bandwidthGbps: 1_000 },
					},
				],
			},
			onsiteGeneration: {
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					{
						id: "gen-0",
						label: "0 generators installed",
						capexCost: 0,
						infrastructure: { onsiteGenerationCapacityKw: 0 },
					},
					{
						id: "gen-1",
						label: "1 generator installed",
						capexCost: 450_000,
						fixedMonthlyOpex: 3_800,
						infrastructure: { onsiteGenerationCapacityKw: 80 },
					},
					{
						id: "gen-2",
						label: "2 generators installed",
						capexCost: 900_000,
						fixedMonthlyOpex: 7_600,
						infrastructure: { onsiteGenerationCapacityKw: 160 },
					},
				],
			},
		},
	},
	hyperscale: {
		tracks: {
			cooling: {
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					{
						id: "liquid",
						label: "Liquid cooling",
						capexCost: 0,
						infrastructure: { coolingType: "liquid", coolingCapacityBtuPerHr: 10_500_000 },
					},
				],
			},
			networkType: {
				label: "Network uplink",
				presentation: "level",
				nodes: [
					{
						id: "fiber",
						label: "Fiber uplink",
						capexCost: 0,
						infrastructure: { networkType: "fiber", bandwidthGbps: 5_000 },
					},
				],
			},
			onsiteGeneration: {
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					{
						id: "gen-0",
						label: "0 generators installed",
						capexCost: 0,
						infrastructure: { onsiteGenerationCapacityKw: 0 },
					},
					{
						id: "gen-1",
						label: "1 generator installed",
						capexCost: 1_800_000,
						fixedMonthlyOpex: 16_000,
						infrastructure: { onsiteGenerationCapacityKw: 400 },
					},
					{
						id: "gen-2",
						label: "2 generators installed",
						capexCost: 3_600_000,
						fixedMonthlyOpex: 32_000,
						infrastructure: { onsiteGenerationCapacityKw: 800 },
					},
					{
						id: "gen-3",
						label: "3 generators installed",
						capexCost: 5_400_000,
						fixedMonthlyOpex: 48_000,
						infrastructure: { onsiteGenerationCapacityKw: 1_200 },
					},
					{
						id: "gen-4",
						label: "4 generators installed",
						capexCost: 7_200_000,
						fixedMonthlyOpex: 64_000,
						infrastructure: { onsiteGenerationCapacityKw: 1_600 },
					},
				],
			},
		},
	},
};
