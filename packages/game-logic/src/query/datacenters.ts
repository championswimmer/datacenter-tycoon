import { contractsFromState, selectLiveContracts } from "../contracts/lifecycle.js";
import {
	datacenterBaseInfrastructure,
	datacenterCommittedContractDemand,
	datacenterContractCapacitySummary,
	datacenterMaintenanceStaffingView,
	datacenterRackActivityView,
	datacenterRackPowerSummary,
	resolveDatacenterInfrastructure,
	type DatacenterContractCapacitySummary,
	type DatacenterMaintenanceStaffingView,
} from "../entities/datacenter.js";
import type {
	Capacity,
	Datacenter,
	DatacenterId,
	DatacenterInfrastructureProfile,
	GameState,
	RackActivityView,
	RackPowerSummary,
} from "../types.js";

const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

function addCapacity(total: Capacity, delta: Capacity): Capacity {
	return {
		vCpu: total.vCpu + delta.vCpu,
		ramGb: total.ramGb + delta.ramGb,
		storageTb: total.storageTb + delta.storageTb,
		gpuFlops: total.gpuFlops + delta.gpuFlops,
	};
}

function getDatacenterOrThrow(datacenters: readonly Datacenter[], dcId: DatacenterId): Datacenter {
	const datacenter = datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

export interface DatacenterCapacityFromStateSummary extends DatacenterContractCapacitySummary {
	dcId: DatacenterId;
}

export interface DatacenterInfrastructureFromStateSummary {
	dcId: DatacenterId;
	base: DatacenterInfrastructureProfile;
	effective: DatacenterInfrastructureProfile;
}

export interface NetworkCapacitySummary {
	installed: Capacity;
	usable: Capacity;
	committed: Capacity;
	available: Capacity;
	perDc: DatacenterCapacityFromStateSummary[];
}

export function summarizeDatacenterCapacityFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): DatacenterCapacityFromStateSummary {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const liveContracts = selectLiveContracts(contractsFromState(state));
	return {
		dcId,
		...datacenterContractCapacitySummary(datacenter, liveContracts),
	};
}

export function summarizeDatacenterInfrastructureFromState(
	state: Pick<GameState, "datacenters">,
	dcId: DatacenterId,
): DatacenterInfrastructureFromStateSummary {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return {
		dcId,
		base: datacenterBaseInfrastructure(datacenter.spec),
		effective: resolveDatacenterInfrastructure(datacenter),
	};
}

export function summarizeAllDatacenterInfrastructureFromState(
	state: Pick<GameState, "datacenters">,
): DatacenterInfrastructureFromStateSummary[] {
	return state.datacenters.map((datacenter) => summarizeDatacenterInfrastructureFromState(state, datacenter.id));
}

export function summarizeAllDatacenterCapacitiesFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
): DatacenterCapacityFromStateSummary[] {
	const liveContracts = selectLiveContracts(contractsFromState(state));
	return state.datacenters.map((datacenter) => ({
		dcId: datacenter.id,
		...datacenterContractCapacitySummary(datacenter, liveContracts),
	}));
}

export function summarizeNetworkCapacityFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
): NetworkCapacitySummary {
	const perDc = summarizeAllDatacenterCapacitiesFromState(state);
	return {
		installed: perDc.reduce((total, summary) => addCapacity(total, summary.installed), EMPTY_CAPACITY),
		usable: perDc.reduce((total, summary) => addCapacity(total, summary.usable), EMPTY_CAPACITY),
		committed: perDc.reduce((total, summary) => addCapacity(total, summary.committed), EMPTY_CAPACITY),
		available: perDc.reduce((total, summary) => addCapacity(total, summary.available), EMPTY_CAPACITY),
		perDc,
	};
}

export function selectAssignedDemandForDatacenterFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): Capacity {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const liveContracts = selectLiveContracts(contractsFromState(state));
	return datacenterCommittedContractDemand(datacenter, liveContracts);
}

export function selectDatacenterRackActivityViewFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): RackActivityView[] {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return datacenterRackActivityView(datacenter, selectAssignedDemandForDatacenterFromState(state, dcId));
}

export function selectDatacenterRackPowerSummaryFromState(
	state: Pick<GameState, "datacenters" | "contracts" | "contractMarket" | "activeContracts">,
	dcId: DatacenterId,
): RackPowerSummary {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	return datacenterRackPowerSummary(datacenter, selectAssignedDemandForDatacenterFromState(state, dcId));
}

export function selectDatacenterMaintenanceStaffingViewFromState(
	state: Pick<GameState, "datacenters" | "map" | "tick">,
	dcId: DatacenterId,
): DatacenterMaintenanceStaffingView {
	const datacenter = getDatacenterOrThrow(state.datacenters, dcId);
	const region = state.map.regions.find((candidate) => candidate.id === datacenter.regionId);
	if (!region) {
		throw new Error(`Unknown region ${datacenter.regionId} for datacenter ${datacenter.id}`);
	}

	return datacenterMaintenanceStaffingView(datacenter, region, state.datacenters, state.tick);
}

export function selectDatacenterMaintenanceStaffingViewsFromState(
	state: Pick<GameState, "datacenters" | "map" | "tick">,
): DatacenterMaintenanceStaffingView[] {
	return state.datacenters.map((datacenter) =>
		selectDatacenterMaintenanceStaffingViewFromState(state, datacenter.id)
	);
}
