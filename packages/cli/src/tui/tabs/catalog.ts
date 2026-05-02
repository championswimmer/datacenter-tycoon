import { DATACENTER_CATALOG, RACK_CATALOG } from "@datacenter-tycoon/game-logic";

export function renderCatalogTab(): string[] {
	return [
		"Catalog",
		"",
		"Datacenters:",
		...Object.values(DATACENTER_CATALOG).map(
			(spec) => `  ${spec.id}  ${spec.name}  rows=${spec.rows}  positions=${spec.positionsPerRow}  capex=$${spec.capexCost}`,
		),
		"",
		"Racks:",
		...Object.values(RACK_CATALOG).map(
			(spec) =>
				`  ${spec.id}  ${spec.name}  kind=${spec.kind}  tier=${spec.tier}  vcpu=${spec.vCpu}  ram=${spec.ramGb}  capex=$${spec.capexCost}`,
		),
	];
}
