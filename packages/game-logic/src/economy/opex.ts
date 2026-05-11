import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { contractsFromState, isLiveContract, selectLiveContracts } from "../contracts/lifecycle.js";
import { datacenterCapacity, datacenterRackPowerSummary, datacenterUsage } from "../entities/datacenter.js";
import type {
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	GameState,
	Money,
	OpexTickResult,
	Region,
	RevenueTickResult,
} from "../types.js";
import {
	BANDWIDTH_USD_PER_GBPS_MONTH,
	COOLING_OVERHEAD_RATIO,
	HOURS_PER_MONTH,
} from "./constants.js";

const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

function roundMoney(value: number): Money {
	return Math.round(value * 100) / 100;
}

function addRequirements(total: ContractRequirements, requirements: ContractRequirements): ContractRequirements {
	return {
		vCpu: total.vCpu + requirements.vCpu,
		ramGb: total.ramGb + requirements.ramGb,
		storageTb: total.storageTb + requirements.storageTb,
		gpuFlops: total.gpuFlops + requirements.gpuFlops,
	};
}

function canCoverRequirements(capacity: Capacity, requirements: ContractRequirements): boolean {
	return (
		capacity.vCpu >= requirements.vCpu &&
		capacity.ramGb >= requirements.ramGb &&
		capacity.storageTb >= requirements.storageTb &&
		capacity.gpuFlops >= requirements.gpuFlops
	);
}

function getAssignedDemand(contracts: readonly Contract[], datacenterId: DatacenterId): ContractRequirements {
	return contracts.reduce<ContractRequirements>((total, contract) => {
		if (contract.assignedDcId !== datacenterId || !isLiveContract(contract)) {
			return total;
		}

		return addRequirements(total, contract.requirements);
	}, EMPTY_CAPACITY);
}

export function tickOpex(
	datacenter: Datacenter,
	region: Region,
	activeContracts?: readonly Contract[],
): OpexTickResult {
	const usage = datacenterUsage(datacenter);
	const assignedDemand = activeContracts ? getAssignedDemand(activeContracts, datacenter.id) : EMPTY_CAPACITY;
	const billedPowerKw = activeContracts
		? datacenterRackPowerSummary(datacenter, assignedDemand).billedPowerKw
		: usage.powerKw;
	// The easier-balance pass maps the requested “staffing cost of all racks”
	// onto `RackSpec.monthlyMaintenance`, because rack specs do not currently
	// model a separate per-rack labor field. Rebalancing the catalog value keeps
	// all existing consumers (UI, CLI, opex, docs) aligned on one source of truth.
	const maintenance = datacenter.placements.reduce((total, placement) => {
		const spec = RACK_CATALOG[placement.specId];
		if (!spec) {
			throw new Error(`Unknown rack spec: ${placement.specId}`);
		}

		return total + spec.monthlyMaintenance;
	}, 0);

	const rawPowerCost = billedPowerKw * HOURS_PER_MONTH * region.powerCostPerKwh;
	const power = roundMoney(rawPowerCost);
	const cooling = roundMoney(rawPowerCost * COOLING_OVERHEAD_RATIO);
	const bandwidth = roundMoney(datacenter.spec.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
	// Extra maintenance staffing is the only wage bucket targeted by the easier
	// balance pass. Baseline facility staffing remains tied to `region.staffWage`.
	const staff = roundMoney((datacenter.spec.staffCount + datacenter.maintenanceStaff) * region.staffWage);
	const breakdown = {
		power,
		cooling,
		bandwidth,
		staff,
		maintenance: roundMoney(maintenance),
		tax: 0 as Money,
	};

	return {
		total: roundMoney(
			breakdown.power +
				breakdown.cooling +
				breakdown.bandwidth +
				breakdown.staff +
				breakdown.maintenance,
		),
		breakdown,
	};
}

export function tickRevenue(state: GameState): RevenueTickResult {
	const datacentersById = new Map(state.datacenters.map((datacenter) => [datacenter.id, datacenter]));
	const breachPenaltyMultiplier = DIFFICULTY_CONFIG[state.difficulty].breachPenaltyMultiplier;
	let revenue = 0;
	const perDcRevenue: Record<DatacenterId, Money> = {};

	const contracts = contractsFromState(state);
	const liveContracts = selectLiveContracts(contracts);
	const updatedLiveContracts = liveContracts.map((contract): Contract => {
		if (!contract.assignedDcId) {
			return contract;
		}

		const datacenter = datacentersById.get(contract.assignedDcId);
		const penalty = roundMoney(contract.penaltyPerMonth * breachPenaltyMultiplier);

		if (!datacenter) {
			revenue -= penalty;
			perDcRevenue[contract.assignedDcId] = (perDcRevenue[contract.assignedDcId] ?? 0) - penalty;
			return {
				...contract,
				lifecycleState: "breached",
				status: "breached",
				breachStreakMonths: (contract.breachStreakMonths ?? 0) + 1,
			};
		}

		const datacenterDemand = getAssignedDemand(liveContracts, datacenter.id);
		const datacenterSupply = datacenterCapacity(datacenter);
		if (!canCoverRequirements(datacenterSupply, datacenterDemand)) {
			revenue -= penalty;
			perDcRevenue[datacenter.id] = (perDcRevenue[datacenter.id] ?? 0) - penalty;
			return {
				...contract,
				lifecycleState: "breached",
				status: "breached",
				breachStreakMonths: (contract.breachStreakMonths ?? 0) + 1,
			};
		}

		revenue += contract.monthlyPayment;
		perDcRevenue[datacenter.id] = (perDcRevenue[datacenter.id] ?? 0) + contract.monthlyPayment;
		return {
			...contract,
			lifecycleState: "serving",
			status: "active",
		};
	});
	const updatedContractsById = new Map(updatedLiveContracts.map((contract) => [contract.id, contract]));
	const updatedContracts = contracts.map((contract) => updatedContractsById.get(contract.id) ?? contract);

	return {
		revenue: roundMoney(revenue),
		perDcRevenue,
		updatedContracts,
	};
}
