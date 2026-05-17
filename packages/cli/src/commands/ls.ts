import fs from "node:fs";
import path from "node:path";

import { deserialize, REGION_CATALOG } from "@datacenter-tycoon/game-logic";

import type { ParsedArgv } from "../argv.js";
import { DctClient } from "../client/client.js";
import type {
	CatalogResult,
	DatacenterListItem,
	ListResult,
	RackListItem,
} from "../protocol/messages.js";
import type { DatacenterSpec } from "@datacenter-tycoon/game-logic";
import {
	hasBooleanFlag,
	resolveCommandPaths,
	withClient,
	writeCommandResult,
	type CommandClientFactory,
} from "./common.js";
import { formatContractRegionAffinity, formatContractRequirements, presentContracts } from "./contracts-view.js";

export async function runLsCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const subCommand = parsed.positionals[0];

	if (subCommand === "saves") {
		await listSaves(parsed);
	} else if (subCommand === "contracts") {
		await listContracts(parsed, clientFactory);
	} else if (subCommand === "datacenters" || subCommand === "dcs") {
		await listDatacenters(parsed, clientFactory);
	} else if (subCommand === "racks") {
		await listRacks(parsed, clientFactory);
	} else if (subCommand === "catalog") {
		await listCatalog(parsed, clientFactory);
	} else {
		throw new Error(
			"Usage: dct ls <subcommand>\n\nSubcommands:\n" +
				"  saves          List save files\n" +
				"  contracts      List market and active contracts\n" +
				"  datacenters    List built datacenters\n" +
				"  racks <dcId>   List racks in a datacenter\n" +
				"  catalog        List all rack and datacenter specs",
		);
	}
}

function formatDatacenterLayout(spec: Pick<DatacenterSpec, "rows" | "positionsPerRow">): string {
	const slots = spec.rows * spec.positionsPerRow;
	return `${spec.rows} rows × ${spec.positionsPerRow} cols (${slots} slots)`;
}

function formatRegionLabel(regionId: string): string {
	const region = REGION_CATALOG[regionId] ?? Object.values(REGION_CATALOG).find((entry) => entry.id === regionId);
	if (!region) {
		return regionId;
	}

	return `${region.code} · ${region.city} · ${region.name}`;
}

async function listSaves(parsed: ParsedArgv): Promise<void> {
	const paths = resolveCommandPaths(parsed);
	const dataDir = paths.dataDir;

	if (!fs.existsSync(dataDir)) {
		writeCommandResult(parsed, "No saves found (data directory does not exist).", { saves: [] });
		return;
	}

	const files = fs.readdirSync(dataDir).filter((file) => file.endsWith(".json"));
	const saves = [];

	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dataDir, file), "utf8");
			const state = deserialize(content);
			saves.push({
				file,
				gameId: state.gameId,
				tick: state.tick,
				cash: state.player.cash,
				playerName: state.player.name,
			});
		} catch {
			// Skip invalid saves
		}
	}

	const table = saves
		.map((save) => {
			return `${save.file.padEnd(40)} | Tick: ${String(save.tick).padStart(6)} | Cash: $${String(save.cash).padStart(10)} | ${save.playerName}`;
		})
		.join("\n");

	writeCommandResult(parsed, saves.length > 0 ? `Available Saves:\n${table}` : "No valid saves found.", { saves });
}

async function listContracts(parsed: ParsedArgv, clientFactory: CommandClientFactory): Promise<void> {
	const isJson = hasBooleanFlag(parsed, "--json");

	await withClient(
		parsed,
		async (client) => {
			const result = (await client.query({ kind: "list", target: "contracts" })) as ListResult;
			if (result.kind !== "contracts") {
				throw new Error("Unexpected contracts payload from daemon");
			}

			const market = presentContracts(result.market, "market");
			const active = presentContracts(result.active, "active");
			const history = presentContracts(result.history, "history");

			if (isJson) {
				writeCommandResult(parsed, "", { market, active, history });
				return;
			}

			const lines: string[] = [];

			if (market.length > 0) {
				lines.push("=== Market Contracts ===");
				for (const contract of market) {
					lines.push(`  [${contract.id}]`);
					lines.push(
						`    ${contract.name} | $${contract.monthlyPayment.toLocaleString()}/mo | ${contract.termMonths}mo | ${contract.urgency} | Tier ${contract.tier} | Expires tick ${contract.expiresAtTick}`,
					);
					lines.push(`    Reqs: ${formatContractRequirements(contract)}`);
					lines.push(`    Regions: ${formatContractRegionAffinity(contract)}`);
					lines.push(`    Penalty: $${contract.penaltyPerMonth.toLocaleString()}/mo`);
				}
			} else {
				lines.push("No contracts available in market.");
			}

			lines.push("");

			if (active.length > 0) {
				lines.push("=== Active Contracts ===");
				for (const contract of active) {
					lines.push(`  [${contract.id}]`);
					lines.push(
						`    ${contract.name} | $${contract.monthlyPayment.toLocaleString()}/mo | DC: ${contract.assignedDcId ?? "unassigned"} | Tier ${contract.tier}`,
					);
					lines.push(`    Reqs: ${formatContractRequirements(contract)}`);
					lines.push(`    Regions: ${formatContractRegionAffinity(contract)}`);
				}
			} else {
				lines.push("No active contracts.");
			}

			if (history.length > 0) {
				lines.push("");
				lines.push("=== Contract History ===");
				for (const contract of history) {
					lines.push(`  [${contract.id}]`);
					lines.push(
						`    ${contract.name} | ${contract.status.toUpperCase()} | DC: ${contract.assignedDcId ?? "unassigned"} | Tier ${contract.tier}`,
					);
					lines.push(`    Regions: ${formatContractRegionAffinity(contract)}`);
				}
			}

			writeCommandResult(parsed, lines.join("\n"), { market, active, history });
		},
		clientFactory,
	);
}

async function listDatacenters(parsed: ParsedArgv, clientFactory: CommandClientFactory): Promise<void> {
	const isJson = hasBooleanFlag(parsed, "--json");

	await withClient(
		parsed,
		async (client) => {
			const result = (await client.query({
				kind: "list",
				target: "datacenters",
			})) as ListResult;

			const items = result.kind === "datacenters" ? (result.items as DatacenterListItem[]) : [];

			if (isJson) {
				writeCommandResult(parsed, "", { datacenters: items });
				return;
			}

			if (items.length === 0) {
				writeCommandResult(parsed, "No datacenters built yet. Use 'dct dc build' to get started.", {
					datacenters: [],
				});
				return;
			}

			const lines: string[] = ["=== Datacenters ==="];
			for (const item of items) {
				const dc = item.datacenter;
				const m = item.maintenance;
				const riskLabel = m.canIncrease
					? `Spare regional staff: ${m.availableRegionalStaff}`
					: m.currentStaff >= m.maxStaff
						? "AT STAFF CAP"
						: "REGIONAL LABOR FULL";
				lines.push(
					`  ${dc.id} | ${dc.spec.id} | Region: ${formatRegionLabel(dc.regionId)} | Slots: ${item.slotsUsed}/${item.totalSlots} | Layout: ${formatDatacenterLayout(dc.spec)}`,
				);
				lines.push(
					`    Bounds: rows 0-${dc.spec.rows - 1}, cols 0-${dc.spec.positionsPerRow - 1} | Power: ${item.powerKw.toFixed(1)}/${item.powerCapacityKw}kW | Cooling: ${Math.round(item.heatOutputBtuPerHr)}/${item.coolingCapacityBtuPerHr} BTU/hr | BW: ${item.bandwidthGbps}/${item.bandwidthCapacityGbps}Gbps`,
				);
				lines.push(
					`    Infra: grid ${item.infrastructure.effective.gridImportCapacityKw}kW + onsite ${item.infrastructure.effective.onsiteGenerationCapacityKw}kW | Cooling mode ${item.infrastructure.effective.coolingType} | Network ${item.infrastructure.effective.networkType} | Fabric ${item.upgrades.fabricEligible ? "READY" : "NOT READY"}`,
				);
				lines.push(
					`    Upgrades: cooling ${item.upgrades.tracks.find((track) => track.trackId === "cooling")?.currentNode.label ?? "n/a"} | network ${item.upgrades.tracks.find((track) => track.trackId === "networkType")?.currentNode.label ?? "n/a"} | generators ${item.upgrades.tracks.find((track) => track.trackId === "onsiteGeneration")?.currentNode.label ?? "n/a"}`,
				);
				lines.push(
					`    Capacity: installed ${formatContractRequirements({ requirements: item.capacitySummary.installed })} | committed ${formatContractRequirements({ requirements: item.capacitySummary.committed })} | available ${formatContractRequirements({ requirements: item.capacitySummary.available })}`,
				);
				lines.push(
					`    Maintenance: ${m.currentStaff} staff | +$${m.extraWagesMonthly.toLocaleString()}/mo | Repair speed ${m.repairSpeedDaysPerTick.toFixed(1)} days/tick | Repairing ${m.repairingRackCount}/${m.totalRackCount} racks | ${riskLabel}`,
				);
			}

			writeCommandResult(parsed, lines.join("\n"), { datacenters: items });
		},
		clientFactory,
	);
}

async function listRacks(parsed: ParsedArgv, clientFactory: CommandClientFactory): Promise<void> {
	const dcId = parsed.positionals[1];
	const isJson = hasBooleanFlag(parsed, "--json");

	if (!dcId) {
		throw new Error("Usage: dct ls racks <dcId>");
	}

	await withClient(
		parsed,
		async (client) => {
			const result = (await client.query({
				kind: "list",
				target: "racks",
				dcId,
			})) as ListResult;

			const items = result.kind === "racks" ? (result.items as RackListItem[]) : [];

			if (isJson) {
				writeCommandResult(parsed, "", { dcId, racks: items });
				return;
			}

			if (items.length === 0) {
				writeCommandResult(parsed, `No racks in datacenter ${dcId}.`, { dcId, racks: [] });
				return;
			}

			const lines: string[] = [`=== Racks in ${dcId} ===`];
			for (const item of items) {
				const healthLabel = item.health === "repairing" ? "REPAIRING" : "HEALTHY";
				const riskLabel = item.health === "repairing"
					? "UNDER REPAIR"
					: `${(item.failureProbability * 100).toFixed(1)}%/mo`;
				lines.push(
					`  ${item.placementId} | ${item.spec.id} (${item.spec.kind} T${item.spec.tier}) | Row ${item.row}, Pos ${item.position} | Installed: tick ${item.installedAtTick}`,
				);
				lines.push(
					`    Health: ${healthLabel} | Fail risk: ${riskLabel} | Age: ${item.ageMonths} mo`,
				);
				lines.push(
					`    vCPU=${item.spec.vCpu}, RAM=${item.spec.ramGb}GB, Storage=${item.spec.storageTb}TB, GPU=${item.spec.gpuFlops} | Power: ${item.spec.powerDrawKw}kW`,
				);
			}

			writeCommandResult(parsed, lines.join("\n"), { dcId, racks: items });
		},
		clientFactory,
	);
}

async function listCatalog(parsed: ParsedArgv, clientFactory: CommandClientFactory): Promise<void> {
	const isJson = hasBooleanFlag(parsed, "--json");

	await withClient(
		parsed,
		async (client) => {
			const rackResult = (await client.query({
				kind: "catalog",
				target: "racks",
			})) as CatalogResult;
			const dcResult = (await client.query({
				kind: "catalog",
				target: "datacenters",
			})) as CatalogResult;

			const racks = rackResult.kind === "racks" ? rackResult.items : [];
			const dcs = dcResult.kind === "datacenters" ? dcResult.items : [];

			if (isJson) {
				writeCommandResult(parsed, "", { racks, datacenters: dcs });
				return;
			}

			const lines: string[] = ["=== Rack Specs ==="];
			lines.push(
				"  ID   | Kind     | Tier | vCPU | RAM(GB) | Storage(TB) | GPU   | Power(kW) | Capex($)    | Maint/mo($)",
			);
			lines.push("  " + "-".repeat(100));
			for (const rack of racks) {
				lines.push(
					`  ${rack.id.padEnd(4)} | ${rack.kind.padEnd(8)} | T${rack.tier}   | ${String(rack.vCpu).padStart(4)} | ${String(rack.ramGb).padStart(7)} | ${String(rack.storageTb).padStart(11)} | ${String(rack.gpuFlops).padStart(5)} | ${String(rack.powerDrawKw).padStart(9)} | ${String(rack.capexCost).padStart(11)} | ${String(rack.monthlyMaintenance).padStart(11)}`,
				);
			}

			lines.push("");
			lines.push("=== Datacenter Specs ===");
			lines.push(
				"  ID          | Layout                     | Power(kW) | Cooling(BTU)  | BW(Gbps) | Capex($)     | Staff | Cooling",
			);
			lines.push("  " + "-".repeat(123));
			for (const dc of dcs) {
				lines.push(
					`  ${dc.id.padEnd(11)} | ${formatDatacenterLayout(dc).padEnd(26)} | ${String(dc.powerCapacityKw).padStart(9)} | ${String(dc.coolingCapacityBtuPerHr).padStart(13)} | ${String(dc.bandwidthGbps).padStart(8)} | ${String(dc.capexCost).padStart(12)} | ${String(dc.staffCount).padStart(5)} | ${dc.coolingType}`,
				);
			}

			writeCommandResult(parsed, lines.join("\n"), { racks, datacenters: dcs });
		},
		clientFactory,
	);
}
