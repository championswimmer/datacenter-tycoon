export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Money = number;
export type Tick = number;
export type Subtick = number;
export type Time = Tick;

export interface GameTimePoint {
	tick: Tick;
	subtick: Subtick;
}

export interface GameTimeView extends GameTimePoint {
	dayOfMonth: number;
	monthFraction: number;
}

export type PlayerId = Brand<string, "PlayerId">;
export type DatacenterId = Brand<string, "DatacenterId">;
export type DatacenterSpecId = Brand<string, "DatacenterSpecId">;
export type RackSpecId = Brand<string, "RackSpecId">;
export type RackPlacementId = Brand<string, "RackPlacementId">;
export type ContractId = Brand<string, "ContractId">;
export type LedgerEntryId = Brand<string, "LedgerEntryId">;
export type GameId = Brand<string, "GameId">;
export type RegionId = Brand<string, "RegionId">;

export type RackKind = "compute" | "memory" | "storage" | "gpu";
export type RackTier = 0 | 1 | 2 | 3;
export type CoolingType = "air" | "hybrid" | "liquid";
export type DatacenterNetworkType = "cat6" | "cat8" | "fiber";
export type ContractLifecycleState =
	| "market_open"
	| "market_expired"
	| "serving"
	| "breached"
	| "cancelled"
	| "completed";
/** @deprecated Use `Contract.lifecycleState` instead. */
export type ContractStatus = "offered" | "active" | "breached" | "expired" | "cancelled";
export type ContractUrgency = "standard" | "rush" | "anchor";
export type ContractTier = 1 | 2 | 3;
export type ContractRegionAffinityKey = "eu" | "asia" | "usa";
export type ContractSlaTargetPercent = 80 | 90 | 95;
export type LedgerEntryType = "capex" | "opex" | "revenue" | "penalty" | "adjustment";
export type RackHealthStatus = "healthy" | "repairing";
export type ReliabilityBand = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type ContractSlaOutcomeKind = "fulfilled" | "breached" | "cancelled";
export type Difficulty = "easy" | "hard";

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
	health: RackHealthStatus;
	repairProgressDays?: number;
	lastFailureAtTick?: Tick;
	lastFailureAtSubtick?: Subtick;
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
	networkType: DatacenterNetworkType;
	bandwidthGbps: number;
	capexCost: Money;
	staffCount: number;
}

export interface DatacenterInfrastructureProfile {
	gridImportCapacityKw: number;
	onsiteGenerationCapacityKw: number;
	rackPowerCapacityKw: number;
	coolingCapacityBtuPerHr: number;
	coolingType: CoolingType;
	networkType: DatacenterNetworkType;
	bandwidthGbps: number;
}

export type DatacenterUpgradeTrackId = "cooling" | "networkType" | "onsiteGeneration";
export type DatacenterUpgradeTrackPresentation = "level" | "slots";

export interface DatacenterUpgradeTrackNode {
	id: string;
	label: string;
	capexCost: Money;
	opex: {
		fixedMonthly?: Money;
	};
	infrastructure: Partial<Pick<DatacenterInfrastructureProfile, "coolingType" | "coolingCapacityBtuPerHr" | "networkType" | "bandwidthGbps" | "onsiteGenerationCapacityKw">>;
}

export interface DatacenterUpgradeTrackDefinition {
	id: DatacenterUpgradeTrackId;
	label: string;
	presentation: DatacenterUpgradeTrackPresentation;
	nodes: readonly DatacenterUpgradeTrackNode[];
}

export interface DatacenterUpgradeProgress {
	currentNodeByTrack: Record<DatacenterUpgradeTrackId, string>;
}

export interface Datacenter {
	id: DatacenterId;
	name: string;
	spec: DatacenterSpec;
	placements: RackPlacement[];
	builtAtTick: Tick;
	regionId: RegionId;
	maintenanceStaff: number;
	upgrades?: DatacenterUpgradeProgress;
}

export interface ContractRequirements extends Capacity {}

export interface ContractRegionAffinity {
	key: ContractRegionAffinityKey;
	allowedRegionIds: RegionId[];
}

export interface ContractSlaWindow {
	sampledDays: number;
	servedDays: number;
	failedDays: number;
}

export interface Contract {
	id: ContractId;
	name: string;
	requirements: ContractRequirements;
	monthlyPayment: Money;
	penaltyPerMonth: Money;
	termMonths: number;
	slaTargetPercent: ContractSlaTargetPercent;
	currentSlaWindow: ContractSlaWindow;
	lifecycleState: ContractLifecycleState;
	/** @deprecated Temporary compatibility bridge for legacy consumers. */
	status: ContractStatus;
	urgency: ContractUrgency;
	tier: ContractTier;
	regionAffinity?: ContractRegionAffinity;
	offeredAtTick: Tick;
	expiresAtTick: Tick;
	startedAtTick?: Tick;
	acceptedAtTick?: Tick;
	closedAtTick?: Tick;
	breachStreakMonths?: number;
	assignedDcId?: DatacenterId;
}

export interface ContractSlaOutcome {
	contractId: ContractId;
	contractName: string;
	tick: Tick;
	kind: ContractSlaOutcomeKind;
}

export interface PlayerReliability {
	score: number;
	lastDelta?: number;
	recentOutcomes: ContractSlaOutcome[];
}

export interface Player {
	id: PlayerId;
	name: string;
	cash: Money;
	reliability: PlayerReliability;
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

export type RackActivityStatus = "idle" | "active" | "repairing";

export interface RackActivityView {
	placementId: RackPlacementId;
	specId: RackSpecId;
	kind: RackKind;
	status: RackActivityStatus;
	reservedPowerKw: number;
	billedPowerKw: number;
}

export interface RackPowerSummary {
	reservedPowerKw: number;
	idleBaselinePowerKw: number;
	activePowerKw: number;
	billedPowerKw: number;
	activeRackCount: number;
	idleRackCount: number;
	repairingRackCount: number;
	totalRackCount: number;
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
	upgrades: Money;
	tax: Money;
}

export interface OpexTickResult {
	total: Money;
	breakdown: OpexBreakdown;
}

export interface RevenueTickResult {
	revenue: Money;
	perDcRevenue: Record<DatacenterId, Money>;
	updatedContracts: Contract[];
}

export interface RngState {
	seed: number;
	state: number;
}

export interface AudioSettings {
	master: boolean;
	music: boolean;
	sfx: boolean; // Datacenter events
	money: boolean; // Revenue/Opex
	ambient: boolean; // Server hum
}

export interface RegionFabric {
	memberDcIds: DatacenterId[];
}

export interface Region {
	id: RegionId;
	name: string;
	code: string;
	city: string;
	coordinates: { x: number; y: number };
	powerCostPerKwh: number;
	staffWage: Money;
	taxRate: number;
	totalPowerAvailable: number;
	totalStaffAvailable: number;
	powerUsed: number;
	staffUsed: number;
	fabric?: RegionFabric;
}

export interface MapState {
	regions: Region[];
}

export interface GameState {
	gameId: GameId;
	game: {
		speed: number;
		paused: boolean;
	};
	tick: Tick;
	subtick: Subtick;
	seed: number;
	rngState: number;
	difficulty: Difficulty;
	player: Player;
	datacenters: Datacenter[];
	contracts: Contract[];
	/** @deprecated Use lifecycle selectors over `contracts`. */
	contractMarket: Contract[];
	/** @deprecated Use lifecycle selectors over `contracts`. */
	activeContracts: Contract[];
	ledger: LedgerEntry[];
	audioEnabled: boolean;
	audioSettings: AudioSettings;
	map: MapState;
}
