import type { DatacenterSpec, DatacenterSpecId } from "../types.js";

const datacenterSpecId = (value: string): DatacenterSpecId => value as DatacenterSpecId;

export const DATACENTER_CATALOG: Record<string, DatacenterSpec> = {
	garage: {
		id: datacenterSpecId("garage"),
		name: "Garage Datacenter",
		rows: 2,
		positionsPerRow: 4,
		powerCapacityKw: 60,
		coolingCapacityBtuPerHr: 96_000,
		coolingType: "air",
		bandwidthGbps: 80,
		capexCost: 250_000,
		monthlyStaffCost: 12_000,
	},
	warehouse: {
		id: datacenterSpecId("warehouse"),
		name: "Warehouse Datacenter",
		rows: 4,
		positionsPerRow: 10,
		powerCapacityKw: 320,
		coolingCapacityBtuPerHr: 400_000,
		coolingType: "air",
		bandwidthGbps: 400,
		capexCost: 1_400_000,
		monthlyStaffCost: 55_000,
	},
	hyperscale: {
		id: datacenterSpecId("hyperscale"),
		name: "Hyperscale Campus",
		rows: 8,
		positionsPerRow: 25,
		powerCapacityKw: 2_500,
		coolingCapacityBtuPerHr: 8_500_000,
		coolingType: "liquid",
		bandwidthGbps: 5_000,
		capexCost: 18_000_000,
		monthlyStaffCost: 350_000,
	},
};
