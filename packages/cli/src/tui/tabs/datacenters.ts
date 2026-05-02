import type { GameState } from "@datacenter-tycoon/game-logic";

export function renderDatacentersTab(snapshot: GameState, selectedIndex: number): string[] {
	if (snapshot.datacenters.length === 0) {
		return ["Datacenters", "", "No datacenters yet.", "Use :build-dc <specId> or press n later to create one."];
	}

	const selected = snapshot.datacenters[Math.max(0, Math.min(selectedIndex, snapshot.datacenters.length - 1))];
	if (!selected) {
		return ["Datacenters", "", "No datacenters yet."];
	}
	const placementsByCell = new Map(selected.placements.map((placement) => [`${placement.row}:${placement.position}`, placement.specId]));
	const rows: string[] = [];
	for (let row = 0; row < selected.spec.rows; row += 1) {
		const cells: string[] = [];
		for (let position = 0; position < selected.spec.positionsPerRow; position += 1) {
			const specId = placementsByCell.get(`${row}:${position}`);
			cells.push(specId ? `[${specId.padEnd(2)}]` : `[  ]`);
		}
		rows.push(`r${row}: ${cells.join(" ")}`);
	}

	return [
		`Datacenters (${snapshot.datacenters.length})`,
		"",
		...snapshot.datacenters.map((datacenter, index) => `${index === selectedIndex ? ">" : " "} ${datacenter.id}  ${datacenter.name}  racks ${datacenter.placements.length}`),
		"",
		`Selected: ${selected.id} · ${selected.name}`,
		`Power ${selected.spec.powerCapacityKw}kW · Cooling ${selected.spec.coolingCapacityBtuPerHr} BTU/h · Bandwidth ${selected.spec.bandwidthGbps} Gbps`,
		"Rack grid:",
		...rows,
	];
}
