import fs from "node:fs";
import path from "node:path";
import { EventEmitter, once } from "node:events";

import type { RuntimeStatus } from "../protocol/messages.js";
import { GameRuntime } from "./runtime.js";
import type { TransportConnection } from "./transport.js";

export interface SignalProcess {
	pid: number;
	on(event: NodeJS.Signals, listener: () => void): void;
	off(event: NodeJS.Signals, listener: () => void): void;
	kill(pid: number, signal?: NodeJS.Signals | number): boolean;
}

export interface DaemonLifecycleOptions {
	pidPath: string;
	idleTimeoutMs?: number;
	transport: Pick<import("./transport.js").DaemonTransport, "on" | "off">;
	runtime: GameRuntime;
	startServer: () => Promise<void>;
	stopServer: () => Promise<void>;
	exit?: (code: number) => void;
	signalProcess?: SignalProcess;
}

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export class DaemonLifecycle extends EventEmitter<{ exit: [code: number] }> {
	private readonly pidPath: string;
	private readonly idleTimeoutMs: number;
	private readonly transport: Pick<import("./transport.js").DaemonTransport, "on" | "off">;
	private readonly runtime: GameRuntime;
	private readonly startServer: () => Promise<void>;
	private readonly stopServer: () => Promise<void>;
	private readonly exitFn?: (code: number) => void;
	private readonly signalProcess: SignalProcess;
	private readonly registeredSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
	private clientCount = 0;
	private idleTimer?: NodeJS.Timeout;
	private started = false;
	private shutdownPromise?: Promise<void>;

	constructor(options: DaemonLifecycleOptions) {
		super();
		this.pidPath = options.pidPath;
		this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
		this.transport = options.transport;
		this.runtime = options.runtime;
		this.startServer = options.startServer;
		this.stopServer = options.stopServer;
		this.exitFn = options.exit;
		this.signalProcess = options.signalProcess ?? process;
	}

	async start(): Promise<void> {
		if (this.started) {
			return;
		}

		this.acquirePidLock();
		this.transport.on("connection", this.handleConnection);
		this.transport.on("disconnect", this.handleDisconnect);
		this.runtime.on("status", this.handleStatusChange);
		for (const signal of this.registeredSignals) {
			this.signalProcess.on(signal, this.handleSignal);
		}

		try {
			await this.startServer();
			this.started = true;
			this.refreshIdleTimer();
		} catch (error) {
			this.detachListeners();
			this.releasePidLock();
			throw error;
		}
	}

	async requestShutdown(code = 0): Promise<void> {
		if (!this.shutdownPromise) {
			this.shutdownPromise = this.shutdown(code);
		}
		await this.shutdownPromise;
	}

	private async shutdown(code: number): Promise<void> {
		this.clearIdleTimer();
		if (this.started) {
			await this.stopServer();
			this.started = false;
		}
		this.detachListeners();
		this.releasePidLock();
		this.emit("exit", code);
		this.exitFn?.(code);
	}

	private readonly handleConnection = (_connection: TransportConnection): void => {
		this.clientCount += 1;
		this.refreshIdleTimer();
	};

	private readonly handleDisconnect = (_connection: TransportConnection): void => {
		this.clientCount = Math.max(0, this.clientCount - 1);
		this.refreshIdleTimer();
	};

	private readonly handleStatusChange = (_status: RuntimeStatus): void => {
		this.refreshIdleTimer();
	};

	private readonly handleSignal = (): void => {
		void this.requestShutdown(0);
	};

	private refreshIdleTimer(): void {
		this.clearIdleTimer();
		const status = this.runtime.getRuntimeStatus();
		if (!this.started || this.clientCount > 0 || !status.paused) {
			return;
		}

		this.idleTimer = setTimeout(() => {
			void this.requestShutdown(0);
		}, this.idleTimeoutMs);
	}

	private clearIdleTimer(): void {
		if (this.idleTimer !== undefined) {
			clearTimeout(this.idleTimer);
			this.idleTimer = undefined;
		}
	}

	private acquirePidLock(): void {
		fs.mkdirSync(path.dirname(this.pidPath), { recursive: true });
		if (fs.existsSync(this.pidPath)) {
			const pidText = fs.readFileSync(this.pidPath, "utf8").trim();
			const existingPid = Number.parseInt(pidText, 10);
			if (Number.isFinite(existingPid) && this.isProcessAlive(existingPid)) {
				throw new Error(`Daemon already running with pid ${existingPid}`);
			}
			fs.rmSync(this.pidPath, { force: true });
		}

		fs.writeFileSync(this.pidPath, `${this.signalProcess.pid}\n`, "utf8");
	}

	private isProcessAlive(pid: number): boolean {
		try {
			this.signalProcess.kill(pid, 0);
			return true;
		} catch (error) {
			const maybeError = error as NodeJS.ErrnoException;
			if (maybeError.code === "ESRCH") {
				return false;
			}
			throw error;
		}
	}

	private releasePidLock(): void {
		if (!fs.existsSync(this.pidPath)) {
			return;
		}

		const currentPid = fs.readFileSync(this.pidPath, "utf8").trim();
		if (currentPid === `${this.signalProcess.pid}`) {
			fs.rmSync(this.pidPath, { force: true });
		}
	}

	private detachListeners(): void {
		this.transport.off("connection", this.handleConnection);
		this.transport.off("disconnect", this.handleDisconnect);
		this.runtime.off("status", this.handleStatusChange);
		for (const signal of this.registeredSignals) {
			this.signalProcess.off(signal, this.handleSignal);
		}
	}
}

export async function waitForExit(lifecycle: DaemonLifecycle): Promise<number> {
	const [code] = await once(lifecycle, "exit");
	return code as number;
}
