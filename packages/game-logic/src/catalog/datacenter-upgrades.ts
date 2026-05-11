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

function createCoolingNode(
	id: string,
	label: string,
	coolingType: DatacenterUpgradeTrackNode["infrastructure"]["coolingType"],
	coolingCapacityBtuPerHr: number,
	capexCost: number,
	fixedMonthly = 0,
): DatacenterUpgradeTrackNode {
	return {
		id,
		label,
		capexCost,
		opex: fixedMonthly > 0 ? { fixedMonthly } : {},
		infrastructure: {
			coolingType,
			coolingCapacityBtuPerHr,
		},
	};
}

function createNetworkNode(
	id: string,
	label: string,
	networkType: DatacenterNetworkType,
	bandwidthGbps: number,
	capexCost: number,
	fixedMonthly = 0,
): DatacenterUpgradeTrackNode {
	return {
		id,
		label,
		capexCost,
		opex: fixedMonthly > 0 ? { fixedMonthly } : {},
		infrastructure: {
			networkType,
			bandwidthGbps,
		},
	};
}

function createGeneratorNode(
	installedSlots: number,
	onsiteGenerationCapacityKw: number,
	capexCost: number,
	fixedMonthly = 0,
): DatacenterUpgradeTrackNode {
	return {
		id: `gen-${installedSlots}`,
		label: installedSlots === 1 ? "1 generator installed" : `${installedSlots} generators installed`,
		capexCost,
		opex: fixedMonthly > 0 ? { fixedMonthly } : {},
		infrastructure: {
			onsiteGenerationCapacityKw,
		},
	};
}

export const DATACENTER_UPGRADE_CATALOG: Record<string, DatacenterUpgradeBlueprint> = {
	garage: {
		specId: datacenterSpecId("garage"),
		tracks: {
			cooling: {
				id: "cooling",
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					createCoolingNode("air", "Air cooling", "air", 120_000, 0),
					createCoolingNode("hybrid", "Hybrid cooling", "hybrid", 250_000, 180_000, 900),
				],
			},
			networkType: {
				id: "networkType",
				label: "Network uplink",
				presentation: "level",
				nodes: [
					createNetworkNode("cat6", "Cat6 uplink", "cat6", 80, 0),
					createNetworkNode("cat8", "Cat8 uplink", "cat8", 160, 75_000, 350),
					createNetworkNode("fiber", "Fiber uplink", "fiber", 320, 180_000, 1_250),
				],
			},
			onsiteGeneration: {
				id: "onsiteGeneration",
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					createGeneratorNode(0, 0, 0),
					createGeneratorNode(1, 25, 120_000, 1_600),
				],
			},
		},
	},
	warehouse: {
		specId: datacenterSpecId("warehouse"),
		tracks: {
			cooling: {
				id: "cooling",
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					createCoolingNode("air", "Air cooling", "air", 520_000, 0),
					createCoolingNode("hybrid", "Hybrid cooling", "hybrid", 900_000, 360_000, 2_200),
					createCoolingNode("liquid", "Liquid cooling", "liquid", 1_400_000, 840_000, 5_200),
				],
			},
			networkType: {
				id: "networkType",
				label: "Network uplink",
				presentation: "level",
				nodes: [
					createNetworkNode("cat8", "Cat8 uplink", "cat8", 400, 0),
					createNetworkNode("fiber", "Fiber uplink", "fiber", 1_000, 275_000, 2_000),
				],
			},
			onsiteGeneration: {
				id: "onsiteGeneration",
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					createGeneratorNode(0, 0, 0),
					createGeneratorNode(1, 80, 450_000, 3_800),
					createGeneratorNode(2, 160, 900_000, 7_600),
				],
			},
		},
	},
	hyperscale: {
		specId: datacenterSpecId("hyperscale"),
		tracks: {
			cooling: {
				id: "cooling",
				label: "Cooling loop",
				presentation: "level",
				nodes: [
					createCoolingNode("liquid", "Liquid cooling", "liquid", 10_500_000, 0),
				],
			},
			networkType: {
				id: "networkType",
				label: "Network uplink",
				presentation: "level",
				nodes: [
					createNetworkNode("fiber", "Fiber uplink", "fiber", 5_000, 0),
				],
			},
			onsiteGeneration: {
				id: "onsiteGeneration",
				label: "Gas generators",
				presentation: "slots",
				nodes: [
					createGeneratorNode(0, 0, 0),
					createGeneratorNode(1, 400, 1_800_000, 16_000),
					createGeneratorNode(2, 800, 3_600_000, 32_000),
					createGeneratorNode(3, 1_200, 5_400_000, 48_000),
					createGeneratorNode(4, 1_600, 7_200_000, 64_000),
				],
			},
		},
	},
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
	return networkType === "fiber";
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
		fabricEligible: isNetworkTypeFiber(networkTrack.currentNode.infrastructure.networkType ?? "cat6"),
	};
}
