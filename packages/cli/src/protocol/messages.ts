import type { Action } from "@datacenter-tycoon/game-logic";

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

export type RpcRequestParams = HelloParams | DispatchParams | QueryParams | SubscribeParams | UnsubscribeParams | ControlParams;

export type RpcServerMessage<E = unknown, R = unknown> = RpcResponse<R> | RpcEvent<E>;

export type { Action } from "@datacenter-tycoon/game-logic";
