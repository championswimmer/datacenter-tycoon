import { RACK_CATALOG } from "../catalog/racks.js";
import { datacenterCapacity, datacenterUsage } from "../entities/datacenter.js";
import type {
	Capacity,
	Contract,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	GameState,
	Money,
	OpexTickResult,
	RevenueTickResult,
} from "../types.js";
import {
	BANDWIDTH_USD_PER_GBPS_MONTH,
	COOLING_OVERHEAD_RATIO,
	DEFAULT_STAFF_WAGE,
	ELECTRICITY_USD_PER_KWH,
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

function getAssignedDemand(activeContracts: Contract[], datacenterId: DatacenterId): ContractRequirements {
	return activeContracts.reduce<ContractRequirements>((total, contract) => {
		if (
			contract.assignedDcId !== datacenterId ||
			(contract.status !== "active" && contract.status !== "breached")
		) {
			return total;
		}

		return addRequirements(total, contract.requirements);
	}, EMPTY_CAPACITY);
}

export function tickOpex(datacenter: Datacenter): OpexTickResult {
	const usage = datacenterUsage(datacenter);
	const maintenance = datacenter.placements.reduce((total, placement) => {
		const spec = RACK_CATALOG[placement.specId];
		if (!spec) {
			throw new Error(`Unknown rack spec: ${placement.specId}`);
		}

		return total + spec.monthlyMaintenance;
	}, 0);

	const rawPowerCost = usage.powerKw * HOURS_PER_MONTH * ELECTRICITY_USD_PER_KWH;
	const power = roundMoney(rawPowerCost);
	const cooling = roundMoney(rawPowerCost * COOLING_OVERHEAD_RATIO);
	const bandwidth = roundMoney(datacenter.spec.bandwidthGbps * BANDWIDTH_USD_PER_GBPS_MONTH);
	const staff = roundMoney(datacenter.spec.staffCount * DEFAULT_STAFF_WAGE);
	const breakdown = {
		power,
		cooling,
		bandwidth,
		staff,
		maintenance: roundMoney(maintenance),
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
	let revenue = 0;

	const updatedContracts = state.activeContracts.map((contract): Contract => {
		if ((contract.status !== "active" && contract.status !== "breached") || !contract.assignedDcId) {
			return contract;
		}

		const datacenter = datacentersById.get(contract.assignedDcId);
		if (!datacenter) {
			revenue -= contract.penaltyPerMonth;
			return {
				...contract,
				status: "breached",
			};
		}

		const datacenterDemand = getAssignedDemand(state.activeContracts, datacenter.id);
		const datacenterSupply = datacenterCapacity(datacenter);
		if (!canCoverRequirements(datacenterSupply, datacenterDemand)) {
			revenue -= contract.penaltyPerMonth;
			return {
				...contract,
				status: "breached",
			};
		}

		revenue += contract.monthlyPayment;
		return {
			...contract,
			status: "active",
		};
	});

	return {
		revenue: roundMoney(revenue),
		updatedContracts,
	};
}
