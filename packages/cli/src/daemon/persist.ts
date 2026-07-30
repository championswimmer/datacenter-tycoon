import fs from "node:fs";
import path from "node:path";

import { deserialize, newGame, serialize, type GameState } from "@datacenter-tycoon/game-logic";
import {
  appendVerificationAction,
  createInitialVerifiedRunState,
  createLegacyLocalOnlyVerifiedRunState,
  createVerifiedRunController,
  restoreVerifiedRunState,
  type CliVerifiedRunController,
  type CliVerifiedRunState,
} from "../online/verified-run.js";

export interface TimeoutScheduler {
	setTimeout(callback: () => void, delayMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface GamePersistenceOptions {
	savePath: string;
	debounceMs?: number;
	scheduler?: TimeoutScheduler;
}

export interface PersistedGameSession {
	state: GameState;
	verification: CliVerifiedRunState | null;
}

interface PersistedGameEnvelope {
	appSaveVersion: number;
	save: unknown;
	verification?: CliVerifiedRunState;
}

const DEFAULT_DEBOUNCE_MS = 500;
const APP_SAVE_VERSION = 1;

const defaultScheduler: TimeoutScheduler = {
	setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
	clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

function getTempSavePath(savePath: string): string {
	return `${savePath}.tmp`;
}

function isPersistedGameEnvelope(value: unknown): value is PersistedGameEnvelope {
	return Boolean(value)
		&& typeof value === "object"
		&& typeof (value as { appSaveVersion?: unknown }).appSaveVersion === "number"
		&& "save" in (value as Record<string, unknown>);
}

function serializeSession(session: PersistedGameSession): string {
	const save = JSON.parse(serialize(session.state)) as unknown;
	return JSON.stringify({
		appSaveVersion: APP_SAVE_VERSION,
		save,
		verification: session.verification ?? undefined,
	} satisfies PersistedGameEnvelope);
}

function deserializeSession(raw: string): PersistedGameSession {
	const parsed = JSON.parse(raw) as unknown;

	if (isPersistedGameEnvelope(parsed)) {
		return {
			state: deserialize(JSON.stringify(parsed.save)),
			verification: parsed.verification ? restoreVerifiedRunState(parsed.verification) : null,
		};
	}

	return {
		state: deserialize(raw),
		verification: null,
	};
}

async function writeAtomic(savePath: string, session: PersistedGameSession): Promise<void> {
	const directory = path.dirname(savePath);
	const tempPath = getTempSavePath(savePath);
	await fs.promises.mkdir(directory, { recursive: true });
	await fs.promises.writeFile(tempPath, serializeSession(session), "utf8");
	await fs.promises.rename(tempPath, savePath);
}

function writeAtomicSync(savePath: string, session: PersistedGameSession): void {
	const directory = path.dirname(savePath);
	const tempPath = getTempSavePath(savePath);
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(tempPath, serializeSession(session), "utf8");
	fs.renameSync(tempPath, savePath);
}

export function loadGameSession(savePath: string, seed: number): PersistedGameSession {
	if (!fs.existsSync(savePath)) {
		const state = newGame(seed);
		return {
			state,
			verification: createInitialVerifiedRunState(state),
		};
	}

	const session = deserializeSession(fs.readFileSync(savePath, "utf8"));
	return {
		state: session.state,
		verification: session.verification ?? createLegacyLocalOnlyVerifiedRunState(session.state),
	};
}

export function loadOrInit(savePath: string, seed: number): GameState {
	return loadGameSession(savePath, seed).state;
}

export class GamePersistence {
	private readonly savePath: string;
	private readonly debounceMs: number;
	private readonly scheduler: TimeoutScheduler;
	private timeoutHandle?: unknown;
	private pendingSession?: PersistedGameSession;
	private pendingFlush?: Promise<void>;

	constructor(options: GamePersistenceOptions) {
		this.savePath = options.savePath;
		this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		this.scheduler = options.scheduler ?? defaultScheduler;
	}

	scheduleAutosave(state: GameState, verification: CliVerifiedRunState): void {
		this.pendingSession = { state, verification };
		this.clearScheduledFlush();
		this.timeoutHandle = this.scheduler.setTimeout(() => {
			this.timeoutHandle = undefined;
			this.pendingFlush = this.flush();
		}, this.debounceMs);
	}

	async flush(state = this.pendingSession?.state, verification = this.pendingSession?.verification): Promise<void> {
		this.clearScheduledFlush();
		if (!state || !verification) {
			return;
		}

		this.pendingSession = { state, verification };
		const flushPromise = writeAtomic(this.savePath, this.pendingSession).then(() => {
			if (this.pendingSession?.state === state) {
				this.pendingSession = undefined;
			}
		});
		this.pendingFlush = flushPromise;
		await flushPromise;
	}

	flushSync(state = this.pendingSession?.state, verification = this.pendingSession?.verification): void {
		this.clearScheduledFlush();
		if (!state || !verification) {
			return;
		}

		writeAtomicSync(this.savePath, { state, verification });
		if (this.pendingSession?.state === state) {
			this.pendingSession = undefined;
		}
	}

	async waitForPendingFlush(): Promise<void> {
		await this.pendingFlush;
	}

	private clearScheduledFlush(): void {
		if (this.timeoutHandle === undefined) {
			return;
		}

		this.scheduler.clearTimeout(this.timeoutHandle);
		this.timeoutHandle = undefined;
	}
}

export interface RuntimePersistenceSession {
	state: GameState;
	verification: CliVerifiedRunController;
}

export function createRuntimePersistenceSession(savePath: string, seed: number): RuntimePersistenceSession {
	const loaded = loadGameSession(savePath, seed);
	const verification = createVerifiedRunController(loaded.verification ?? createLegacyLocalOnlyVerifiedRunState(loaded.state));

	return {
		state: loaded.state,
		verification,
	};
}

export function appendRuntimeVerificationAction(
	verification: CliVerifiedRunController,
	action: Parameters<typeof appendVerificationAction>[1],
): void {
	verification.update((current) => appendVerificationAction(current, action));
}
