import { EventEmitter } from "node:events";

import { SAVE_VERSION } from "@datacenter-tycoon/game-logic";

import type {
	ControlParams,
	EmptyResult,
	HelloResult,
	RpcMethod,
	RpcRequest,
	RpcResult,
	SubscribeParams,
	SubscribeResult,
	SubscriptionEvent,
	SubscriptionEventKind,
	UnsubscribeParams,
} from "../protocol/messages.js";
import { RpcErrorCode } from "../protocol/messages.js";
import { GamePersistence } from "./persist.js";
import { GameRuntime } from "./runtime.js";
import type { TransportConnection } from "./transport.js";
import { DaemonTransport } from "./transport.js";

interface SubscriptionRecord {
	subId: number;
	connection: TransportConnection;
	events: Set<SubscriptionEventKind>;
}

export interface GameDaemonServerOptions {
	transport: DaemonTransport;
	runtime: GameRuntime;
	persistence: GamePersistence;
	onShutdownRequest?: () => void | Promise<void>;
}

export interface ServerErrorShape {
	code: RpcErrorCode;
	message: string;
	data?: unknown;
}

function isRpcMethod(value: string): value is RpcMethod {
	return (
		value === "hello" ||
		value === "dispatch" ||
		value === "query" ||
		value === "subscribe" ||
		value === "unsubscribe" ||
		value === "control"
	);
}

function errorWithCode(code: RpcErrorCode, message: string, data?: unknown): ServerErrorShape {
	return { code, message, data };
}

function normalizeError(error: unknown): ServerErrorShape {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		typeof error.code === "number" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return {
			code: error.code as RpcErrorCode,
			message: error.message,
			data: "data" in error ? (error.data as unknown) : undefined,
		};
	}

	if (error instanceof Error) {
		return errorWithCode(
			RpcErrorCode.RuntimeError,
			error.message,
			"data" in error ? ((error as Error & { data?: unknown }).data ?? undefined) : undefined,
		);
	}

	return errorWithCode(RpcErrorCode.InternalError, "Unknown server error", error);
}

export class GameDaemonServer extends EventEmitter<{ shutdownRequested: [] }> {
	private readonly transport: DaemonTransport;
	private readonly runtime: GameRuntime;
	private readonly persistence: GamePersistence;
	private readonly onShutdownRequest?: () => void | Promise<void>;
	private readonly subscriptions = new Map<number, SubscriptionRecord>();
	private readonly connectionSubscriptions = new Map<number, Set<number>>();
	private nextSubId = 1;
	private started = false;

	constructor(options: GameDaemonServerOptions) {
		super();
		this.transport = options.transport;
		this.runtime = options.runtime;
		this.persistence = options.persistence;
		this.onShutdownRequest = options.onShutdownRequest;
	}

	async start(): Promise<void> {
		if (this.started) {
			return;
		}

		this.started = true;
		this.transport.on("request", this.handleRequest);
		this.transport.on("disconnect", this.handleDisconnect);
		this.transport.on("invalidMessage", this.handleInvalidMessage);
		this.runtime.on("state", this.handleRuntimeEvent("state"));
		this.runtime.on("tick", this.handleRuntimeEvent("tick"));
		this.runtime.on("ledger", this.handleRuntimeEvent("ledger"));
		await this.transport.start();
		this.runtime.start();
	}

	async close(): Promise<void> {
		this.runtime.stop();
		await this.persistence.flush(this.runtime.getSnapshot());
		this.transport.off("request", this.handleRequest);
		this.transport.off("disconnect", this.handleDisconnect);
		this.transport.off("invalidMessage", this.handleInvalidMessage);
		await this.transport.close();
		this.subscriptions.clear();
		this.connectionSubscriptions.clear();
		this.started = false;
	}

	private readonly handleDisconnect = (connection: TransportConnection): void => {
		const subIds = this.connectionSubscriptions.get(connection.id);
		if (!subIds) {
			return;
		}

		for (const subId of subIds) {
			this.subscriptions.delete(subId);
		}
		this.connectionSubscriptions.delete(connection.id);
	};

	private readonly handleInvalidMessage = (connection: TransportConnection, rawMessage: string, error: Error): void => {
		this.transport.send(connection, {
			jsonrpc: "2.0",
			id: 0,
			error: {
				code: RpcErrorCode.ParseError,
				message: error.message,
				data: rawMessage,
			},
		});
	};

	private handleRuntimeEvent(eventType: SubscriptionEventKind) {
		return (event: SubscriptionEvent): void => {
			if (event.type === "state") {
				this.persistence.scheduleAutosave(event.snapshot);
			}

			for (const subscription of this.subscriptions.values()) {
				if (!subscription.events.has(eventType)) {
					continue;
				}

				this.transport.send(subscription.connection, {
					jsonrpc: "2.0",
					method: "event",
					params: {
						subId: subscription.subId,
						event,
					},
				});
			}
		};
	}

	private readonly handleRequest = async (connection: TransportConnection, request: RpcRequest): Promise<void> => {
		if (!isRpcMethod(request.method)) {
			this.respondError(connection, request.id ?? 0, errorWithCode(RpcErrorCode.MethodNotFound, `Unknown method: ${request.method}`));
			return;
		}

		try {
			const result = await this.dispatchMethod(connection, request.method, request.params);
			if (request.id !== undefined) {
				this.respondResult(connection, request.id, result);
			}
		} catch (error) {
			if (request.id !== undefined) {
				this.respondError(connection, request.id, normalizeError(error));
			}
		}
	};

	private respondResult(connection: TransportConnection, id: number, result: RpcResult): void {
		this.transport.send(connection, {
			jsonrpc: "2.0",
			id,
			result,
		});
	}

	private respondError(connection: TransportConnection, id: number, error: ServerErrorShape): void {
		this.transport.send(connection, {
			jsonrpc: "2.0",
			id,
			error,
		});
	}

	private async dispatchMethod(connection: TransportConnection, method: RpcMethod, params: unknown): Promise<RpcResult> {
		switch (method) {
			case "hello":
				return this.handleHello();
			case "dispatch": {
				const nextState = this.runtime.dispatch(params as Parameters<GameRuntime["dispatch"]>[0]);
				return { tick: nextState.tick };
			}
			case "query":
				return this.runtime.query(params as Parameters<GameRuntime["query"]>[0]);
			case "subscribe":
				return this.handleSubscribe(connection, params as SubscribeParams);
			case "unsubscribe":
				return this.handleUnsubscribe(connection, params as UnsubscribeParams);
			case "control":
				return this.handleControl(params as ControlParams);
			default:
				throw errorWithCode(RpcErrorCode.MethodNotFound, `Unknown method: ${method}`);
		}
	}

	private handleHello(): HelloResult {
		return {
			daemonVersion: GameRuntime.getVersion(),
			saveVersion: SAVE_VERSION,
			tick: this.runtime.getSnapshot().tick,
		};
	}

	private handleSubscribe(connection: TransportConnection, params: SubscribeParams): SubscribeResult {
		if (!params || !Array.isArray(params.events) || params.events.length === 0) {
			throw errorWithCode(RpcErrorCode.InvalidParams, "subscribe requires a non-empty events array");
		}

		const subId = this.nextSubId;
		this.nextSubId += 1;
		const subscription: SubscriptionRecord = {
			subId,
			connection,
			events: new Set(params.events),
		};
		this.subscriptions.set(subId, subscription);

		let connectionSubIds = this.connectionSubscriptions.get(connection.id);
		if (!connectionSubIds) {
			connectionSubIds = new Set<number>();
			this.connectionSubscriptions.set(connection.id, connectionSubIds);
		}
		connectionSubIds.add(subId);

		return { subId };
	}

	private handleUnsubscribe(connection: TransportConnection, params: UnsubscribeParams): EmptyResult {
		const subscription = params ? this.subscriptions.get(params.subId) : undefined;
		if (!subscription || subscription.connection.id !== connection.id) {
			throw errorWithCode(RpcErrorCode.NotSubscribed, `Unknown subscription: ${params?.subId ?? "missing"}`);
		}

		this.subscriptions.delete(subscription.subId);
		this.connectionSubscriptions.get(connection.id)?.delete(subscription.subId);
		return { ok: true };
	}

	private async handleControl(params: ControlParams): Promise<EmptyResult> {
		if (!params || typeof params !== "object" || !("op" in params)) {
			throw errorWithCode(RpcErrorCode.InvalidParams, "control requires an op field");
		}

		switch (params.op) {
			case "pause":
				this.runtime.pause();
				return { ok: true };
			case "resume":
				this.runtime.resume();
				return { ok: true };
			case "set-speed":
				this.runtime.setSpeed(params.ticksPerSecond);
				return { ok: true };
			case "save-now":
				await this.persistence.flush(this.runtime.getSnapshot());
				return { ok: true };
			case "shutdown":
				await this.persistence.flush(this.runtime.getSnapshot());
				queueMicrotask(() => {
					this.emit("shutdownRequested");
					void this.onShutdownRequest?.();
				});
				return { ok: true };
			default:
				throw errorWithCode(RpcErrorCode.InvalidParams, `Unsupported control op: ${JSON.stringify(params)}`);
		}
	}
}
