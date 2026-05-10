import type {
	Action,
	Capacity,
	Contract,
	Datacenter,
	DatacenterMaintenanceStaffingView,
	DatacenterSpec,
	GameState,
	LedgerEntry,
	RackHealthStatus,
	RackSpec,
} from "@datacenter-tycoon/game-logic";

export type RpcVersion = "2.0";

export enum RpcErrorCode {
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603,
	RuntimeError = -32000,
	VersionMismatch = -32001,
	NotSubscribed = -32002,
}

export type QueryKind = "snapshot" | "status" | "list" | "catalog";
export type ControlOp = "pause" | "resume" | "set-speed" | "save-now" | "shutdown";
export type SubscriptionEventKind = "state" | "ledger" | "tick";
export type RpcMethod = "hello" | "dispatch" | "query" | "subscribe" | "unsubscribe" | "control";

export interface ContractCapacityErrorData {
	code: "insufficient_capacity";
	dcId: string;
	required: Capacity;
	available: Capacity;
}

export interface RpcError {
	code: RpcErrorCode;
	message: string;
	data?: unknown;
}

export interface RpcRequest<P = unknown> {
	jsonrpc: RpcVersion;
	id?: number;
	method: RpcMethod;
	params?: P;
}

export interface RpcResponse<R = unknown> {
	jsonrpc: RpcVersion;
	id: number;
	result?: R;
	error?: RpcError;
}

export interface RpcEvent<E = unknown> {
	jsonrpc: RpcVersion;
	method: "event";
	params: {
		subId: number;
		event: E;
	};
}

export interface HelloParams {
	clientVersion: string;
}

export interface HelloResult {
	daemonVersion: string;
	saveVersion: number;
	tick: number;
}

export interface SnapshotQuery {
	kind: "snapshot";
}

export interface StatusQuery {
	kind: "status";
}

export interface ListQuery {
	kind: "list";
	target: "datacenters" | "racks" | "market-contracts" | "active-contracts";
	dcId?: string;
}

export interface CatalogQuery {
	kind: "catalog";
	target: "datacenters" | "racks";
}

export type QueryParams = SnapshotQuery | StatusQuery | ListQuery | CatalogQuery;

export interface SubscribeParams {
	events: SubscriptionEventKind[];
}

export interface SubscribeResult {
	subId: number;
}

export interface UnsubscribeParams {
	subId: number;
}

export type ControlParams =
	| { op: "pause" }
	| { op: "resume" }
	| { op: "save-now" }
	| { op: "shutdown" }
	| { op: "set-speed"; ticksPerSecond: number };

export type DispatchParams = Action;

export interface RuntimeStatus {
	paused: boolean;
	speedTps: number;
}

export interface StatusView extends RuntimeStatus {
	tick: number;
	cash: number;
	datacenterCount: number;
	rackCount: number;
	activeContractCount: number;
	marketContractCount: number;
}

export interface DatacenterListItem {
	datacenter: Datacenter;
	capacity: Capacity;
	powerKw: number;
	powerCapacityKw: number;
	heatOutputBtuPerHr: number;
	coolingCapacityBtuPerHr: number;
	bandwidthGbps: number;
	bandwidthCapacityGbps: number;
	slotsUsed: number;
	totalSlots: number;
	/** Maintenance staffing state and economics derived from game-logic. */
	maintenance: DatacenterMaintenanceStaffingView;
}

export interface RackListItem {
	dcId: string;
	dcName: string;
	placementId: string;
	spec: RackSpec;
	row: number;
	position: number;
	installedAtTick: number;
	/** Current health state of the rack. */
	health: RackHealthStatus;
	/** Rack age in months (ticks since installation). */
	ageMonths: number;
	/**
	 * Monthly failure probability in [0, 1].
	 * Always 0 for repairing racks.
	 */
	failureProbability: number;
}

export type ListResult =
	| { kind: "datacenters"; items: DatacenterListItem[] }
	| { kind: "racks"; dcId: string; items: RackListItem[] }
	| { kind: "market-contracts"; items: Contract[] }
	| { kind: "active-contracts"; items: Contract[] };

export type CatalogResult =
	| { kind: "datacenters"; items: DatacenterSpec[] }
	| { kind: "racks"; items: RackSpec[] };

export type QueryResult = GameState | StatusView | ListResult | CatalogResult;

export interface DispatchResult {
	tick: number;
}

export interface EmptyResult {
	ok: true;
}

export interface StateEvent extends RuntimeStatus {
	type: "state";
	tick: number;
	snapshot: GameState;
}

export interface TickEvent {
	type: "tick";
	tick: number;
}

export interface LedgerEvent {
	type: "ledger";
	tick: number;
	entries: LedgerEntry[];
}

export type SubscriptionEvent = StateEvent | TickEvent | LedgerEvent;

export type RpcRequestParams = HelloParams | DispatchParams | QueryParams | SubscribeParams | UnsubscribeParams | ControlParams;

export type RpcResult = HelloResult | DispatchResult | SubscribeResult | QueryResult | EmptyResult;
export type RpcServerMessage = RpcResponse<RpcResult> | RpcEvent<SubscriptionEvent>;

export type { Action } from "@datacenter-tycoon/game-logic";
