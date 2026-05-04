import { RACK_CATALOG } from "../catalog/racks.js";
import type {
	CanPlaceRackResult,
	Capacity,
	Datacenter,
	DatacenterResourceUsage,
	GridPosition,
	RackPlacement,
	RackSpec,
	Tick,
} from "../types.js";
import { rackAgeMonths } from "../sim/maintenance.js";
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

function getRackSpec(placement: RackPlacement): RackSpec {
	const spec = RACK_CATALOG[placement.specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${placement.specId}`);
	}

	return spec;
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

export function datacenterUsage(datacenter: Datacenter): DatacenterResourceUsage {
	return datacenter.placements.reduce<DatacenterResourceUsage>((usage, placement) => {
		const spec = getRackSpec(placement);
		return {
			powerKw: usage.powerKw + spec.powerDrawKw,
			heatOutputBtuPerHr: usage.heatOutputBtuPerHr + spec.heatOutputBtuPerHr,
			bandwidthGbps: usage.bandwidthGbps + spec.bandwidthGbps,
			slotsUsed: usage.slotsUsed + 1,
		};
	}, EMPTY_DATACENTER_USAGE);
}

export function datacenterCapacity(datacenter: Datacenter): Capacity {
	return datacenter.placements
		.filter((placement) => placement.health === "healthy")
		.reduce<Capacity>((capacity, placement) => {
			const placementCapacity = rackCapacity(getRackSpec(placement));
			return {
				vCpu: capacity.vCpu + placementCapacity.vCpu,
				ramGb: capacity.ramGb + placementCapacity.ramGb,
				storageTb: capacity.storageTb + placementCapacity.storageTb,
				gpuFlops: capacity.gpuFlops + placementCapacity.gpuFlops,
			};
		}, EMPTY_CAPACITY);
}

export function datacenterInstalledCapacity(datacenter: Datacenter): Capacity {
	return datacenter.placements.reduce<Capacity>((capacity, placement) => {
		const placementCapacity = rackCapacity(getRackSpec(placement));
		return {
			vCpu: capacity.vCpu + placementCapacity.vCpu,
			ramGb: capacity.ramGb + placementCapacity.ramGb,
			storageTb: capacity.storageTb + placementCapacity.storageTb,
			gpuFlops: capacity.gpuFlops + placementCapacity.gpuFlops,
		};
	}, EMPTY_CAPACITY);
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
	const totalRackCount = datacenter.placements.length;
	const repairingRackCount = datacenter.placements.filter((placement) => placement.health === "repairing").length;
	const healthyRackCount = totalRackCount - repairingRackCount;
	const averageRackAgeMonths = totalRackCount === 0
		? 0
		: datacenter.placements.reduce((sum, placement) => sum + rackAgeMonths(currentTick, placement), 0) / totalRackCount;

	return {
		totalRackCount,
		healthyRackCount,
		repairingRackCount,
		averageRackAgeMonths,
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

	if (datacenter.spec.coolingType === "air" && spec.tier === 3) {
		return { ok: false, reason: "cooling_type_mismatch" };
	}

	const usage = datacenterUsage(datacenter);

	if (usage.powerKw + spec.powerDrawKw > datacenter.spec.powerCapacityKw) {
		return { ok: false, reason: "insufficient_power" };
	}

	if (usage.heatOutputBtuPerHr + spec.heatOutputBtuPerHr > datacenter.spec.coolingCapacityBtuPerHr) {
		return { ok: false, reason: "insufficient_cooling" };
	}

	if (usage.bandwidthGbps + spec.bandwidthGbps > datacenter.spec.bandwidthGbps) {
		return { ok: false, reason: "insufficient_bandwidth" };
	}

	return { ok: true };
}
