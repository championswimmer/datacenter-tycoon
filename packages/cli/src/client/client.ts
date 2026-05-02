import net from "node:net";
import type { ChildProcess } from "node:child_process";

import type {
	Action,
	ControlParams,
	DispatchResult,
	EmptyResult,
	HelloParams,
	HelloResult,
	QueryParams,
	QueryResult,
	RpcEvent,
	RpcResponse,
	SubscribeParams,
	SubscribeResult,
	SubscriptionEvent,
	SubscriptionEventKind,
	UnsubscribeParams,
} from "../protocol/messages.js";
import { autoSpawnDaemon } from "./spawn.js";

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
}

export interface DctClientOptions {
	socketPath: string;
	savePath?: string;
	noDaemon?: boolean;
	autoSpawn?: boolean;
	waitForSocketTimeoutMs?: number;
	idleTimeoutMs?: number;
	seed?: number;
}

export class DctClient {
	private readonly socketPath: string;
	private readonly savePath?: string;
	private readonly noDaemon: boolean;
	private readonly autoSpawn: boolean;
	private readonly waitForSocketTimeoutMs?: number;
	private readonly idleTimeoutMs?: number;
	private readonly seed?: number;
	private socket?: net.Socket;
	private spawnedProcess?: ChildProcess;
	private nextRequestId = 1;
	private buffer = "";
	private readonly pendingRequests = new Map<number, PendingRequest>();
	private readonly subscriptions = new Map<number, (event: SubscriptionEvent) => void>();
	private connected = false;

	constructor(options: DctClientOptions) {
		this.socketPath = options.socketPath;
		this.savePath = options.savePath;
		this.noDaemon = options.noDaemon ?? false;
		this.autoSpawn = options.autoSpawn ?? true;
		this.waitForSocketTimeoutMs = options.waitForSocketTimeoutMs;
		this.idleTimeoutMs = options.idleTimeoutMs;
		this.seed = options.seed;
	}

	async connect(): Promise<void> {
		if (this.connected) {
			return;
		}

		try {
			await this.connectSocket();
		} catch (error) {
			const maybeError = error as NodeJS.ErrnoException;
			const isRecoverable = maybeError.code === "ENOENT" || maybeError.code === "ECONNREFUSED";
			if (!this.autoSpawn || !isRecoverable) {
				throw error;
			}

			this.spawnedProcess = await autoSpawnDaemon({
				socketPath: this.socketPath,
				savePath: this.savePath,
				noDaemon: this.noDaemon,
				waitForSocketTimeoutMs: this.waitForSocketTimeoutMs,
				idleTimeoutMs: this.idleTimeoutMs,
				seed: this.seed,
			});
			await this.connectSocket();
		}
	}

	async hello(params: HelloParams): Promise<HelloResult> {
		return (await this.request("hello", params)) as HelloResult;
	}

	async dispatch(action: Action): Promise<DispatchResult> {
		return (await this.request("dispatch", action)) as DispatchResult;
	}

	async query(params: QueryParams): Promise<QueryResult> {
		return (await this.request("query", params)) as QueryResult;
	}

	async subscribe(
		events: SubscriptionEventKind[],
		onEvent: (event: SubscriptionEvent) => void,
	): Promise<{ subId: number; unsubscribe: () => Promise<EmptyResult> }> {
		const result = (await this.request("subscribe", { events } satisfies SubscribeParams)) as SubscribeResult;
		this.subscriptions.set(result.subId, onEvent);
		return {
			subId: result.subId,
			unsubscribe: async () => {
				this.subscriptions.delete(result.subId);
				return (await this.request("unsubscribe", { subId: result.subId } satisfies UnsubscribeParams)) as EmptyResult;
			},
		};
	}

	async control(params: ControlParams): Promise<EmptyResult> {
		return (await this.request("control", params)) as EmptyResult;
	}

	async close(): Promise<void> {
		if (!this.socket) {
			return;
		}

		await new Promise<void>((resolve) => {
			const socket = this.socket;
			this.socket = undefined;
			this.connected = false;
			this.rejectPendingRequests(new Error("Socket closed"));
			socket?.once("close", () => resolve());
			socket?.end();
			socket?.destroy();
		});
	}

	getSpawnedProcess(): ChildProcess | undefined {
		return this.spawnedProcess;
	}

	private async request(method: "hello" | "dispatch" | "query" | "subscribe" | "unsubscribe" | "control", params: unknown): Promise<unknown> {
		if (!this.socket || !this.connected) {
			throw new Error("Client is not connected");
		}

		const id = this.nextRequestId;
		this.nextRequestId += 1;

		const promise = new Promise<unknown>((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
		});
		this.socket.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
		return await promise;
	}

	private async connectSocket(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const socket = net.createConnection(this.socketPath);
			const onError = (error: Error) => {
				socket.destroy();
				reject(error);
			};
			socket.once("error", onError);
			socket.once("connect", () => {
				socket.off("error", onError);
				this.socket = socket;
				this.connected = true;
				this.attachSocket(socket);
				resolve();
			});
		});
	}

	private attachSocket(socket: net.Socket): void {
		socket.on("data", (chunk) => {
			this.handleData(chunk.toString());
		});
		socket.on("close", () => {
			this.connected = false;
			this.socket = undefined;
			this.rejectPendingRequests(new Error("Socket closed"));
		});
		socket.on("error", (error) => {
			this.rejectPendingRequests(error);
		});
	}

	private handleData(chunk: string): void {
		this.buffer += chunk;
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}

			const message = JSON.parse(trimmed) as RpcResponse | RpcEvent<SubscriptionEvent>;
			if ("method" in message && message.method === "event") {
				const handler = this.subscriptions.get(message.params.subId);
				handler?.(message.params.event);
				continue;
			}

			if (!("id" in message)) {
				continue;
			}

			const pendingRequest = this.pendingRequests.get(message.id);
			if (!pendingRequest) {
				continue;
			}
			this.pendingRequests.delete(message.id);
			if (message.error) {
				pendingRequest.reject(new Error(message.error.message));
				continue;
			}
			pendingRequest.resolve(message.result);
		}
	}

	private rejectPendingRequests(error: Error): void {
		for (const [id, pendingRequest] of this.pendingRequests) {
			this.pendingRequests.delete(id);
			pendingRequest.reject(error);
		}
	}
}
