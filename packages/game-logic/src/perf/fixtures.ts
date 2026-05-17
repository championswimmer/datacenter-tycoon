import { createDatacenterUpgradeProgress } from "../catalog/datacenter-upgrades.js";
import { DATACENTER_CATALOG } from "../catalog/datacenters.js";
import { regionIdsForContractAffinity } from "../catalog/regions.js";
import { RACK_CATALOG } from "../catalog/racks.js";
import { withDerivedContractViews } from "../contracts/lifecycle.js";
import { datacenterContractCapacitySummary, datacenterInstalledCapacity } from "../entities/datacenter.js";
import { summarizeDistinctCapacityPools, summarizeFabricCapacityForDatacenter } from "../entities/fabric.js";
import { generateMap } from "../sim/mapgen.js";
import { createRng } from "../sim/rng.js";
import type { Action } from "../state/reduce.js";
import type {
	Capacity,
	Contract,
	ContractId,
	ContractRegionAffinity,
	ContractRegionAffinityKey,
	Datacenter,
	DatacenterId,
	DatacenterSpec,
	DatacenterSpecId,
	DatacenterUpgradeProgress,
	GameId,
	GameState,
	LedgerEntryId,
	MapState,
	PlayerId,
	RackPlacement,
	RackPlacementId,
	RackSpec,
	RackSpecId,
	Region,
	RegionId,
	Tick,
} from "../types.js";

const DEFAULT_PLAYER_ID = "player-1" as PlayerId;
const EMPTY_CAPACITY: Capacity = {
	vCpu: 0,
	ramGb: 0,
	storageTb: 0,
	gpuFlops: 0,
};

const PERFORMANCE_FIXTURE_PROFILES = {
	small: {
		regionCount: 2,
		datacentersPerRegion: 3,
		racksPerDatacenter: 6,
		liveContractsPerDatacenter: 2,
		marketContractsPerRegion: 6,
		fabricGroupSize: 2,
		currentTick: 18,
		currentSubtick: 11,
		repairingRackFrequency: 9,
		committedCapacityRatio: 0.32,
	},
	medium: {
		regionCount: 4,
		datacentersPerRegion: 5,
		racksPerDatacenter: 18,
		liveContractsPerDatacenter: 4,
		marketContractsPerRegion: 10,
		fabricGroupSize: 3,
		currentTick: 30,
		currentSubtick: 14,
		repairingRackFrequency: 7,
		committedCapacityRatio: 0.4,
	},
	stress: {
		regionCount: 8,
		datacentersPerRegion: 8,
		racksPerDatacenter: 32,
		liveContractsPerDatacenter: 6,
		marketContractsPerRegion: 14,
		fabricGroupSize: 4,
		currentTick: 54,
		currentSubtick: 17,
		repairingRackFrequency: 5,
		committedCapacityRatio: 0.46,
	},
} as const satisfies Record<string, PerformanceFixtureProfile>;

export type PerformanceFixtureProfileName = keyof typeof PERFORMANCE_FIXTURE_PROFILES;

export interface PerformanceFixtureProfile {
	regionCount: number;
	datacentersPerRegion: number;
	racksPerDatacenter: number;
	liveContractsPerDatacenter: number;
	marketContractsPerRegion: number;
	fabricGroupSize: number;
	currentTick: number;
	currentSubtick: number;
	repairingRackFrequency: number;
	committedCapacityRatio: number;
}

export interface PerformanceFixtureOptions {
	seed?: number;
	overrides?: Partial<PerformanceFixtureProfile>;
}

export interface PerformanceFixtureTargets {
	buildDatacenter: Extract<Action, { type: "BuildDatacenter" }>;
	placeRack: Extract<Action, { type: "PlaceRack" }>;
	removeRack: Extract<Action, { type: "RemoveRack" }>;
	moveRack: Extract<Action, { type: "MoveRack" }>;
	acceptContract: Extract<Action, { type: "AcceptContract" }>;
	cancelContract: Extract<Action, { type: "CancelContract" }>;
	fabricLink: Extract<Action, { type: "FabricLink" }> | null;
	setMaintenanceStaff: Extract<Action, { type: "SetMaintenanceStaff" }>;
	primaryDatacenterId: DatacenterId;
	secondaryDatacenterId: DatacenterId;
	openContractId: ContractId;
	liveContractId: ContractId;
}

export interface PerformanceFixture {
	profileName: PerformanceFixtureProfileName | "custom";
	seed: number;
	profile: PerformanceFixtureProfile;
	state: GameState;
	targets: PerformanceFixtureTargets;
}

function gameId(value: string): GameId {
	return value as GameId;
}

function datacenterId(value: string): DatacenterId {
	return value as DatacenterId;
}

function rackPlacementId(value: string): RackPlacementId {
	return value as RackPlacementId;
}

function contractId(value: string): ContractId {
	return value as ContractId;
}

function tickValue(value: number): Tick {
	return value as Tick;
}

function ledgerEntryId(value: string): LedgerEntryId {
	return value as LedgerEntryId;
}

function pickProfile(name: PerformanceFixtureProfileName, overrides: Partial<PerformanceFixtureProfile> = {}): PerformanceFixtureProfile {
	return {
		...PERFORMANCE_FIXTURE_PROFILES[name],
		...overrides,
	};
}

function buildSelectedMap(seed: number, regionCount: number): MapState {
	const generated = generateMap(seed).regions;
	if (regionCount > generated.length) {
		throw new Error(`Performance fixtures currently support up to ${generated.length} regions, received ${regionCount}`);
	}

	const rotation = seed % generated.length;
	const regions = Array.from({ length: regionCount }, (_, index) => {
		const source = generated[(rotation + index) % generated.length]!;
		return {
			...source,
			fabric: { memberDcIds: [] },
		};
	});

	return { regions };
}

function rackSlotCount(spec: DatacenterSpec): number {
	return spec.rows * spec.positionsPerRow;
}

function selectDatacenterSpec(profile: PerformanceFixtureProfile, ordinal: number): DatacenterSpec {
	const candidates = Object.values(DATACENTER_CATALOG)
		.filter((spec) => rackSlotCount(spec) > profile.racksPerDatacenter)
		.sort((left, right) => rackSlotCount(left) - rackSlotCount(right));
	const spec = candidates[ordinal % candidates.length];
	if (!spec) {
		throw new Error(`No datacenter spec can host ${profile.racksPerDatacenter} racks with free expansion slots`);
	}
	return spec;
}

function allRackSpecs(): RackSpec[] {
	return Object.values(RACK_CATALOG).sort((left, right) => left.id.localeCompare(right.id));
}

function rackAgeTick(currentTick: number, ageMonths: number): Tick {
	return tickValue(Math.max(0, currentTick - ageMonths));
}

function buildUpgradeProgress(specId: DatacenterSpecId, fiberReady: boolean): DatacenterUpgradeProgress {
	const progress = createDatacenterUpgradeProgress(specId);
	if (fiberReady) {
		progress.currentNodeByTrack.networkType = "fiber";
	}
	return progress;
}

function buildPlacements(
	rng: ReturnType<typeof createRng>,
	profile: PerformanceFixtureProfile,
	datacenter: Pick<Datacenter, "id" | "spec">,
	ordinalOffset: number,
): RackPlacement[] {
	const specs = allRackSpecs();
	const placements: RackPlacement[] = [];

	for (let slotIndex = 0; slotIndex < profile.racksPerDatacenter; slotIndex += 1) {
		const spec = specs[(ordinalOffset + slotIndex) % specs.length]!;
		const globalRackIndex = ordinalOffset + slotIndex;
		const repairing = globalRackIndex > 0 && globalRackIndex % profile.repairingRackFrequency === 0;
		const row = Math.floor(slotIndex / datacenter.spec.positionsPerRow);
		const position = slotIndex % datacenter.spec.positionsPerRow;
		const ageMonths = Math.floor(rng.next() * Math.max(profile.currentTick, 1));
		const repairProgressDays = repairing ? Math.max(0, Math.floor(rng.next() * 12)) : undefined;
		placements.push({
			id: rackPlacementId(`rack-${datacenter.id}-${slotIndex}`),
			specId: spec.id,
			kind: spec.kind,
			installedAtTick: rackAgeTick(profile.currentTick, ageMonths),
			health: repairing ? "repairing" : "healthy",
			repairProgressDays,
			lastFailureAtTick: repairing ? tickValue(Math.max(0, profile.currentTick - 1 - (slotIndex % 3))) : undefined,
			lastFailureAtSubtick: repairing ? profile.currentSubtick : undefined,
			row,
			position,
		});
	}

	return placements;
}

function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
	let total = 0;
	for (const item of items) {
		total += pick(item);
	}
	return total;
}

function scaleCapacity(capacity: Capacity, ratio: number): Capacity {
	if (ratio <= 0) {
		return { ...EMPTY_CAPACITY };
	}

	return {
		vCpu: Math.max(0, Math.floor(capacity.vCpu * ratio)),
		ramGb: Math.max(0, Math.floor(capacity.ramGb * ratio)),
		storageTb: Math.max(0, Math.floor(capacity.storageTb * ratio)),
		gpuFlops: Math.max(0, Math.floor(capacity.gpuFlops * ratio)),
	};
}

function addCapacity(left: Capacity, right: Capacity): Capacity {
	return {
		vCpu: left.vCpu + right.vCpu,
		ramGb: left.ramGb + right.ramGb,
		storageTb: left.storageTb + right.storageTb,
		gpuFlops: left.gpuFlops + right.gpuFlops,
	};
}

function maxCapacity(left: Capacity, right: Capacity): Capacity {
	return {
		vCpu: Math.max(left.vCpu, right.vCpu),
		ramGb: Math.max(left.ramGb, right.ramGb),
		storageTb: Math.max(left.storageTb, right.storageTb),
		gpuFlops: Math.max(left.gpuFlops, right.gpuFlops),
	};
}

function weightedRequirementValue(requirements: Capacity): number {
	return requirements.vCpu * 25 + requirements.ramGb * 3 + requirements.storageTb * 35 + requirements.gpuFlops * 18;
}

function contractMoney(requirements: Capacity, multiplier: number): number {
	const value = weightedRequirementValue(requirements);
	return Math.max(1_000, Math.round((value * multiplier) / 100) * 100);
}

function affinityForRegion(regionId: RegionId, availableRegions: readonly Region[]): ContractRegionAffinity | undefined {
	const affinityKeys: readonly ContractRegionAffinityKey[] = ["usa", "eu", "asia"];
	for (const key of affinityKeys) {
		const allowedRegionIds = regionIdsForContractAffinity(key, availableRegions);
		if (allowedRegionIds.includes(regionId)) {
			return {
				key,
				allowedRegionIds,
			};
		}
	}
	return undefined;
}

function buildDatacenters(
	rng: ReturnType<typeof createRng>,
	profile: PerformanceFixtureProfile,
	map: MapState,
): Datacenter[] {
	return map.regions.flatMap((region, regionIndex) =>
		Array.from({ length: profile.datacentersPerRegion }, (_, dcIndex) => {
			const ordinal = regionIndex * profile.datacentersPerRegion + dcIndex;
			const spec = selectDatacenterSpec(profile, ordinal);
			const fiberReady = dcIndex <= profile.fabricGroupSize;
			const id = datacenterId(`dc-${region.id}-${dcIndex + 1}`);
			return {
				id,
				name: `${spec.name} ${regionIndex + 1}-${dcIndex + 1}`,
				spec,
				placements: buildPlacements(rng, profile, { id, spec }, ordinal * profile.racksPerDatacenter),
				builtAtTick: rackAgeTick(profile.currentTick, 1 + ((ordinal + regionIndex) % 12)),
				regionId: region.id,
				maintenanceStaff: 1 + ((ordinal + dcIndex) % 4),
				upgrades: buildUpgradeProgress(spec.id, fiberReady),
			} satisfies Datacenter;
		}),
	);
}

function attachRegionUsage(map: MapState, datacenters: readonly Datacenter[]): MapState {
	const usageByRegion = new Map<RegionId, { power: number; staff: number }>();
	for (const datacenter of datacenters) {
		const current = usageByRegion.get(datacenter.regionId) ?? { power: 0, staff: 0 };
		usageByRegion.set(datacenter.regionId, {
			power: current.power + datacenter.spec.powerCapacityKw,
			staff: current.staff + datacenter.spec.staffCount,
		});
	}

	return {
		regions: map.regions.map((region) => {
			const usage = usageByRegion.get(region.id) ?? { power: 0, staff: 0 };
			return {
				...region,
				powerUsed: usage.power,
				staffUsed: usage.staff,
				totalPowerAvailable: Math.max(region.totalPowerAvailable, usage.power * 2 + 2_500),
				totalStaffAvailable: Math.max(region.totalStaffAvailable, usage.staff * 2 + 120),
			};
		}),
	};
}

function attachRegionFabric(map: MapState, datacenters: readonly Datacenter[], profile: PerformanceFixtureProfile): MapState {
	return {
		regions: map.regions.map((region) => {
			const regionDatacenters = datacenters.filter((datacenter) => datacenter.regionId === region.id);
			const memberDcIds = regionDatacenters.slice(0, Math.min(profile.fabricGroupSize, regionDatacenters.length)).map((datacenter) => datacenter.id);
			return {
				...region,
				fabric: { memberDcIds },
			};
		}),
	};
}

function buildLiveContracts(
	profile: PerformanceFixtureProfile,
	datacenters: readonly Datacenter[],
): Contract[] {
	const contracts: Contract[] = [];

	for (const [dcIndex, datacenter] of datacenters.entries()) {
		const usableCapacity = datacenterInstalledCapacity(datacenter);
		const perContractRatio = profile.committedCapacityRatio / Math.max(profile.liveContractsPerDatacenter, 1);
		for (let contractIndex = 0; contractIndex < profile.liveContractsPerDatacenter; contractIndex += 1) {
			const requirements = scaleCapacity(usableCapacity, perContractRatio * (0.85 + ((contractIndex % 3) * 0.1)));
			const monthlyPayment = contractMoney(requirements, 1.25);
			contracts.push({
				id: contractId(`live-${datacenter.id}-${contractIndex + 1}`),
				name: `Live ${datacenter.name} ${contractIndex + 1}`,
				requirements,
				monthlyPayment,
				penaltyPerMonth: Math.round(monthlyPayment * 0.45),
				termMonths: 6 + ((dcIndex + contractIndex) % 4) * 3,
				slaTargetPercent: contractIndex % 3 === 0 ? 80 : contractIndex % 3 === 1 ? 90 : 95,
				currentSlaWindow: {
					sampledDays: profile.currentSubtick,
					servedDays: Math.max(0, profile.currentSubtick - (contractIndex % 2)),
					failedDays: contractIndex % 2,
				},
				lifecycleState: contractIndex % 4 === 3 ? "breached" : "serving",
				status: contractIndex % 4 === 3 ? "breached" : "active",
				urgency: contractIndex % 5 === 4 ? "anchor" : contractIndex % 2 === 0 ? "standard" : "rush",
				tier: ((contractIndex % 3) + 1) as Contract["tier"],
				offeredAtTick: tickValue(Math.max(0, profile.currentTick - 3)),
				expiresAtTick: tickValue(profile.currentTick + 6),
				startedAtTick: tickValue(Math.max(0, profile.currentTick - (contractIndex % 4))),
				acceptedAtTick: tickValue(Math.max(0, profile.currentTick - (contractIndex % 4))),
				assignedDcId: datacenter.id,
			});
		}
	}

	return contracts;
}

function findMaxMemberAvailable(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
	memberDcIds: readonly DatacenterId[],
): Capacity {
	let largest = { ...EMPTY_CAPACITY };
	for (const memberDcId of memberDcIds) {
		largest = maxCapacity(largest, summarizeFabricCapacityForDatacenter(state, memberDcId).local.available);
	}
	return largest;
}

function buildMarketContracts(
	profile: PerformanceFixtureProfile,
	state: Pick<GameState, "tick" | "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
): Contract[] {
	const pools = summarizeDistinctCapacityPools(state);
	const marketContracts: Contract[] = [];
	const totalOffers = profile.regionCount * profile.marketContractsPerRegion;

	for (let offerIndex = 0; offerIndex < totalOffers; offerIndex += 1) {
		const pool = pools[offerIndex % pools.length]!;
		const anchorDc = state.datacenters.find((datacenter) => datacenter.id === pool.anchorDcId);
		if (!anchorDc) {
			throw new Error(`Unknown anchor datacenter in performance fixture pool: ${pool.anchorDcId}`);
		}
		const mode = offerIndex % 3;
		const maxMemberAvailable = findMaxMemberAvailable(state, pool.memberDcIds);
		const partialRequirement = {
			vCpu: Math.min(pool.available.vCpu, maxMemberAvailable.vCpu + Math.max(8, Math.floor(pool.available.vCpu * 0.1))),
			ramGb: Math.min(pool.available.ramGb, maxMemberAvailable.ramGb + Math.max(16, Math.floor(pool.available.ramGb * 0.1))),
			storageTb: Math.min(pool.available.storageTb, maxMemberAvailable.storageTb + Math.max(4, Math.floor(pool.available.storageTb * 0.08))),
			gpuFlops: Math.min(pool.available.gpuFlops, maxMemberAvailable.gpuFlops + Math.max(50, Math.floor(pool.available.gpuFlops * 0.12))),
		};
		const requirements =
			mode === 0
				? scaleCapacity(pool.connected ? pool.available : maxMemberAvailable, 0.2)
				: mode === 1
					? partialRequirement
					: addCapacity(pool.available, {
						vCpu: Math.max(8, Math.floor(pool.available.vCpu * 0.2)),
						ramGb: Math.max(16, Math.floor(pool.available.ramGb * 0.2)),
						storageTb: Math.max(4, Math.floor(pool.available.storageTb * 0.15)),
						gpuFlops: Math.max(50, Math.floor(pool.available.gpuFlops * 0.2)),
					});
		const affinity = offerIndex % 4 === 0 ? affinityForRegion(anchorDc.regionId, state.map.regions) : undefined;
		const monthlyPayment = contractMoney(requirements, mode === 2 ? 1.45 : 1.15);
		marketContracts.push({
			id: contractId(`market-${offerIndex + 1}`),
			name: `Market Contract ${offerIndex + 1}`,
			requirements,
			monthlyPayment,
			penaltyPerMonth: Math.round(monthlyPayment * 0.4),
			termMonths: 3 + (offerIndex % 5) * 3,
			slaTargetPercent: mode === 2 ? 95 : mode === 1 ? 90 : 80,
			currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
			lifecycleState: "market_open",
			status: "offered",
			urgency: mode === 2 ? "anchor" : mode === 1 ? "rush" : "standard",
			tier: ((offerIndex % 3) + 1) as Contract["tier"],
			regionAffinity: affinity,
			offeredAtTick: state.tick,
			expiresAtTick: tickValue(state.tick + 6 + (offerIndex % 4)),
		});
	}

	return marketContracts;
}

function findFirstEmptySlot(datacenter: Datacenter): { row: number; position: number } {
	for (let row = 0; row < datacenter.spec.rows; row += 1) {
		for (let position = 0; position < datacenter.spec.positionsPerRow; position += 1) {
			if (!datacenter.placements.some((placement) => placement.row === row && placement.position === position)) {
				return { row, position };
			}
		}
	}

	throw new Error(`Datacenter ${datacenter.id} has no empty slots for a performance fixture action target`);
}

function buildTargets(state: GameState): PerformanceFixtureTargets {
	const garageSpec = DATACENTER_CATALOG.garage;
	const c0Rack = RACK_CATALOG.C0;
	if (!garageSpec || !c0Rack) {
		throw new Error("Performance fixtures require the garage datacenter and C0 rack catalog entries");
	}

	const primaryDatacenter = state.datacenters[0];
	const secondaryDatacenter =
		state.datacenters.find((candidate) => candidate.regionId === primaryDatacenter?.regionId && candidate.id !== primaryDatacenter.id) ?? state.datacenters[1];
	if (!primaryDatacenter || !secondaryDatacenter) {
		throw new Error("Performance fixture requires at least two datacenters");
	}

	const primaryContracts = state.contracts.filter((contract) => contract.assignedDcId === primaryDatacenter.id);
	const liveContract = primaryContracts.find((contract) => contract.lifecycleState === "serving" || contract.lifecycleState === "breached");
	if (!liveContract) {
		throw new Error(`No live contract found for primary datacenter ${primaryDatacenter.id}`);
	}

	const openContract = state.contracts.find((contract) => contract.lifecycleState === "market_open");
	if (!openContract) {
		throw new Error("No open market contract found in performance fixture state");
	}

	const removablePlacement = primaryDatacenter.placements[0];
	const movablePlacement = primaryDatacenter.placements[1] ?? primaryDatacenter.placements[0];
	if (!removablePlacement || !movablePlacement) {
		throw new Error(`Primary datacenter ${primaryDatacenter.id} needs at least one rack placement`);
	}

	const placePosition = findFirstEmptySlot(primaryDatacenter);
	const movePosition = findFirstEmptySlot(secondaryDatacenter);
	const buildRegionId = state.map.regions[0]?.id;
	if (!buildRegionId) {
		throw new Error("Performance fixture requires at least one region");
	}

	const fabricLinkPair = state.map.regions
		.map((region) => {
			const memberSet = new Set(region.fabric?.memberDcIds ?? []);
			const source = region.fabric?.memberDcIds[0];
			const target = state.datacenters.find(
				(datacenter) => datacenter.regionId === region.id && !memberSet.has(datacenter.id) && datacenter.upgrades?.currentNodeByTrack.networkType === "fiber",
			)?.id;
			return source && target ? { sourceDcId: source, targetDcId: target } : null;
		})
		.find((pair) => pair !== null) ?? null;

	return {
		buildDatacenter: {
			type: "BuildDatacenter",
			specId: garageSpec.id,
			dcId: datacenterId(`bench-build-${buildRegionId}`),
			regionId: buildRegionId,
		},
		placeRack: {
			type: "PlaceRack",
			dcId: primaryDatacenter.id,
			specId: c0Rack.id,
			row: placePosition.row,
			position: placePosition.position,
			placementId: rackPlacementId(`bench-place-${primaryDatacenter.id}`),
		},
		removeRack: {
			type: "RemoveRack",
			dcId: primaryDatacenter.id,
			placementId: removablePlacement.id,
		},
		moveRack: {
			type: "MoveRack",
			dcId: primaryDatacenter.id,
			placementId: movablePlacement.id,
			targetDcId: secondaryDatacenter.id,
			row: movePosition.row,
			position: movePosition.position,
		},
		acceptContract: {
			type: "AcceptContract",
			contractId: openContract.id,
			dcId: primaryDatacenter.id,
		},
		cancelContract: {
			type: "CancelContract",
			contractId: liveContract.id,
		},
		fabricLink: fabricLinkPair
			? {
					type: "FabricLink",
					sourceDcId: fabricLinkPair.sourceDcId,
					targetDcId: fabricLinkPair.targetDcId,
			  }
			: null,
		setMaintenanceStaff: {
			type: "SetMaintenanceStaff",
			dcId: primaryDatacenter.id,
			maintenanceStaff: primaryDatacenter.maintenanceStaff + 1,
		},
		primaryDatacenterId: primaryDatacenter.id,
		secondaryDatacenterId: secondaryDatacenter.id,
		openContractId: openContract.id,
		liveContractId: liveContract.id,
	};
}

function buildBaseState(seed: number, profile: PerformanceFixtureProfile): GameState {
	const rng = createRng(seed);
	const baseMap = buildSelectedMap(seed, profile.regionCount);
	const datacenters = buildDatacenters(rng, profile, baseMap);
	const mapWithUsage = attachRegionUsage(baseMap, datacenters);
	const map = attachRegionFabric(mapWithUsage, datacenters, profile);

	return {
		gameId: gameId(`perf-${seed}`),
		game: {
			speed: 1,
			paused: false,
		},
		tick: tickValue(profile.currentTick),
		subtick: profile.currentSubtick,
		seed,
		rngState: rng.state(),
		difficulty: "hard",
		player: {
			id: DEFAULT_PLAYER_ID,
			name: "Performance Fixture Player",
			cash: 500_000_000,
			reliability: {
				score: 72,
				recentOutcomes: [],
			},
		},
		datacenters,
		contracts: [],
		contractMarket: [],
		activeContracts: [],
		ledger: [
			{
				id: ledgerEntryId(`ledger-${seed}-0`),
				tick: tickValue(Math.max(0, profile.currentTick - 1)),
				type: "adjustment",
				amount: 0,
				reason: "Performance fixture seed checkpoint",
			},
		],
		audioEnabled: true,
		audioSettings: {
			master: true,
			music: true,
			sfx: true,
			money: true,
			ambient: true,
		},
		map,
	};
}

export function createPerformanceFixtureProfile(
	profileName: PerformanceFixtureProfileName,
	overrides: Partial<PerformanceFixtureProfile> = {},
): PerformanceFixtureProfile {
	return pickProfile(profileName, overrides);
}

export function createPerformanceFixture(
	profileName: PerformanceFixtureProfileName,
	options: PerformanceFixtureOptions = {},
): PerformanceFixture {
	const seed = options.seed ?? 1337;
	const profile = createPerformanceFixtureProfile(profileName, options.overrides);
	const baseState = buildBaseState(seed, profile);
	const liveContracts = buildLiveContracts(profile, baseState.datacenters);
	const stateWithLiveContracts = withDerivedContractViews({
		...baseState,
		contracts: liveContracts,
	});
	const marketContracts = buildMarketContracts(profile, stateWithLiveContracts);
	const state = withDerivedContractViews({
		...stateWithLiveContracts,
		contracts: [...stateWithLiveContracts.contracts, ...marketContracts],
	});
	const targets = buildTargets(state);

	return {
		profileName,
		seed,
		profile,
		state,
		targets,
	};
}

export function createCustomPerformanceFixture(
	profile: PerformanceFixtureProfile,
	options: Omit<PerformanceFixtureOptions, "overrides"> = {},
): PerformanceFixture {
	const seed = options.seed ?? 1337;
	const normalizedProfile: PerformanceFixtureProfile = { ...profile };
	const baseState = buildBaseState(seed, normalizedProfile);
	const liveContracts = buildLiveContracts(normalizedProfile, baseState.datacenters);
	const stateWithLiveContracts = withDerivedContractViews({
		...baseState,
		contracts: liveContracts,
	});
	const marketContracts = buildMarketContracts(normalizedProfile, stateWithLiveContracts);
	const state = withDerivedContractViews({
		...stateWithLiveContracts,
		contracts: [...stateWithLiveContracts.contracts, ...marketContracts],
	});
	return {
		profileName: "custom",
		seed,
		profile: normalizedProfile,
		state,
		targets: buildTargets(state),
	};
}

export function summarizePerformanceFixture(fixture: PerformanceFixture) {
	return {
		profileName: fixture.profileName,
		seed: fixture.seed,
		regionCount: fixture.state.map.regions.length,
		datacenterCount: fixture.state.datacenters.length,
		rackCount: sumBy(fixture.state.datacenters, (datacenter) => datacenter.placements.length),
		contractCount: fixture.state.contracts.length,
		liveContractCount: fixture.state.activeContracts.filter((contract) => contract.lifecycleState === "serving" || contract.lifecycleState === "breached").length,
		marketContractCount: fixture.state.contractMarket.length,
		fabricPools: summarizeDistinctCapacityPools(fixture.state).length,
		primaryCapacitySummary: datacenterContractCapacitySummary(
			fixture.state.datacenters[0]!,
			fixture.state.activeContracts,
		),
	};
}

export { PERFORMANCE_FIXTURE_PROFILES };
