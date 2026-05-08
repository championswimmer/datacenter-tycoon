import { RACK_IDLE_BASELINE_POWER_KW } from "../balance/power.js";
import type {
	ContractRequirements,
	RackActivityView,
	RackKind,
	RackPlacementId,
	RackSpecId,
} from "../types.js";

export type RackDemandByKind = Readonly<Record<RackKind, number>>;

export interface RackAllocationCandidate {
	placementId: RackPlacementId;
	specId: RackSpecId;
	kind: RackKind;
	powerDrawKw: number;
	serviceUnits: number;
	isRepairing?: boolean;
}

export interface RackActivityAllocationResult {
	activities: RackActivityView[];
	remainingDemandByKind: Record<RackKind, number>;
}

export function rackDemandByKindFromRequirements(
	requirements: ContractRequirements,
): Record<RackKind, number> {
	return {
		compute: requirements.vCpu,
		memory: requirements.ramGb,
		storage: requirements.storageTb,
		gpu: requirements.gpuFlops,
	};
}

const RACK_KIND_ORDER: readonly RackKind[] = ["compute", "memory", "storage", "gpu"];

export function emptyRackDemandByKind(): Record<RackKind, number> {
	return {
		compute: 0,
		memory: 0,
		storage: 0,
		gpu: 0,
	};
}

export function normalizeRackDemandByKind(
	demandByKind: Partial<Record<RackKind, number>>,
): Record<RackKind, number> {
	const normalized = emptyRackDemandByKind();

	for (const kind of RACK_KIND_ORDER) {
		const value = demandByKind[kind] ?? 0;
		normalized[kind] = Number.isFinite(value) && value > 0 ? value : 0;
	}

	return normalized;
}

export function allocateRackActivity(
	racks: readonly RackAllocationCandidate[],
	demandByKind: Partial<Record<RackKind, number>>,
): RackActivityAllocationResult {
	const remainingDemandByKind = normalizeRackDemandByKind(demandByKind);
	const activities: RackActivityView[] = [];

	const orderedRacks = [...racks].sort((a, b) => {
		if (a.kind !== b.kind) {
			return RACK_KIND_ORDER.indexOf(a.kind) - RACK_KIND_ORDER.indexOf(b.kind);
		}

		return String(a.placementId).localeCompare(String(b.placementId));
	});

	for (const rack of orderedRacks) {
		const isRepairing = Boolean(rack.isRepairing);
		const availableUnits = Number.isFinite(rack.serviceUnits) && rack.serviceUnits > 0 ? rack.serviceUnits : 0;
		const reservedPowerKw = Number.isFinite(rack.powerDrawKw) && rack.powerDrawKw > 0 ? rack.powerDrawKw : 0;

		let status: RackActivityView["status"] = "idle";
		if (isRepairing) {
			status = "repairing";
		} else if (remainingDemandByKind[rack.kind] > 0 && availableUnits > 0) {
			status = "active";
			remainingDemandByKind[rack.kind] = Math.max(0, remainingDemandByKind[rack.kind] - availableUnits);
		}

		const billedPowerKw = status === "active" ? reservedPowerKw : RACK_IDLE_BASELINE_POWER_KW;
		activities.push({
			placementId: rack.placementId,
			specId: rack.specId,
			kind: rack.kind,
			status,
			reservedPowerKw,
			billedPowerKw,
		});
	}

	return {
		activities,
		remainingDemandByKind,
	};
}
