import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { REGION_CATALOG } from "../catalog/regions.js";
import { RELIABILITY_BASELINE_SCORE } from "../balance/reliability.js";
import type {
	Contract,
	ContractId,
	ContractRequirements,
	Datacenter,
	DatacenterId,
	GameState,
	PlayerId,
	RackPlacement,
	RackPlacementId,
	RegionId,
	Tick,
} from "../types.js";

export const contractIdOf = (value: string): ContractId => value as ContractId;
export const datacenterIdOf = (value: string): DatacenterId => value as DatacenterId;
export const playerIdOf = (value: string): PlayerId => value as PlayerId;
export const rackPlacementIdOf = (value: string): RackPlacementId => value as RackPlacementId;
export const tickOf = (value: number): Tick => value as Tick;

export function makePlacement(
	id: string,
	specId: keyof typeof RACK_CATALOG,
	row: number,
	position: number,
): RackPlacement {
	const spec = RACK_CATALOG[specId];
	if (!spec) {
		throw new Error(`Unknown rack spec in fixture: ${specId}`);
	}

	return {
		id: rackPlacementIdOf(id),
		specId: spec.id,
		kind: spec.kind,
		installedAtTick: tickOf(0),
		health: "healthy",
		row,
		position,
	};
}

export function makeDatacenter(
	id: string,
	placements: RackPlacement[] = [
		makePlacement(`${id}-r1`, "C2", 0, 0),
		makePlacement(`${id}-r2`, "M2", 0, 1),
		makePlacement(`${id}-r3`, "S2", 1, 0),
		makePlacement(`${id}-r4`, "G1", 1, 1),
	],
	regionId: RegionId = "us_west" as RegionId,
): Datacenter {
	const spec = DATACENTER_CATALOG.warehouse;
	if (!spec) {
		throw new Error("Test fixture: warehouse datacenter spec missing from catalog");
	}

	return {
		id: datacenterIdOf(id),
		name: `Datacenter ${id}`,
		spec,
		placements,
		builtAtTick: tickOf(0),
		regionId,
		maintenanceStaff: 0,
	};
}

export function makeRequirements(overrides: Partial<ContractRequirements> = {}): ContractRequirements {
	return {
		vCpu: 128,
		ramGb: 1_024,
		storageTb: 50,
		gpuFlops: 100,
		...overrides,
	};
}

export function makeMarketContract(id: string, overrides: Partial<Contract> = {}): Contract {
	return {
		id: contractIdOf(id),
		name: `Market ${id}`,
		requirements: makeRequirements(),
		monthlyPayment: 30_000,
		penaltyPerMonth: 12_000,
		termMonths: 6,
		lifecycleState: "market_open",
		status: "offered",
		urgency: "standard",
		tier: 1,
		offeredAtTick: tickOf(0),
		expiresAtTick: tickOf(6),
		...overrides,
	};
}

export function makeLiveContract(
	id: string,
	dcId: DatacenterId,
	overrides: Partial<Contract> = {},
): Contract {
	return {
		...makeMarketContract(id, overrides),
		lifecycleState: "serving",
		status: "active",
		startedAtTick: tickOf(0),
		acceptedAtTick: tickOf(0),
		assignedDcId: dcId,
		...overrides,
	};
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
	const datacenter = overrides.datacenters?.[0] ?? makeDatacenter("dc-1");
	const usWest = REGION_CATALOG.us_west;
	const usEast = REGION_CATALOG.us_east;
	if (!usWest || !usEast) {
		throw new Error("Test fixture: regions us_west / us_east missing from catalog");
	}

	return {
		gameId: "test-game" as GameState["gameId"],
		game: { speed: 1, paused: false },
		tick: tickOf(2),
		seed: 42,
		rngState: 42,
		difficulty: "hard",
		player: {
			id: playerIdOf("player-1"),
			name: "Player One",
			cash: 1_000_000,
			reliability: {
				score: RELIABILITY_BASELINE_SCORE,
				recentOutcomes: [],
			},
		},
		datacenters: [datacenter],
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [],
		audioEnabled: false,
		audioSettings: { master: false, music: false, sfx: false, money: false, ambient: false },
		map: { regions: [usWest, usEast] },
		...overrides,
	};
}
