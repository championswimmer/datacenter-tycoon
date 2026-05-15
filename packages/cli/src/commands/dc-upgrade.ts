import type { DatacenterId, DatacenterUpgradeTrackId } from "@datacenter-tycoon/game-logic";
import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import type { DatacenterListItem, ListResult } from "../protocol/messages.js";
import {
	hasBooleanFlag,
	requirePositional,
	withClient,
	writeCommandResult,
	type CommandClient,
	type CommandClientFactory,
} from "./common.js";

function datacenterId(value: string): DatacenterId {
	return value as DatacenterId;
}

function trackId(value: string): DatacenterUpgradeTrackId {
	return value as DatacenterUpgradeTrackId;
}

async function fetchDatacenterItem(client: CommandClient, dcId: string): Promise<DatacenterListItem> {
	const result = (await client.query({ kind: "list", target: "datacenters" })) as ListResult;
	if (result.kind !== "datacenters") {
		throw new Error("Unexpected datacenter list payload from daemon");
	}

	const item = result.items.find((candidate) => candidate.datacenter.id === dcId);
	if (!item) {
		throw new Error(`Datacenter not found: ${dcId}`);
	}

	return item;
}

function renderUpgradeTrack(item: DatacenterListItem, trackId: DatacenterUpgradeTrackId): string[] {
	const track = item.upgrades.tracks.find((candidate) => candidate.trackId === trackId);
	if (!track) {
		return [`  ${trackId}: unavailable`];
	}

	const current = `${track.currentNode.label} (${track.currentNode.id})`;
	const next = track.nextNode
		? `${track.nextNode.label} (${track.nextNode.id}) | Capex $${track.nextNode.capexCost.toLocaleString()} | +$${track.nextNode.fixedMonthlyOpexDelta.toLocaleString()}/mo`
		: "MAXED";
	return [`  ${track.label}: ${current} → ${next}`];
}

function renderUpgradeView(item: DatacenterListItem): string {
	const lines = [
		`=== Datacenter upgrades: ${item.datacenter.id} ===`,
		`  Site          : ${item.datacenter.name} (${item.datacenter.spec.id})`,
		`  Power         : ${item.powerKw.toFixed(1)} / ${item.infrastructure.effective.rackPowerCapacityKw} kW rack headroom (${item.infrastructure.effective.gridImportCapacityKw} kW grid + ${item.infrastructure.effective.onsiteGenerationCapacityKw} kW onsite)`,
		`  Cooling       : ${Math.round(item.heatOutputBtuPerHr)} / ${item.infrastructure.effective.coolingCapacityBtuPerHr} BTU/hr (${item.infrastructure.effective.coolingType})`,
		`  Network       : ${item.bandwidthGbps.toFixed(1)} / ${item.infrastructure.effective.bandwidthGbps} Gbps (${item.infrastructure.effective.networkType})`,
		`  Fabric ready  : ${item.upgrades.fabricEligible ? "YES" : "NO"}`,
		`  Upgrade upkeep: $${item.upgrades.fixedMonthlyUpgradeOpex.toLocaleString()}/mo`,
		"",
		...renderUpgradeTrack(item, "cooling"),
		...renderUpgradeTrack(item, "networkType"),
		...renderUpgradeTrack(item, "onsiteGeneration"),
	];
	return lines.join("\n");
}

async function showUpgradeView(
	parsed: ParsedArgv,
	dcIdValue: string,
	clientFactory: CommandClientFactory,
): Promise<void> {
	await withClient(
		parsed,
		async (client) => {
			const item = await fetchDatacenterItem(client, dcIdValue);
			writeCommandResult(parsed, renderUpgradeView(item), { dcId: dcIdValue, upgrades: item.upgrades, infrastructure: item.infrastructure });
		},
		clientFactory,
	);
}

async function applyUpgrade(
	parsed: ParsedArgv,
	dcIdValue: string,
	upgradeTrackId: string,
	targetNodeId: string,
	clientFactory: CommandClientFactory,
): Promise<void> {
	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({
				type: "UpgradeDatacenter",
				dcId: datacenterId(dcIdValue),
				trackId: trackId(upgradeTrackId),
				targetNodeId,
			});
			const item = await fetchDatacenterItem(client, dcIdValue);
			const track = item.upgrades.tracks.find((candidate) => candidate.trackId === upgradeTrackId);
			writeCommandResult(
				parsed,
				`Applied upgrade ${upgradeTrackId} → ${targetNodeId} on ${dcIdValue}\n\n${renderUpgradeView(item)}`,
				{ dcId: dcIdValue, trackId: upgradeTrackId, targetNodeId, upgrades: item.upgrades, infrastructure: item.infrastructure, appliedTrack: track },
			);
		},
		clientFactory,
	);
}

export async function runDcUpgradeCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const first = parsed.positionals[0];
	if (!first) {
		throw new Error(
			"Usage: dct dc upgrade <dcId>\n" +
				"       dct dc upgrade apply <dcId> <trackId> <targetNodeId>",
		);
	}

	if (first === "apply") {
		const dcIdValue = requirePositional(parsed, 1, "dct dc upgrade apply <dcId> <trackId> <targetNodeId>");
		const upgradeTrackId = requirePositional(parsed, 2, "dct dc upgrade apply <dcId> <trackId> <targetNodeId>");
		const targetNodeId = requirePositional(parsed, 3, "dct dc upgrade apply <dcId> <trackId> <targetNodeId>");
		await applyUpgrade(parsed, dcIdValue, upgradeTrackId, targetNodeId, clientFactory);
		return;
	}

	if (hasBooleanFlag(parsed, "--json")) {
		await showUpgradeView(parsed, first, clientFactory);
		return;
	}

	await showUpgradeView(parsed, first, clientFactory);
}
