import { isLiveContract } from "../contracts/lifecycle.js";
import {
	createDatacenterUpgradeProgress,
	getDatacenterUpgradeTrackDefinition,
	isNetworkTypeFiber,
	listDatacenterUpgradeTrackDefinitions,
} from "../catalog/datacenter-upgrades.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import {
	allocateRackActivity,
	rackDemandByKindFromRequirements,
	summarizeRackActivity,
	type RackActivityAllocationResult,
} from "../economy/rack-activity.js";
import { rackAgeMonths, repairProgressPerSubtick, repairProgressPerTick } from "../sim/maintenance.js";
import { maintenanceStaffWagePerHead } from "../balance/easier.js";
import { MAX_MAINTENANCE_STAFF } from "../balance/maintenance.js";
import { regionStaffRemaining } from "./region.js";
import type {
	CanPlaceRackResult,
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	DatacenterInfrastructureProfile,
	DatacenterResourceUsage,
	DatacenterSpec,
	DatacenterUpgradeProgress,
	DatacenterUpgradeTrackId,
	DatacenterUpgradeTrackNode,
	GridPosition,
	Money,
	RackActivityView,
	RackPowerSummary,
	RackPlacement,
	RackSpec,
	Region,
	Tick,
} from "../types.js";
import { rackCapacity } from "./rack.js";

const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

const EMPTY_DATACENTER_USAGE: DatacenterResourceUsage = {
	powerKw: 0,
	heatOutputBtuPerHr: 0,
	bandwidthGbps: 0,
	slotsUsed: 0,
};

function cloneCapacity(capacity: Capacity): Capacity {
	return {
		vCpu: capacity.vCpu,
		ramGb: capacity.ramGb,
		storageTb: capacity.storageTb,
		gpuFlops: capacity.gpuFlops,
	};
}

function cloneUsage(usage: DatacenterResourceUsage): DatacenterResourceUsage {
	return {
		powerKw: usage.powerKw,
		heatOutputBtuPerHr: usage.heatOutputBtuPerHr,
		bandwidthGbps: usage.bandwidthGbps,
		slotsUsed: usage.slotsUsed,
	};
}

function addCapacity(total: Capacity, delta: Capacity): Capacity {
	return {
		vCpu: total.vCpu + delta.vCpu,
		ramGb: total.ramGb + delta.ramGb,
		storageTb: total.storageTb + delta.storageTb,
		gpuFlops: total.gpuFlops + delta.gpuFlops,
	};
}

function subtractCapacity(total: Capacity, reserved: Capacity): Capacity {
	return {
		vCpu: Math.max(0, total.vCpu - reserved.vCpu),
		ramGb: Math.max(0, total.ramGb - reserved.ramGb),
		storageTb: Math.max(0, total.storageTb - reserved.storageTb),
		gpuFlops: Math.max(0, total.gpuFlops - reserved.gpuFlops),
	};
}

function getRackSpec(placement: RackPlacement): RackSpec {
	const spec = RACK_CATALOG[placement.specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${placement.specId}`);
	}

	return spec;
}

export function datacenterBaseInfrastructure(spec: DatacenterSpec): DatacenterInfrastructureProfile {
	return {
		gridImportCapacityKw: spec.powerCapacityKw,
		onsiteGenerationCapacityKw: 0,
		rackPowerCapacityKw: spec.powerCapacityKw,
		coolingCapacityBtuPerHr: spec.coolingCapacityBtuPerHr,
		coolingType: spec.coolingType,
		networkType: spec.networkType,
		bandwidthGbps: spec.bandwidthGbps,
	};
}

export interface DatacenterUpgradeEconomics {
	fixedMonthly: Money;
	byTrack: Record<DatacenterUpgradeTrackId, Money>;
}

export interface ResolvedDatacenterOperationalProfile {
	upgradeState: DatacenterUpgradeState;
	infrastructure: DatacenterInfrastructureProfile;
	upgradeEconomics: DatacenterUpgradeEconomics;
}

export interface ResolvedDatacenterUpgradeTrackState {
	trackId: DatacenterUpgradeTrackId;
	label: string;
	presentation: "level" | "slots";
	currentNode: DatacenterUpgradeTrackNode;
	currentNodeIndex: number;
	nextNode: DatacenterUpgradeTrackNode | null;
	maxNode: DatacenterUpgradeTrackNode;
	maxed: boolean;
}

export interface DatacenterUpgradeState {
	progress: DatacenterUpgradeProgress;
	tracks: ResolvedDatacenterUpgradeTrackState[];
	fabricEligible: boolean;
}

export interface ValidatedDatacenterUpgrade {
	trackId: DatacenterUpgradeTrackId;
	trackLabel: string;
	currentNode: DatacenterUpgradeTrackNode;
	targetNode: DatacenterUpgradeTrackNode;
	capexCost: Money;
}

export function resolveDatacenterUpgradeProgress(datacenter: Pick<Datacenter, "spec" | "upgrades">): DatacenterUpgradeProgress {
	return datacenter.upgrades ?? createDatacenterUpgradeProgress(datacenter.spec.id);
}

export function resolveDatacenterUpgradeState(datacenter: Pick<Datacenter, "spec" | "upgrades">): DatacenterUpgradeState {
	const progress = resolveDatacenterUpgradeProgress(datacenter);
	const tracks = listDatacenterUpgradeTrackDefinitions(datacenter.spec.id).map<ResolvedDatacenterUpgradeTrackState>((track) => {
		const currentNodeId = progress.currentNodeByTrack[track.id] ?? track.nodes[0]!.id;
		const currentNodeIndex = track.nodes.findIndex((node) => node.id === currentNodeId);
		if (currentNodeIndex < 0) {
			throw new Error(`Unknown current node '${currentNodeId}' for track '${track.id}' on '${datacenter.spec.id}'`);
		}

		return {
			trackId: track.id,
			label: track.label,
			presentation: track.presentation,
			currentNode: track.nodes[currentNodeIndex]!,
			currentNodeIndex,
			nextNode: track.nodes[currentNodeIndex + 1] ?? null,
			maxNode: track.nodes[track.nodes.length - 1]!,
			maxed: currentNodeIndex === track.nodes.length - 1,
		};
	});
	const networkTrack = tracks.find((track) => track.trackId === "networkType");
	if (!networkTrack) {
		throw new Error(`Datacenter '${datacenter.spec.id}' is missing a networkType upgrade track`);
	}

	return {
		progress,
		tracks,
		fabricEligible: isNetworkTypeFiber(networkTrack.currentNode.infrastructure.networkType ?? datacenter.spec.networkType),
	};
}

export function validateDatacenterUpgradeRequest(
	datacenter: Pick<Datacenter, "spec" | "upgrades">,
	trackId: DatacenterUpgradeTrackId,
	targetNodeId: string,
): ValidatedDatacenterUpgrade {
	const trackDefinition = getDatacenterUpgradeTrackDefinition(datacenter.spec.id, trackId);
	const trackState = resolveDatacenterUpgradeState(datacenter).tracks.find((candidate) => candidate.trackId === trackId);
	if (!trackState) {
		throw new Error(`Datacenter '${datacenter.spec.id}' does not support upgrade track '${trackId}'`);
	}

	if (trackState.maxed) {
		throw new Error(`Upgrade track '${trackId}' is already maxed for datacenter '${datacenter.spec.id}'`);
	}

	if (targetNodeId === trackState.currentNode.id) {
		throw new Error(`Upgrade track '${trackId}' is already at node '${targetNodeId}'`);
	}

	const requestedNode = trackDefinition.nodes.find((node) => node.id === targetNodeId);
	if (!requestedNode) {
		throw new Error(`Unknown datacenter upgrade node '${targetNodeId}' for track '${trackId}' on '${datacenter.spec.id}'`);
	}

	const nextNode = trackState.nextNode;
	if (!nextNode || nextNode.id !== requestedNode.id) {
		throw new Error(
			`Upgrade track '${trackId}' must advance to immediate next node '${nextNode?.id ?? "<maxed>"}', received '${targetNodeId}'`,
		);
	}

	return {
		trackId,
		trackLabel: trackState.label,
		currentNode: trackState.currentNode,
		targetNode: requestedNode,
		capexCost: requestedNode.capexCost,
	};
}

export function applyDatacenterUpgrade(
	datacenter: Datacenter,
	trackId: DatacenterUpgradeTrackId,
	targetNodeId: string,
): Datacenter {
	validateDatacenterUpgradeRequest(datacenter, trackId, targetNodeId);
	const progress = resolveDatacenterUpgradeProgress(datacenter);
	return {
		...datacenter,
		upgrades: {
			currentNodeByTrack: {
				...progress.currentNodeByTrack,
				[trackId]: targetNodeId,
			},
		},
	};
}

function resolveDatacenterInfrastructureFromUpgradeState(
	datacenter: Pick<Datacenter, "spec">,
	upgradeState: DatacenterUpgradeState,
): DatacenterInfrastructureProfile {
	const resolved = datacenterBaseInfrastructure(datacenter.spec);
	for (const track of upgradeState.tracks) {
		if (track.currentNodeIndex === 0) {
			continue;
		}

		const { infrastructure } = track.currentNode;
		resolved.coolingType = infrastructure.coolingType ?? resolved.coolingType;
		resolved.coolingCapacityBtuPerHr = infrastructure.coolingCapacityBtuPerHr ?? resolved.coolingCapacityBtuPerHr;
		resolved.networkType = infrastructure.networkType ?? resolved.networkType;
		resolved.bandwidthGbps = infrastructure.bandwidthGbps ?? resolved.bandwidthGbps;
		resolved.onsiteGenerationCapacityKw = infrastructure.onsiteGenerationCapacityKw ?? resolved.onsiteGenerationCapacityKw;
	}
	resolved.rackPowerCapacityKw = resolved.gridImportCapacityKw + resolved.onsiteGenerationCapacityKw;
	return resolved;
}

function resolveDatacenterUpgradeEconomicsFromUpgradeState(
	upgradeState: DatacenterUpgradeState,
): DatacenterUpgradeEconomics {
	const byTrack = {
		cooling: 0,
		networkType: 0,
		onsiteGeneration: 0,
	} satisfies Record<DatacenterUpgradeTrackId, Money>;
	for (const track of upgradeState.tracks) {
		byTrack[track.trackId] = track.currentNode.opex.fixedMonthly ?? 0;
	}

	return {
		fixedMonthly: byTrack.cooling + byTrack.networkType + byTrack.onsiteGeneration,
		byTrack,
	};
}

export function resolveDatacenterOperationalProfile(
	datacenter: Pick<Datacenter, "spec" | "upgrades">,
): ResolvedDatacenterOperationalProfile {
	const upgradeState = resolveDatacenterUpgradeState(datacenter);
	return {
		upgradeState,
		infrastructure: resolveDatacenterInfrastructureFromUpgradeState(datacenter, upgradeState),
		upgradeEconomics: resolveDatacenterUpgradeEconomicsFromUpgradeState(upgradeState),
	};
}

export function resolveDatacenterInfrastructure(datacenter: Pick<Datacenter, "spec" | "upgrades">): DatacenterInfrastructureProfile {
	return resolveDatacenterOperationalProfile(datacenter).infrastructure;
}

export function resolveDatacenterUpgradeEconomics(datacenter: Pick<Datacenter, "spec" | "upgrades">): DatacenterUpgradeEconomics {
	return resolveDatacenterOperationalProfile(datacenter).upgradeEconomics;
}

function isWithinBounds(datacenter: Datacenter, position: GridPosition): boolean {
	return (
		position.row >= 0 &&
		position.row < datacenter.spec.rows &&
		position.position >= 0 &&
		position.position < datacenter.spec.positionsPerRow
	);
}

function isSlotTaken(datacenter: Datacenter, position: GridPosition): boolean {
	return datacenter.placements.some(
		(placement) => placement.row === position.row && placement.position === position.position,
	);
}

interface DatacenterPlacementAggregate {
	usage: DatacenterResourceUsage;
	installed: Capacity;
	usable: Capacity;
	totalRackCount: number;
	repairingRackCount: number;
	averageRackAgeMonths?: number;
}

function summarizeDatacenterPlacements(
	datacenter: Datacenter,
	currentTick?: Tick,
): DatacenterPlacementAggregate {
	let powerKw = 0;
	let heatOutputBtuPerHr = 0;
	let bandwidthGbps = 0;
	let slotsUsed = 0;
	let installedVCpu = 0;
	let installedRamGb = 0;
	let installedStorageTb = 0;
	let installedGpuFlops = 0;
	let usableVCpu = 0;
	let usableRamGb = 0;
	let usableStorageTb = 0;
	let usableGpuFlops = 0;
	let repairingRackCount = 0;
	let rackAgeMonthsTotal = 0;

	for (const placement of datacenter.placements) {
		const spec = getRackSpec(placement);
		const capacity = rackCapacity(spec);
		powerKw += spec.powerDrawKw;
		heatOutputBtuPerHr += spec.heatOutputBtuPerHr;
		bandwidthGbps += spec.bandwidthGbps;
		slotsUsed += 1;
		installedVCpu += capacity.vCpu;
		installedRamGb += capacity.ramGb;
		installedStorageTb += capacity.storageTb;
		installedGpuFlops += capacity.gpuFlops;
		if (placement.health === "healthy") {
			usableVCpu += capacity.vCpu;
			usableRamGb += capacity.ramGb;
			usableStorageTb += capacity.storageTb;
			usableGpuFlops += capacity.gpuFlops;
		} else {
			repairingRackCount += 1;
		}
		if (currentTick !== undefined) {
			rackAgeMonthsTotal += rackAgeMonths(currentTick, placement);
		}
	}

	const totalRackCount = datacenter.placements.length;
	return {
		usage: {
			powerKw,
			heatOutputBtuPerHr,
			bandwidthGbps,
			slotsUsed,
		},
		installed: {
			vCpu: installedVCpu,
			ramGb: installedRamGb,
			storageTb: installedStorageTb,
			gpuFlops: installedGpuFlops,
		},
		usable: {
			vCpu: usableVCpu,
			ramGb: usableRamGb,
			storageTb: usableStorageTb,
			gpuFlops: usableGpuFlops,
		},
		totalRackCount,
		repairingRackCount,
		averageRackAgeMonths: currentTick === undefined || totalRackCount === 0 ? undefined : rackAgeMonthsTotal / totalRackCount,
	};
}

function committedDemandForContracts(
	contracts: readonly Pick<Contract, "assignedDcId" | "lifecycleState" | "requirements">[],
	dcId: DatacenterId,
): ContractRequirements {
	let vCpu = 0;
	let ramGb = 0;
	let storageTb = 0;
	let gpuFlops = 0;
	for (const contract of contracts) {
		if (contract.assignedDcId !== dcId || !isLiveContract(contract)) {
			continue;
		}
		vCpu += contract.requirements.vCpu;
		ramGb += contract.requirements.ramGb;
		storageTb += contract.requirements.storageTb;
		gpuFlops += contract.requirements.gpuFlops;
	}
	return { vCpu, ramGb, storageTb, gpuFlops };
}

export interface DatacenterContractCapacitySummary {
	installed: Capacity;
	usable: Capacity;
	committed: ContractRequirements;
	available: Capacity;
}

export interface DatacenterOperationalCapacitySummary extends DatacenterContractCapacitySummary {
	dcId: DatacenterId;
	usage: DatacenterResourceUsage;
	maintenance?: DatacenterMaintenanceSummary;
}

export function summarizeAllDatacenterOperationalCapacities(
	datacenters: readonly Datacenter[],
	contracts: readonly Pick<Contract, "assignedDcId" | "lifecycleState" | "requirements">[],
	currentTick?: Tick,
): DatacenterOperationalCapacitySummary[] {
	const committedByDcId = new Map<DatacenterId, ContractRequirements>();
	for (const contract of contracts) {
		if (!contract.assignedDcId || !isLiveContract(contract)) {
			continue;
		}
		const existing = committedByDcId.get(contract.assignedDcId);
		if (existing) {
			existing.vCpu += contract.requirements.vCpu;
			existing.ramGb += contract.requirements.ramGb;
			existing.storageTb += contract.requirements.storageTb;
			existing.gpuFlops += contract.requirements.gpuFlops;
			continue;
		}
		committedByDcId.set(contract.assignedDcId, {
			vCpu: contract.requirements.vCpu,
			ramGb: contract.requirements.ramGb,
			storageTb: contract.requirements.storageTb,
			gpuFlops: contract.requirements.gpuFlops,
		});
	}

	return datacenters.map((datacenter) => {
		const placementAggregate = summarizeDatacenterPlacements(datacenter, currentTick);
		const committed = cloneCapacity(committedByDcId.get(datacenter.id) ?? EMPTY_CAPACITY);
		return {
			dcId: datacenter.id,
			usage: cloneUsage(placementAggregate.usage),
			installed: cloneCapacity(placementAggregate.installed),
			usable: cloneCapacity(placementAggregate.usable),
			committed,
			available: subtractCapacity(placementAggregate.usable, committed),
			maintenance: currentTick === undefined
				? undefined
				: {
						totalRackCount: placementAggregate.totalRackCount,
						healthyRackCount: placementAggregate.totalRackCount - placementAggregate.repairingRackCount,
						repairingRackCount: placementAggregate.repairingRackCount,
						averageRackAgeMonths: placementAggregate.averageRackAgeMonths ?? 0,
				  },
		};
	});
}

export function datacenterUsage(datacenter: Datacenter): DatacenterResourceUsage {
	return cloneUsage(summarizeDatacenterPlacements(datacenter).usage);
}

export function datacenterCapacity(datacenter: Datacenter): Capacity {
	return cloneCapacity(summarizeDatacenterPlacements(datacenter).usable);
}

export function datacenterInstalledCapacity(datacenter: Datacenter): Capacity {
	return cloneCapacity(summarizeDatacenterPlacements(datacenter).installed);
}

export function datacenterCommittedContractDemand(
	datacenter: Datacenter,
	contracts: readonly Pick<Contract, "assignedDcId" | "lifecycleState" | "requirements">[],
): ContractRequirements {
	return committedDemandForContracts(contracts, datacenter.id);
}

export function datacenterContractCapacitySummary(
	datacenter: Datacenter,
	contracts: readonly Pick<Contract, "assignedDcId" | "lifecycleState" | "requirements">[],
): DatacenterContractCapacitySummary {
	const placementAggregate = summarizeDatacenterPlacements(datacenter);
	const committed = committedDemandForContracts(contracts, datacenter.id);
	return {
		installed: cloneCapacity(placementAggregate.installed),
		usable: cloneCapacity(placementAggregate.usable),
		committed,
		available: subtractCapacity(placementAggregate.usable, committed),
	};
}

function serviceUnitsForRackKind(spec: RackSpec): number {
	switch (spec.kind) {
		case "compute":
			return spec.vCpu;
		case "memory":
			return spec.ramGb;
		case "storage":
			return spec.storageTb;
		case "gpu":
			return spec.gpuFlops;
		default:
			return 0;
	}
}

function datacenterRackActivityCandidates(datacenter: Datacenter) {
	return datacenter.placements.map((placement) => {
		const spec = getRackSpec(placement);
		return {
			placementId: placement.id,
			specId: placement.specId,
			kind: placement.kind,
			powerDrawKw: spec.powerDrawKw,
			serviceUnits: serviceUnitsForRackKind(spec),
			isRepairing: placement.health !== "healthy",
		};
	});
}

export function allocateDatacenterRackActivity(
	datacenter: Datacenter,
	assignedDemand: ContractRequirements,
): RackActivityAllocationResult {
	return allocateRackActivity(
		datacenterRackActivityCandidates(datacenter),
		rackDemandByKindFromRequirements(assignedDemand),
	);
}

export function datacenterRackActivityView(
	datacenter: Datacenter,
	assignedDemand: ContractRequirements,
): RackActivityView[] {
	return allocateDatacenterRackActivity(datacenter, assignedDemand).activities;
}

export function datacenterRackPowerSummary(
	datacenter: Datacenter,
	assignedDemand: ContractRequirements,
): RackPowerSummary {
	const activities = datacenterRackActivityView(datacenter, assignedDemand);
	return summarizeRackActivity(activities);
}

export interface DatacenterMaintenanceSummary {
	totalRackCount: number;
	healthyRackCount: number;
	repairingRackCount: number;
	averageRackAgeMonths: number;
}

export function datacenterMaintenanceSummary(
	datacenter: Datacenter,
	currentTick: Tick,
): DatacenterMaintenanceSummary {
	const aggregate = summarizeDatacenterPlacements(datacenter, currentTick);
	return {
		totalRackCount: aggregate.totalRackCount,
		healthyRackCount: aggregate.totalRackCount - aggregate.repairingRackCount,
		repairingRackCount: aggregate.repairingRackCount,
		averageRackAgeMonths: aggregate.averageRackAgeMonths ?? 0,
	};
}

// ── Maintenance staffing view ────────────────────────────────────────────────

/**
 * A derived, read-only snapshot of a datacenter's maintenance staffing state
 * and the economic + operational effects of that staffing level.
 *
 * Use `datacenterMaintenanceStaffingView()` to produce this — never assemble
 * it ad-hoc in CLI or TUI renderers.
 */
export interface DatacenterMaintenanceStaffingView {
	/** Id of the datacenter this view describes. */
	dcId: DatacenterId;
	/** Current number of extra maintenance staff hired for this datacenter. */
	currentStaff: number;
	/** Absolute maximum extra maintenance staff allowed by game rules. */
	maxStaff: number;
	/**
	 * Whether another maintenance staff member can be hired right now.
	 * False if at `maxStaff` cap or if the region's labor pool is exhausted.
	 */
	canIncrease: boolean;
	/** Whether maintenance staff can be decreased (i.e. current > 0). */
	canDecrease: boolean;
	/**
	 * Spare regional staff slots available for this region, accounting for all
	 * datacenters in the region (including this one's current maintenanceStaff).
	 */
	availableRegionalStaff: number;
	/**
	 * Monthly wage cost per extra maintenance staff head ($).
	 *
	 * The easier-balance pass discounts this bucket separately from baseline
	 * datacenter staffing so UIs can surface the targeted maintenance-hire cost
	 * without also lowering all regional wages.
	 */
	staffWagePerHead: Money;
	/** Total extra monthly wages charged for all current maintenance staff ($). */
	extraWagesMonthly: Money;
	/**
	 * Repair progress accumulated per tick at the current staffing level, in
	 * days. Higher means faster repairs.
	 */
	repairSpeedDaysPerTick: number;
	/** Repair progress accumulated per day/subtick at the current staffing level, in days. */
	repairSpeedDaysPerSubtick: number;
	/** Alias for `repairSpeedDaysPerSubtick` for consumer copy that prefers day units. */
	repairSpeedDaysPerDay: number;
	/** Number of racks currently under repair. */
	repairingRackCount: number;
	/** Total number of rack placements in this datacenter. */
	totalRackCount: number;
	/** Average age of all racks in months. 0 if no racks. */
	averageRackAgeMonths: number;
}

/**
 * Derive the maintenance staffing view for a single datacenter.
 *
 * @param datacenter   - The datacenter to describe.
 * @param region       - The region this datacenter belongs to.
 * @param allDcs       - All datacenters in the game (needed to compute regional staff used).
 * @param currentTick  - The current game tick (= months elapsed).
 */
export function datacenterMaintenanceStaffingView(
	datacenter: Datacenter,
	region: Region,
	allDcs: readonly Datacenter[],
	currentTick: Tick,
): DatacenterMaintenanceStaffingView {
	const currentStaff = datacenter.maintenanceStaff;
	const availableRegionalStaff = regionStaffRemaining(region, allDcs as Datacenter[]);
	const maintenanceSummary = datacenterMaintenanceSummary(datacenter, currentTick);
	const staffWagePerHead = maintenanceStaffWagePerHead(region.staffWage);

	return {
		dcId: datacenter.id,
		currentStaff,
		maxStaff: MAX_MAINTENANCE_STAFF,
		canIncrease: currentStaff < MAX_MAINTENANCE_STAFF && availableRegionalStaff > 0,
		canDecrease: currentStaff > 0,
		availableRegionalStaff,
		staffWagePerHead,
		extraWagesMonthly: currentStaff * staffWagePerHead,
		repairSpeedDaysPerTick: repairProgressPerTick(currentStaff),
		repairSpeedDaysPerSubtick: repairProgressPerSubtick(currentStaff),
		repairSpeedDaysPerDay: repairProgressPerSubtick(currentStaff),
		repairingRackCount: maintenanceSummary.repairingRackCount,
		totalRackCount: maintenanceSummary.totalRackCount,
		averageRackAgeMonths: maintenanceSummary.averageRackAgeMonths,
	};
}

export function canPlaceRack(
	datacenter: Datacenter,
	spec: RackSpec,
	position: GridPosition,
): CanPlaceRackResult {
	if (!isWithinBounds(datacenter, position)) {
		return { ok: false, reason: "out_of_bounds" };
	}

	if (isSlotTaken(datacenter, position)) {
		return { ok: false, reason: "slot_taken" };
	}

	const infrastructure = resolveDatacenterInfrastructure(datacenter);

	if (infrastructure.coolingType === "air" && spec.tier === 3) {
		return { ok: false, reason: "cooling_type_mismatch" };
	}

	const usage = datacenterUsage(datacenter);

	if (usage.powerKw + spec.powerDrawKw > infrastructure.rackPowerCapacityKw) {
		return { ok: false, reason: "insufficient_power" };
	}

	if (usage.heatOutputBtuPerHr + spec.heatOutputBtuPerHr > infrastructure.coolingCapacityBtuPerHr) {
		return { ok: false, reason: "insufficient_cooling" };
	}

	if (usage.bandwidthGbps + spec.bandwidthGbps > infrastructure.bandwidthGbps) {
		return { ok: false, reason: "insufficient_bandwidth" };
	}

	return { ok: true };
}

export type CanMoveRackResult =
	| { ok: true }
	| { ok: false; reason: string };

export function canMoveRack(
	sourceDc: Datacenter,
	targetDc: Datacenter,
	placement: RackPlacement,
	targetPosition: GridPosition,
): CanMoveRackResult {
	if (sourceDc.id === targetDc.id) {
		return { ok: false, reason: "Cannot move rack to the same datacenter" };
	}

	const placementExists = sourceDc.placements.some((p) => p.id === placement.id);
	if (!placementExists) {
		return { ok: false, reason: "Rack placement not found in source datacenter" };
	}

	const spec = getRackSpec(placement);
	const placeResult = canPlaceRack(targetDc, spec, targetPosition);
	if (!placeResult.ok) {
		return { ok: false, reason: `Cannot place rack: ${placeResult.reason}` };
	}

	return { ok: true };
}
