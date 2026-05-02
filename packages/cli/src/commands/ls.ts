import type { DatacenterSpec, RackSpec } from "@datacenter-tycoon/game-logic";

import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import type {
	CatalogResult,
	DatacenterListItem,
	ListResult,
	QueryParams,
	QueryResult,
	RackListItem,
} from "../protocol/messages.js";
import {
	formatJsonResult,
	requirePositional,
	withClient,
	writeCommandResult,
	type CommandClient,
	type CommandClientFactory,
} from "./common.js";

function formatTable(headers: string[], rows: string[][]): string {
	const widths = headers.map((header, index) => {
		const cellWidths = rows.map((row) => row[index]?.length ?? 0);
		return Math.max(header.length, ...cellWidths);
	});

	const formatRow = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join("  ");
	return [formatRow(headers), formatRow(widths.map((width) => "-".repeat(width))), ...rows.map(formatRow)].join("\n");
}

function isRackListItem(item: RackListItem | RackSpec): item is RackListItem {
	return "placementId" in item;
}

function isDatacenterListItem(item: DatacenterListItem | DatacenterSpec): item is DatacenterListItem {
	return "datacenter" in item;
}

function formatRackRows(items: RackListItem[] | RackSpec[]): string {
	if (items.every(isRackListItem)) {
		return formatTable(
			["placement", "dc", "row", "position", "spec", "kind", "installed"],
			items.map((item) => [
				item.placementId,
				item.dcId,
				String(item.row),
				String(item.position),
				item.spec.id,
				item.spec.kind,
				String(item.installedAtTick),
			]),
		);
	}

	return formatTable(
		["id", "name", "kind", "tier", "vcpu", "ram", "storage", "gpu", "capex"],
		items.map((item) => [
			item.id,
			item.name,
			item.kind,
			String(item.tier),
			String(item.vCpu),
			String(item.ramGb),
			String(item.storageTb),
			String(item.gpuFlops),
			String(item.capexCost),
		]),
	);
}

function formatDatacenterRows(items: DatacenterListItem[] | DatacenterSpec[]): string {
	if (items.every(isDatacenterListItem)) {
		return formatTable(
			["id", "name", "slots", "power", "cooling", "bandwidth", "vcpu", "ram", "storage", "gpu"],
			items.map((item) => [
				item.datacenter.id,
				item.datacenter.name,
				`${item.slotsUsed}/${item.totalSlots}`,
				`${item.powerKw}/${item.powerCapacityKw}kW`,
				`${item.heatOutputBtuPerHr}/${item.coolingCapacityBtuPerHr} BTU/h`,
				`${item.bandwidthGbps}/${item.bandwidthCapacityGbps} Gbps`,
				String(item.capacity.vCpu),
				String(item.capacity.ramGb),
				String(item.capacity.storageTb),
				String(item.capacity.gpuFlops),
			]),
		);
	}

	return formatTable(
		["id", "name", "rows", "positions", "power", "cooling", "bandwidth", "capex"],
		items.map((item) => [
			item.id,
			item.name,
			String(item.rows),
			String(item.positionsPerRow),
			String(item.powerCapacityKw),
			String(item.coolingCapacityBtuPerHr),
			String(item.bandwidthGbps),
			String(item.capexCost),
		]),
	);
}

export function formatListResult(result: ListResult | CatalogResult): string {
	if (result.kind === "market-contracts" || result.kind === "active-contracts") {
		return formatTable(
			["id", "name", "payment", "penalty", "term", "dc", "status"],
			result.items.map((item) => [
				item.id,
				item.name,
				String(item.monthlyPayment),
				String(item.penaltyPerMonth),
				String(item.termMonths),
				item.assignedDcId ?? "-",
				item.status,
			]),
		);
	}

	if (result.kind === "racks") {
		return formatRackRows(result.items);
	}

	return formatDatacenterRows(result.items);
}

function getListQuery(parsed: ParsedArgv): QueryParams {
	const target = requirePositional(parsed, 0, "dct ls <dc|racks|market|active|catalog> [...args]");
	if (target === "dc") {
		return { kind: "list", target: "datacenters" };
	}
	if (target === "racks") {
		return { kind: "list", target: "racks", dcId: requirePositional(parsed, 1, "dct ls racks <dcId>") };
	}
	if (target === "market") {
		return { kind: "list", target: "market-contracts" };
	}
	if (target === "active") {
		return { kind: "list", target: "active-contracts" };
	}
	if (target === "catalog") {
		const catalogTarget = requirePositional(parsed, 1, "dct ls catalog <dc|rack>");
		if (catalogTarget === "dc") {
			return { kind: "catalog", target: "datacenters" };
		}
		if (catalogTarget === "rack") {
			return { kind: "catalog", target: "racks" };
		}
	}

	throw new Error(`Unsupported ls target: ${target}`);
}

export async function runLsCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const query = getListQuery(parsed);
	const result = (await withClient(
		parsed,
		async (client: CommandClient) => await client.query(query),
		clientFactory,
	)) as QueryResult;

	if (parsed.flags["--json"] === true) {
		console.log(formatJsonResult(result));
		return;
	}

	writeCommandResult(parsed, formatListResult(result as ListResult | CatalogResult));
}
