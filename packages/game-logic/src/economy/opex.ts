import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { maintenanceStaffWagePerHead } from "../balance/easier.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { contractsFromState, isLiveContract, selectLiveContracts } from "../contracts/lifecycle.js";
import { createContractSlaOutcome } from "../contracts/reliability.js";
import { contractMeetsSlaTarget, resetContractSlaWindow, withContractSlaDefaults } from "../contracts/sla.js";
import {
	datacenterRackPowerSummary,
	datacenterUsage,
	resolveDatacenterInfrastructure,
	resolveDatacenterUpgradeEconomics,
} from "../entities/datacenter.js";
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
	const infrastructure = resolveDatacenterInfrastructure(datacenter);
	const upgradeEconomics = resolveDatacenterUpgradeEconomics(datacenter);
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
	const bandwidth = roundMoney(infrastructure.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
	// Extra maintenance staffing is the only wage bucket targeted by the easier
	// balance pass. Baseline facility staffing remains tied to `region.staffWage`.
	const maintenanceStaffWage = maintenanceStaffWagePerHead(region.staffWage);
	const staff = roundMoney(
		datacenter.spec.staffCount * region.staffWage + datacenter.maintenanceStaff * maintenanceStaffWage,
	);
	const breakdown = {
		power,
		cooling,
		bandwidth,
		staff,
		maintenance: roundMoney(maintenance),
		upgrades: roundMoney(upgradeEconomics.fixedMonthly),
		tax: 0 as Money,
	};

	return {
		total: roundMoney(
			breakdown.power +
				breakdown.cooling +
				breakdown.bandwidth +
				breakdown.staff +
				breakdown.maintenance +
				breakdown.upgrades,
		),
		breakdown,
	};
}

export function tickRevenue(
	state: GameState,
	contracts: readonly Contract[] = contractsFromState(state),
): RevenueTickResult {
	const breachPenaltyMultiplier = DIFFICULTY_CONFIG[state.difficulty].breachPenaltyMultiplier;
	let revenue = 0;
	const perDcRevenue: Record<DatacenterId, Money> = {};

	const liveContracts = selectLiveContracts(contracts);
	const outcomes = [] as RevenueTickResult["outcomes"];
	const updatedLiveContracts = liveContracts.map((contract): Contract => {
		const normalized = withContractSlaDefaults(contract);
		const dcId = normalized.assignedDcId;
		const penalty = roundMoney(normalized.penaltyPerMonth * breachPenaltyMultiplier);
		const meetsTarget = dcId !== undefined && contractMeetsSlaTarget(normalized);

		if (meetsTarget) {
			revenue += normalized.monthlyPayment;
			perDcRevenue[dcId] = (perDcRevenue[dcId] ?? 0) + normalized.monthlyPayment;
			outcomes.push(createContractSlaOutcome(normalized, state.tick, "fulfilled"));
			return resetContractSlaWindow({
				...normalized,
				lifecycleState: "serving",
				status: "active",
				breachStreakMonths: 0,
			});
		}

		if (dcId !== undefined) {
			revenue -= penalty;
			perDcRevenue[dcId] = (perDcRevenue[dcId] ?? 0) - penalty;
		}
		outcomes.push(createContractSlaOutcome(normalized, state.tick, "breached"));
		return resetContractSlaWindow({
			...normalized,
			lifecycleState: "breached",
			status: "breached",
			breachStreakMonths: (normalized.breachStreakMonths ?? 0) + 1,
		});
	});
	const updatedContractsById = new Map(updatedLiveContracts.map((contract) => [contract.id, contract]));
	const updatedContracts = contracts.map((contract) => updatedContractsById.get(contract.id) ?? contract);

	return {
		revenue: roundMoney(revenue),
		perDcRevenue,
		updatedContracts,
		outcomes,
	};
}
