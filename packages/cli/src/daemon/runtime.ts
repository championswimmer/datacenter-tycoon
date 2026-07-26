import { EventEmitter } from "node:events";

import {
	DATACENTER_CATALOG,
	DAYS_PER_TICK,
	RACK_CATALOG,
	datacenterUsage,
	rackFailureRiskView,
	reduce,
	selectDatacenterMaintenanceStaffingViewFromState,
	selectHistoricalContractsFromState,
	selectLiveContractsFromState,
	selectOpenMarketContractsFromState,
	summarizeDatacenterCapacityFromState,
	summarizeDatacenterInfrastructureFromState,
	summarizeDatacenterUpgradeViewFromState,
	VERSION,
	type Datacenter,
	type GameState,
	type RackSpec,
} from "@datacenter-tycoon/game-logic";
import {
	appendVerificationAction,
	createInitialVerifiedRunState,
	createVerifiedRunController,
	type CliVerifiedRunController,
	type CliVerifiedRunState,
} from "../online/verified-run.js";

import type {
	Action,
	DatacenterListItem,
	LedgerEvent,
	ListQuery,
	ListResult,
	QueryParams,
	QueryResult,
	RuntimeStatus,
	StateEvent,
	StatusView,
	SubtickEvent,
	SubscriptionEvent,
	TickEvent,
} from "../protocol/messages.js";

export interface IntervalScheduler {
	setInterval(callback: () => void, delayMs: number): unknown;
	clearInterval(handle: unknown): void;
}

export interface GameRuntimeOptions {
	state: GameState;
	verificationState?: CliVerifiedRunState;
	initialSpeedTps?: number;
	paused?: boolean;
	scheduler?: IntervalScheduler;
}

interface GameRuntimeEventMap {
	state: [event: StateEvent];
	subtick: [event: SubtickEvent];
	tick: [event: TickEvent];
	ledger: [event: LedgerEvent];
	status: [status: RuntimeStatus];
}

const DEFAULT_SPEED_TPS = 1;

const defaultScheduler: IntervalScheduler = {
	setInterval: (callback, delayMs) => globalThis.setInterval(callback, delayMs),
	clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>),
};

function assertValidSpeed(ticksPerSecond: number): void {
	if (!Number.isFinite(ticksPerSecond) || ticksPerSecond < 0) {
		throw new Error(`Invalid tick speed: ${ticksPerSecond}`);
	}
}

function totalRackCount(datacenters: Datacenter[]): number {
	return datacenters.reduce((count, datacenter) => count + datacenter.placements.length, 0);
}

function createStatusView(state: GameState, runtimeStatus: RuntimeStatus): StatusView {
	return {
		tick: state.tick,
		subtick: state.subtick,
		dayOfMonth: state.subtick + 1,
		cash: state.player.cash,
		difficulty: state.difficulty,
		datacenterCount: state.datacenters.length,
		rackCount: totalRackCount(state.datacenters),
		activeContractCount: selectLiveContractsFromState(state).length,
		marketContractCount: selectOpenMarketContractsFromState(state).length,
		...runtimeStatus,
	};
}

function createDatacenterList(state: GameState): DatacenterListItem[] {
	return state.datacenters.map((datacenter) => {
		const capacitySummary = summarizeDatacenterCapacityFromState(state, datacenter.id);
		const infrastructure = summarizeDatacenterInfrastructureFromState(state, datacenter.id);
		const upgrades = summarizeDatacenterUpgradeViewFromState(state, datacenter.id);
		const usage = datacenterUsage(datacenter);

		return {
			datacenter,
			capacity: capacitySummary.installed,
			capacitySummary,
			infrastructure,
			upgrades,
			powerKw: usage.powerKw,
			powerCapacityKw: infrastructure.effective.rackPowerCapacityKw,
			heatOutputBtuPerHr: usage.heatOutputBtuPerHr,
			coolingCapacityBtuPerHr: infrastructure.effective.coolingCapacityBtuPerHr,
			bandwidthGbps: usage.bandwidthGbps,
			bandwidthCapacityGbps: infrastructure.effective.bandwidthGbps,
			slotsUsed: usage.slotsUsed,
			totalSlots: datacenter.spec.rows * datacenter.spec.positionsPerRow,
			maintenance: selectDatacenterMaintenanceStaffingViewFromState(state, datacenter.id),
		};
	});
}

function getDatacenter(state: GameState, dcId: string): Datacenter {
	const datacenter = state.datacenters.find((candidate) => candidate.id === dcId);
	if (!datacenter) {
		throw new Error(`Unknown datacenter: ${dcId}`);
	}

	return datacenter;
}

function getRackSpec(specId: string): RackSpec {
	const spec = RACK_CATALOG[specId];
	if (!spec) {
		throw new Error(`Unknown rack spec: ${specId}`);
	}

	return spec;
}

function assertNever(value: never, context: string): never {
	throw new Error(`${context}: ${JSON.stringify(value)}`);
}

function createListResult(state: GameState, query: ListQuery): ListResult {
	switch (query.target) {
		case "datacenters":
			return { kind: "datacenters", items: createDatacenterList(state) };
		case "racks": {
			if (!query.dcId) {
				throw new Error("dcId is required when listing racks");
			}

			const datacenter = getDatacenter(state, query.dcId);
			return {
				kind: "racks",
				dcId: query.dcId,
				items: datacenter.placements.map((placement) => {
					const riskView = rackFailureRiskView(state.tick, placement);
					return {
						dcId: datacenter.id,
						dcName: datacenter.name,
						placementId: placement.id,
						spec: getRackSpec(placement.specId),
						row: placement.row,
						position: placement.position,
						installedAtTick: placement.installedAtTick,
						health: riskView.health,
						ageMonths: riskView.ageMonths,
						failureProbability: riskView.failureProbability,
					};
				}),
			};
		}
		case "market-contracts":
			return { kind: "market-contracts", items: selectOpenMarketContractsFromState(state) };
		case "active-contracts":
			return { kind: "active-contracts", items: selectLiveContractsFromState(state) };
		case "contracts":
			return {
				kind: "contracts",
				market: selectOpenMarketContractsFromState(state),
				active: selectLiveContractsFromState(state),
				history: selectHistoricalContractsFromState(state),
			};
		default:
			return assertNever(query.target, "Unsupported list target");
	}
}

export class GameRuntime extends EventEmitter<GameRuntimeEventMap> {
	private state: GameState;
	private readonly verification: CliVerifiedRunController;
	private readonly scheduler: IntervalScheduler;
	private speedTps: number;
	private lastActiveSpeedTps: number;
	private paused: boolean;
	private timerHandle?: unknown;
	private started = false;

	constructor(options: GameRuntimeOptions) {
		super();
		const initialSpeedTps = options.initialSpeedTps ?? DEFAULT_SPEED_TPS;
		assertValidSpeed(initialSpeedTps);

		this.state = options.state;
		this.verification = createVerifiedRunController(
			options.verificationState ?? createInitialVerifiedRunState(options.state),
		);
		this.scheduler = options.scheduler ?? defaultScheduler;
		this.speedTps = initialSpeedTps;
		this.lastActiveSpeedTps = initialSpeedTps > 0 ? initialSpeedTps : DEFAULT_SPEED_TPS;
		this.paused = options.paused ?? false;
	}

	start(): this {
		if (this.started) {
			return this;
		}

		this.started = true;
		this.syncTimer();
		return this;
	}

	stop(): void {
		this.started = false;
		this.clearTimer();
	}

	dispatch(action: Action): GameState {
		const previousState = this.state;
		const nextState = reduce(previousState, action);
		const newLedgerEntries = nextState.ledger.slice(previousState.ledger.length);

		this.state = nextState;
		this.verification.update((current) => appendVerificationAction(current, action));

		if (nextState.tick !== previousState.tick) {
			this.emit("tick", { type: "tick", tick: nextState.tick });
		} else if (nextState.subtick !== previousState.subtick) {
			this.emit("subtick", {
				type: "subtick",
				tick: nextState.tick,
				subtick: nextState.subtick,
				dayOfMonth: nextState.subtick + 1,
			});
		}

		if (newLedgerEntries.length > 0) {
			this.emit("ledger", {
				type: "ledger",
				tick: nextState.tick,
				entries: newLedgerEntries,
			});
		}

		this.emit("state", {
			type: "state",
			tick: nextState.tick,
			snapshot: nextState,
			...this.getRuntimeStatus(),
		});

		return nextState;
	}

	query(query: QueryParams): QueryResult {
		switch (query.kind) {
			case "snapshot":
				return this.getSnapshot();
			case "verification":
				return this.getVerificationState();
			case "status":
				return this.getStatus();
			case "list":
				return createListResult(this.state, query);
			case "catalog":
				return query.target === "datacenters"
					? { kind: "datacenters", items: Object.values(DATACENTER_CATALOG) }
					: { kind: "racks", items: Object.values(RACK_CATALOG) };
			default:
				return assertNever(query, "Unsupported query kind");
		}
	}

	setSpeed(ticksPerSecond: number): RuntimeStatus {
		assertValidSpeed(ticksPerSecond);

		if (ticksPerSecond === 0) {
			if (this.speedTps > 0) {
				this.lastActiveSpeedTps = this.speedTps;
			}
			this.speedTps = 0;
			this.paused = true;
			this.syncTimer();
			return this.emitStatus();
		}

		this.speedTps = ticksPerSecond;
		this.lastActiveSpeedTps = ticksPerSecond;
		this.paused = false;
		this.syncTimer();
		return this.emitStatus();
	}

	pause(): RuntimeStatus {
		this.paused = true;
		this.state = { ...this.state, game: { ...this.state.game, paused: true } };
		this.syncTimer();
		return this.emitStatus();
	}

	resume(): RuntimeStatus {
		if (this.speedTps === 0) {
			this.speedTps = this.lastActiveSpeedTps;
		}
		this.paused = false;
		this.state = { ...this.state, game: { ...this.state.game, paused: false } };
		this.syncTimer();
		return this.emitStatus();
	}

	tickNow(count = 1): GameState {
		if (!Number.isInteger(count) || count < 0) {
			throw new Error(`Invalid tick count: ${count}`);
		}

		let state = this.state;
		for (let index = 0; index < count; index += 1) {
			state = this.dispatch({ type: "Tick" });
		}

		return state;
	}

	getSnapshot(): GameState {
		return this.state;
	}

	getStatus(): StatusView {
		return createStatusView(this.state, this.getRuntimeStatus());
	}

	getVerificationState(): CliVerifiedRunState {
		return this.verification.getState();
	}

	setVerificationState(state: CliVerifiedRunState): void {
		this.verification.setState(state);
	}

	getRuntimeStatus(): RuntimeStatus {
		return {
			paused: this.paused,
			speedTps: this.speedTps,
		};
	}

	static getVersion(): string {
		return VERSION;
	}

	private emitStatus(): RuntimeStatus {
		const status = this.getRuntimeStatus();
		this.emit("status", status);
		return status;
	}

	private syncTimer(): void {
		this.clearTimer();

		if (!this.started || this.paused || this.speedTps <= 0) {
			return;
		}

		this.timerHandle = this.scheduler.setInterval(() => {
			this.dispatch({ type: "Subtick" });
		}, 1000 / (this.speedTps * DAYS_PER_TICK));
	}

	private clearTimer(): void {
		if (this.timerHandle === undefined) {
			return;
		}

		this.scheduler.clearInterval(this.timerHandle);
		this.timerHandle = undefined;
	}
}

export type { SubscriptionEvent };
