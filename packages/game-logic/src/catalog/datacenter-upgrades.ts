import {
	DATACENTER_UPGRADE_BALANCE,
	DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE,
	type DatacenterUpgradeBalanceNode,
} from "../balance/datacenter-upgrades.js";
import type {
	DatacenterNetworkType,
	DatacenterSpecId,
	DatacenterUpgradeProgress,
	DatacenterUpgradeTrackDefinition,
	DatacenterUpgradeTrackId,
	DatacenterUpgradeTrackNode,
} from "../types.js";

const datacenterSpecId = (value: string): DatacenterSpecId => value as DatacenterSpecId;

export interface DatacenterUpgradeBlueprint {
	specId: DatacenterSpecId;
	tracks: Record<DatacenterUpgradeTrackId, DatacenterUpgradeTrackDefinition>;
}

export interface DatacenterUpgradeBlueprintTrackView {
	trackId: DatacenterUpgradeTrackId;
	label: string;
	presentation: DatacenterUpgradeTrackDefinition["presentation"];
	currentNode: DatacenterUpgradeTrackNode;
	nextNode: DatacenterUpgradeTrackNode | null;
	maxNode: DatacenterUpgradeTrackNode;
	maxed: boolean;
}

export interface DatacenterUpgradeBlueprintView {
	specId: DatacenterSpecId;
	tracks: DatacenterUpgradeBlueprintTrackView[];
	fabricEligible: boolean;
}

function toUpgradeTrackNode(node: DatacenterUpgradeBalanceNode): DatacenterUpgradeTrackNode {
	return {
		id: node.id,
		label: node.label,
		capexCost: node.capexCost,
		opex: node.fixedMonthlyOpex && node.fixedMonthlyOpex > 0 ? { fixedMonthly: node.fixedMonthlyOpex } : {},
		infrastructure: node.infrastructure,
	};
}

function buildUpgradeBlueprint(specId: string): DatacenterUpgradeBlueprint {
	const balance = DATACENTER_UPGRADE_BALANCE[specId];
	if (!balance) {
		throw new Error(`Unknown datacenter upgrade balance: ${specId}`);
	}

	return {
		specId: datacenterSpecId(specId),
		tracks: {
			cooling: {
				id: "cooling",
				label: balance.tracks.cooling.label,
				presentation: balance.tracks.cooling.presentation,
				nodes: balance.tracks.cooling.nodes.map(toUpgradeTrackNode),
			},
			networkType: {
				id: "networkType",
				label: balance.tracks.networkType.label,
				presentation: balance.tracks.networkType.presentation,
				nodes: balance.tracks.networkType.nodes.map(toUpgradeTrackNode),
			},
			onsiteGeneration: {
				id: "onsiteGeneration",
				label: balance.tracks.onsiteGeneration.label,
				presentation: balance.tracks.onsiteGeneration.presentation,
				nodes: balance.tracks.onsiteGeneration.nodes.map(toUpgradeTrackNode),
			},
		},
	};
}

export const DATACENTER_UPGRADE_CATALOG: Record<string, DatacenterUpgradeBlueprint> = {
	garage: buildUpgradeBlueprint("garage"),
	warehouse: buildUpgradeBlueprint("warehouse"),
	hyperscale: buildUpgradeBlueprint("hyperscale"),
};

export function listDatacenterUpgradeTrackDefinitions(specId: DatacenterSpecId): DatacenterUpgradeTrackDefinition[] {
	return Object.values(getDatacenterUpgradeBlueprint(specId).tracks);
}

export function getDatacenterUpgradeBlueprint(specId: DatacenterSpecId): DatacenterUpgradeBlueprint {
	const blueprint = DATACENTER_UPGRADE_CATALOG[specId];
	if (!blueprint) {
		throw new Error(`Unknown datacenter upgrade blueprint: ${specId}`);
	}

	return blueprint;
}

export function getDatacenterUpgradeTrackDefinition(
	specId: DatacenterSpecId,
	trackId: DatacenterUpgradeTrackId,
): DatacenterUpgradeTrackDefinition {
	const track = getDatacenterUpgradeBlueprint(specId).tracks[trackId];
	if (!track) {
		throw new Error(`Unknown datacenter upgrade track '${trackId}' for blueprint '${specId}'`);
	}

	return track;
}

export function getDatacenterUpgradeNode(
	specId: DatacenterSpecId,
	trackId: DatacenterUpgradeTrackId,
	nodeId: string,
): DatacenterUpgradeTrackNode {
	const node = getDatacenterUpgradeTrackDefinition(specId, trackId).nodes.find((candidate) => candidate.id === nodeId);
	if (!node) {
		throw new Error(`Unknown datacenter upgrade node '${nodeId}' for track '${trackId}' on '${specId}'`);
	}

	return node;
}

export function defaultDatacenterUpgradeNodeByTrack(
	specId: DatacenterSpecId,
): Record<DatacenterUpgradeTrackId, DatacenterUpgradeTrackNode> {
	const blueprint = getDatacenterUpgradeBlueprint(specId);
	return {
		cooling: blueprint.tracks.cooling.nodes[0]!,
		networkType: blueprint.tracks.networkType.nodes[0]!,
		onsiteGeneration: blueprint.tracks.onsiteGeneration.nodes[0]!,
	};
}

export function createDatacenterUpgradeProgress(specId: DatacenterSpecId): DatacenterUpgradeProgress {
	const defaultNodes = defaultDatacenterUpgradeNodeByTrack(specId);
	return {
		currentNodeByTrack: {
			cooling: defaultNodes.cooling.id,
			networkType: defaultNodes.networkType.id,
			onsiteGeneration: defaultNodes.onsiteGeneration.id,
		},
	};
}

export function isNetworkTypeFiber(networkType: DatacenterNetworkType): boolean {
	return networkType === DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE;
}

export function describeDatacenterUpgradeBlueprint(specId: DatacenterSpecId): DatacenterUpgradeBlueprintView {
	const tracks = listDatacenterUpgradeTrackDefinitions(specId).map<DatacenterUpgradeBlueprintTrackView>((track) => ({
		trackId: track.id,
		label: track.label,
		presentation: track.presentation,
		currentNode: track.nodes[0]!,
		nextNode: track.nodes[1] ?? null,
		maxNode: track.nodes[track.nodes.length - 1]!,
		maxed: track.nodes.length === 1,
	}));
	const networkTrack = tracks.find((track) => track.trackId === "networkType");
	if (!networkTrack) {
		throw new Error(`Blueprint '${specId}' is missing a networkType upgrade track`);
	}

	return {
		specId,
		tracks,
		fabricEligible: isNetworkTypeFiber(
			networkTrack.currentNode.infrastructure.networkType ?? DATACENTER_UPGRADE_FABRIC_NETWORK_TYPE,
		),
	};
}
