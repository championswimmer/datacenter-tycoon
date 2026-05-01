import fs from "node:fs";
import path from "node:path";

import { deserialize, newGame, serialize, type GameState } from "@datacenter-tycoon/game-logic";

export interface TimeoutScheduler {
	setTimeout(callback: () => void, delayMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface GamePersistenceOptions {
	savePath: string;
	debounceMs?: number;
	scheduler?: TimeoutScheduler;
}

const DEFAULT_DEBOUNCE_MS = 500;

const defaultScheduler: TimeoutScheduler = {
	setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
	clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

function getTempSavePath(savePath: string): string {
	return `${savePath}.tmp`;
}

async function writeAtomic(savePath: string, state: GameState): Promise<void> {
	const directory = path.dirname(savePath);
	const tempPath = getTempSavePath(savePath);
	await fs.promises.mkdir(directory, { recursive: true });
	await fs.promises.writeFile(tempPath, serialize(state), "utf8");
	await fs.promises.rename(tempPath, savePath);
}

function writeAtomicSync(savePath: string, state: GameState): void {
	const directory = path.dirname(savePath);
	const tempPath = getTempSavePath(savePath);
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(tempPath, serialize(state), "utf8");
	fs.renameSync(tempPath, savePath);
}

export function loadOrInit(savePath: string, seed: number): GameState {
	if (!fs.existsSync(savePath)) {
		return newGame(seed);
	}

	return deserialize(fs.readFileSync(savePath, "utf8"));
}

export class GamePersistence {
	private readonly savePath: string;
	private readonly debounceMs: number;
	private readonly scheduler: TimeoutScheduler;
	private timeoutHandle?: unknown;
	private pendingState?: GameState;
	private pendingFlush?: Promise<void>;

	constructor(options: GamePersistenceOptions) {
		this.savePath = options.savePath;
		this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		this.scheduler = options.scheduler ?? defaultScheduler;
	}

	scheduleAutosave(state: GameState): void {
		this.pendingState = state;
		this.clearScheduledFlush();
		this.timeoutHandle = this.scheduler.setTimeout(() => {
			this.timeoutHandle = undefined;
			this.pendingFlush = this.flush();
		}, this.debounceMs);
	}

	async flush(state = this.pendingState): Promise<void> {
		this.clearScheduledFlush();
		if (!state) {
			return;
		}

		this.pendingState = state;
		const flushPromise = writeAtomic(this.savePath, state).then(() => {
			if (this.pendingState === state) {
				this.pendingState = undefined;
			}
		});
		this.pendingFlush = flushPromise;
		await flushPromise;
	}

	flushSync(state = this.pendingState): void {
		this.clearScheduledFlush();
		if (!state) {
			return;
		}

		writeAtomicSync(this.savePath, state);
		if (this.pendingState === state) {
			this.pendingState = undefined;
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
