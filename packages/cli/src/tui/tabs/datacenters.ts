import {
	datacenterMaintenanceStaffingView,
	summarizeDatacenterInfrastructureFromState,
	summarizeDatacenterUpgradeViewFromState,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";

export function renderDatacentersTab(snapshot: GameState, selectedIndex: number): string[] {
	if (snapshot.datacenters.length === 0) {
		return ["Datacenters", "", "No datacenters yet.", "Use :dc build <specId> or press n later to create one."];
	}

	const selected = snapshot.datacenters[Math.max(0, Math.min(selectedIndex, snapshot.datacenters.length - 1))];
	if (!selected) {
		return ["Datacenters", "", "No datacenters yet."];
	}

	const region = snapshot.map.regions.find((r) => r.id === selected.regionId);
	const maintenance = region
		? datacenterMaintenanceStaffingView(selected, region, snapshot.datacenters, snapshot.tick)
		: null;
	const infrastructure = summarizeDatacenterInfrastructureFromState(snapshot, selected.id);
	const upgrades = summarizeDatacenterUpgradeViewFromState(snapshot, selected.id);

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

	const maintLines: string[] = [];
	if (maintenance) {
		const staffLabel = maintenance.canIncrease
			? `Spare: ${maintenance.availableRegionalStaff} regional`
			: maintenance.currentStaff >= maintenance.maxStaff
				? "AT STAFF CAP"
				: "REGIONAL LABOR FULL";
		maintLines.push(
			`Maintenance: ${maintenance.currentStaff}/${maintenance.maxStaff} staff | +$${maintenance.extraWagesMonthly.toLocaleString()}/mo | Repair speed ${maintenance.repairSpeedDaysPerTick.toFixed(1)} days/tick`,
		);
		maintLines.push(
			`Repairing: ${maintenance.repairingRackCount}/${maintenance.totalRackCount} racks | Avg age ${maintenance.averageRackAgeMonths.toFixed(1)} mo | ${staffLabel}`,
		);
	}

	return [
		`Datacenters (${snapshot.datacenters.length})`,
		"",
		...snapshot.datacenters.map((datacenter, index) => `${index === selectedIndex ? ">" : " "} ${datacenter.id}  ${datacenter.name}  racks ${datacenter.placements.length}`),
		"",
		`Selected: ${selected.id} · ${selected.name}`,
		`Power ${infrastructure.effective.rackPowerCapacityKw}kW (${infrastructure.effective.gridImportCapacityKw} grid + ${infrastructure.effective.onsiteGenerationCapacityKw} onsite) · Cooling ${infrastructure.effective.coolingCapacityBtuPerHr} BTU/h (${infrastructure.effective.coolingType}) · Bandwidth ${infrastructure.effective.bandwidthGbps} Gbps (${infrastructure.effective.networkType})`,
		`Fabric ${upgrades.fabricEligible ? "READY" : "NOT READY"} · Upgrade upkeep $${upgrades.fixedMonthlyUpgradeOpex.toLocaleString()}/mo`,
		`Tracks: cooling ${upgrades.tracks.find((track) => track.trackId === "cooling")?.currentNode.id ?? "n/a"} · network ${upgrades.tracks.find((track) => track.trackId === "networkType")?.currentNode.id ?? "n/a"} · gen ${upgrades.tracks.find((track) => track.trackId === "onsiteGeneration")?.currentNode.id ?? "n/a"}`,
		...maintLines,
		"Rack grid:",
		...rows,
		"",
		"m move rack · n new DC · r add rack · x remove rack · + hire maint · - fire maint",
	];
}
