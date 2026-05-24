import { DATACENTER_CATALOG, RACK_CATALOG, REGION_CATALOG } from "@datacenter-tycoon/game-logic";

const rackKindOrder = {
	compute: 0,
	memory: 1,
	storage: 2,
	gpu: 3,
} as const;

export function renderCatalogTab(): string[] {
	const sortedRacks = Object.values(RACK_CATALOG).sort((a, b) => {
		if (a.kind !== b.kind) {
			return rackKindOrder[a.kind] - rackKindOrder[b.kind];
		}
		return a.tier - b.tier;
	});

	return [
		"Catalog",
		"",
		"Regions:",
		...Object.values(REGION_CATALOG).map(
			(region) => `  ${region.code}  ${region.city.padEnd(10)} ${region.name.padEnd(12)} power=$${region.powerCostPerKwh.toFixed(3)}/kWh  labor=$${region.staffWage.toLocaleString()}/mo`,
		),
		"",
		"Datacenters:",
		...Object.values(DATACENTER_CATALOG).map(
			(spec) => `  ${spec.id}  ${spec.name}  rows=${spec.rows}  positions=${spec.positionsPerRow}  capex=$${spec.capexCost}`,
		),
		"",
		"Racks:",
		...sortedRacks.map(
			(spec) =>
				`  ${spec.id}  ${spec.name}  kind=${spec.kind}  tier=${spec.tier}  vcpu=${spec.vCpu}  ram=${spec.ramGb}  capex=$${spec.capexCost}`,
		),
	];
}
