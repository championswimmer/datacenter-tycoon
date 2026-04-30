export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Money = number;
export type Tick = number;
export type Time = Tick;

export type PlayerId = Brand<string, "PlayerId">;
export type DatacenterId = Brand<string, "DatacenterId">;
export type DatacenterSpecId = Brand<string, "DatacenterSpecId">;
export type RackSpecId = Brand<string, "RackSpecId">;
export type RackPlacementId = Brand<string, "RackPlacementId">;
export type ContractId = Brand<string, "ContractId">;
export type LedgerEntryId = Brand<string, "LedgerEntryId">;

export type RackKind = "compute" | "memory" | "storage" | "gpu";
export type RackTier = 1 | 2 | 3;
export type CoolingType = "air" | "liquid";
export type ContractStatus = "offered" | "active" | "breached" | "completed" | "cancelled";
export type LedgerEntryType = "capex" | "opex" | "revenue" | "penalty" | "adjustment";

export interface Capacity {
	vCpu: number;
	ramGb: number;
	storageTb: number;
	gpuFlops: number;
}

export interface GridPosition {
	row: number;
	position: number;
}

export interface DatacenterGrid {
	rows: number;
	positionsPerRow: number;
	totalSlots: number;
}

export interface RackSpec {
	id: RackSpecId;
	name: string;
	kind: RackKind;
	tier: RackTier;
	vCpu: number;
	ramGb: number;
	storageTb: number;
	gpuFlops: number;
	powerDrawKw: number;
	heatOutputBtuPerHr: number;
	bandwidthGbps: number;
	capexCost: Money;
	monthlyMaintenance: Money;
}

export interface Rack {
	id: RackPlacementId;
	specId: RackSpecId;
	kind: RackKind;
	installedAtTick: Tick;
}

export interface RackPlacement extends Rack, GridPosition {}

export interface DatacenterSpec {
	id: DatacenterSpecId;
	name: string;
	rows: number;
	positionsPerRow: number;
	powerCapacityKw: number;
	coolingCapacityBtuPerHr: number;
	coolingType: CoolingType;
	bandwidthGbps: number;
	capexCost: Money;
	monthlyStaffCost: Money;
}

export interface Datacenter {
	id: DatacenterId;
	name: string;
	spec: DatacenterSpec;
	placements: RackPlacement[];
	builtAtTick: Tick;
}

export interface ContractRequirements extends Capacity {}

export interface Contract {
	id: ContractId;
	name: string;
	requirements: ContractRequirements;
	monthlyPayment: Money;
	penaltyPerMonth: Money;
	termMonths: number;
	status: ContractStatus;
	offeredAtTick: Tick;
	expiresAtTick: Tick;
	startedAtTick?: Tick;
	assignedDcId?: DatacenterId;
}

export interface Player {
	id: PlayerId;
	name: string;
	cash: Money;
}

export interface LedgerEntry {
	id: LedgerEntryId;
	tick: Tick;
	type: LedgerEntryType;
	amount: Money;
	reason: string;
}

export interface DatacenterResourceUsage {
	powerKw: number;
	heatOutputBtuPerHr: number;
	bandwidthGbps: number;
	slotsUsed: number;
}

export type PlacementFailureReason =
	| "slot_taken"
	| "out_of_bounds"
	| "insufficient_power"
	| "insufficient_cooling"
	| "insufficient_bandwidth"
	| "cooling_type_mismatch";

export type CanPlaceRackResult =
	| { ok: true }
	| {
			ok: false;
			reason: PlacementFailureReason;
	  };

export interface OpexBreakdown {
	power: Money;
	cooling: Money;
	bandwidth: Money;
	staff: Money;
	maintenance: Money;
}

export interface OpexTickResult {
	total: Money;
	breakdown: OpexBreakdown;
}

export interface RevenueTickResult {
	revenue: Money;
	updatedContracts: Contract[];
}

export interface RngState {
	seed: number;
	state: number;
}

export interface GameState {
	tick: Tick;
	seed: number;
	rngState: number;
	player: Player;
	datacenters: Datacenter[];
	contractMarket: Contract[];
	activeContracts: Contract[];
	ledger: LedgerEntry[];
}
