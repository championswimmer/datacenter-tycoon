import type { DatacenterSpec, DatacenterSpecId } from "../types.js";

const datacenterSpecId = (value: string): DatacenterSpecId => value as DatacenterSpecId;

export const DATACENTER_CATALOG: Record<string, DatacenterSpec> = {
	garage: {
		id: datacenterSpecId("garage"),
		name: "Garage Datacenter",
		rows: 2,
		positionsPerRow: 4,
		powerCapacityKw: 60,
		coolingCapacityBtuPerHr: 120_000,
		coolingType: "air",
		networkType: "cat6",
		bandwidthGbps: 80,
		capexCost: 250_000,
		staffCount: 1,
	},
	warehouse: {
		id: datacenterSpecId("warehouse"),
		name: "Warehouse Datacenter",
		rows: 4,
		positionsPerRow: 10,
		powerCapacityKw: 320,
		coolingCapacityBtuPerHr: 520_000,
		coolingType: "air",
		networkType: "cat8",
		bandwidthGbps: 400,
		capexCost: 1_400_000,
		staffCount: 4,
	},
	hyperscale: {
		id: datacenterSpecId("hyperscale"),
		name: "Hyperscale Campus",
		rows: 8,
		positionsPerRow: 25,
		powerCapacityKw: 2_500,
		coolingCapacityBtuPerHr: 10_500_000,
		coolingType: "liquid",
		networkType: "fiber",
		bandwidthGbps: 5_000,
		capexCost: 18_000_000,
		staffCount: 45,
	},
};
