import { DIFFICULTY_CONFIG } from "../balance/difficulty.js";
import { maintenanceStaffWagePerHead } from "../balance/easier.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { contractsFromState, isLiveContract, selectLiveContracts } from "../contracts/lifecycle.js";
import { createContractSlaOutcome } from "../contracts/reliability.js";
import { contractMeetsSlaTarget, resetContractSlaWindow, withContractSlaDefaults } from "../contracts/sla.js";
import {
	datacenterRackPowerSummary,
	datacenterUsage,
	resolveDatacenterOperationalProfile,
	type DatacenterUpgradeEconomics,
} from "../entities/datacenter.js";
import type {
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	DatacenterInfrastructureProfile,
	DatacenterResourceUsage,
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
	let vCpu = 0;
	let ramGb = 0;
	let storageTb = 0;
	let gpuFlops = 0;

	for (const contract of contracts) {
		if (contract.assignedDcId !== datacenterId || !isLiveContract(contract)) {
			continue;
		}

		vCpu += contract.requirements.vCpu;
		ramGb += contract.requirements.ramGb;
		storageTb += contract.requirements.storageTb;
		gpuFlops += contract.requirements.gpuFlops;
	}

	return { vCpu, ramGb, storageTb, gpuFlops };
}

function maintenanceCostForDatacenter(datacenter: Datacenter): Money {
	let maintenance = 0;
	for (const placement of datacenter.placements) {
		const spec = RACK_CATALOG[placement.specId];
		if (!spec) {
			throw new Error(`Unknown rack spec: ${placement.specId}`);
		}
		maintenance += spec.monthlyMaintenance;
	}
	return maintenance;
}

export interface DatacenterAssignedDemandMap extends ReadonlyMap<DatacenterId, ContractRequirements> {}

export interface DatacenterOpexInputs {
	usage: DatacenterResourceUsage;
	infrastructure: DatacenterInfrastructureProfile;
	upgradeEconomics: DatacenterUpgradeEconomics;
	assignedDemand: ContractRequirements;
	billedPowerKw: number;
	maintenance: Money;
}

export function buildAssignedDemandByDatacenter(
	contracts: readonly Pick<Contract, "assignedDcId" | "lifecycleState" | "requirements">[],
): DatacenterAssignedDemandMap {
	const assignedDemandByDatacenter = new Map<DatacenterId, ContractRequirements>();
	for (const contract of contracts) {
		if (!contract.assignedDcId || !isLiveContract(contract)) {
			continue;
		}

		const existing = assignedDemandByDatacenter.get(contract.assignedDcId);
		if (existing) {
			existing.vCpu += contract.requirements.vCpu;
			existing.ramGb += contract.requirements.ramGb;
			existing.storageTb += contract.requirements.storageTb;
			existing.gpuFlops += contract.requirements.gpuFlops;
			continue;
		}

		assignedDemandByDatacenter.set(contract.assignedDcId, {
			vCpu: contract.requirements.vCpu,
			ramGb: contract.requirements.ramGb,
			storageTb: contract.requirements.storageTb,
			gpuFlops: contract.requirements.gpuFlops,
		});
	}

	return assignedDemandByDatacenter;
}

export function summarizeDatacenterOpexInputs(
	datacenter: Datacenter,
	options: {
		assignedDemand?: ContractRequirements;
		activityAwareBilling?: boolean;
	} = {},
): DatacenterOpexInputs {
	const usage = datacenterUsage(datacenter);
	const operationalProfile = resolveDatacenterOperationalProfile(datacenter);
	const assignedDemand = options.assignedDemand ?? EMPTY_CAPACITY;
	const billedPowerKw = options.activityAwareBilling
		? datacenterRackPowerSummary(datacenter, assignedDemand).billedPowerKw
		: usage.powerKw;

	return {
		usage,
		infrastructure: operationalProfile.infrastructure,
		upgradeEconomics: operationalProfile.upgradeEconomics,
		assignedDemand,
		billedPowerKw,
		maintenance: maintenanceCostForDatacenter(datacenter),
	};
}

export function tickOpexFromInputs(
	datacenter: Pick<Datacenter, "spec" | "maintenanceStaff">,
	region: Region,
	inputs: DatacenterOpexInputs,
): OpexTickResult {
	const rawPowerCost = inputs.billedPowerKw * HOURS_PER_MONTH * region.powerCostPerKwh;
	const power = roundMoney(rawPowerCost);
	const cooling = roundMoney(rawPowerCost * COOLING_OVERHEAD_RATIO);
	const bandwidth = roundMoney(inputs.infrastructure.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
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
		maintenance: roundMoney(inputs.maintenance),
		upgrades: roundMoney(inputs.upgradeEconomics.fixedMonthly),
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

export function tickOpex(
	datacenter: Datacenter,
	region: Region,
	activeContracts?: readonly Contract[],
): OpexTickResult {
	const assignedDemand = activeContracts ? getAssignedDemand(activeContracts, datacenter.id) : EMPTY_CAPACITY;
	return tickOpexFromInputs(
		datacenter,
		region,
		summarizeDatacenterOpexInputs(datacenter, {
			assignedDemand,
			activityAwareBilling: activeContracts !== undefined,
		}),
	);
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
