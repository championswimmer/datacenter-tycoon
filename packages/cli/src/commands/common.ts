import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import crypto from "node:crypto";

import type { Action, GameState } from "@datacenter-tycoon/game-logic";

import type { QueryParams } from "../protocol/messages.js";

import type { ParsedArgv } from "../argv.js";
import { DctClient, type DctClientOptions } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import { formatRegionLabel } from "./region-labels.js";

export interface CommandClient {
	connect(): Promise<void>;
	dispatch(action: Action): Promise<unknown>;
	query(params: QueryParams): Promise<unknown>;
	control(params: { op: "save-now" } | { op: "shutdown" } | { op: "pause" } | { op: "resume" } | { op: "set-speed"; ticksPerSecond: number }): Promise<{ ok: true }>;
	close(): Promise<void>;
}

export type CommandClientFactory = (options: DctClientOptions) => CommandClient;

export interface CommandPaths {
	savePath: string;
	dataDir: string;
	configDir: string;
	onlineProfilePath: string;
	socketPath: string;
	pidPath: string;
	logPath: string;
}

export function getStringFlag(parsed: ParsedArgv, flag: string): string | undefined {
	const value = parsed.flags[flag];
	return typeof value === "string" ? value : undefined;
}

export function hasBooleanFlag(parsed: ParsedArgv, flag: string): boolean {
	return parsed.flags[flag] === true;
}

export function getNumberFlag(parsed: ParsedArgv, flag: string, fallback: number): number {
	const value = getStringFlag(parsed, flag);
	if (!value) {
		return fallback;
	}

	const parsedNumber = Number(value);
	if (!Number.isFinite(parsedNumber)) {
		throw new Error(`Invalid value for ${flag}: ${value}`);
	}

	return parsedNumber;
}

export function resolveCommandPaths(parsed: ParsedArgv): CommandPaths {
	return resolvePaths({
		saveOverride: getStringFlag(parsed, "--save"),
		gameId: getStringFlag(parsed, "--game-id") ?? getStringFlag(parsed, "--id"),
		socketOverride: getStringFlag(parsed, "--socket"),
	});
}

export function createCommandClientOptions(parsed: ParsedArgv): DctClientOptions {
	const paths = resolveCommandPaths(parsed);
	return {
		socketPath: paths.socketPath,
		savePath: paths.savePath,
		noDaemon: hasBooleanFlag(parsed, "--no-daemon"),
	};
}

export function formatJsonResult(data: unknown): string {
	return JSON.stringify({ ok: true, data }, null, 2);
}

interface ErrorPayload {
	code: string | number;
	message: string;
	[key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object");
}

function normalizeErrorPayload(errorOrMessage: unknown, fallbackCode: string | number = 1): ErrorPayload {
	if (typeof errorOrMessage === "string") {
		return { code: fallbackCode, message: errorOrMessage };
	}

	if (errorOrMessage instanceof Error) {
		const data = "data" in errorOrMessage ? (errorOrMessage as Error & { data?: unknown }).data : undefined;
		if (isRecord(data) && (typeof data.code === "string" || typeof data.code === "number")) {
			return {
				...data,
				code: data.code,
				message: errorOrMessage.message,
			} as ErrorPayload;
		}

		const rpcCode = "rpcCode" in errorOrMessage
			? (errorOrMessage as Error & { rpcCode?: string | number }).rpcCode
			: undefined;
		return {
			code: typeof rpcCode === "string" || typeof rpcCode === "number" ? rpcCode : fallbackCode,
			message: errorOrMessage.message,
		};
	}

	if (isRecord(errorOrMessage) && typeof errorOrMessage.message === "string") {
		const code =
			typeof errorOrMessage.code === "string" || typeof errorOrMessage.code === "number"
				? errorOrMessage.code
				: fallbackCode;
		return { ...errorOrMessage, code, message: errorOrMessage.message } as ErrorPayload;
	}

	return { code: fallbackCode, message: String(errorOrMessage) };
}

function formatCapacityValue(label: string, value: unknown, suffix = ""): string {
	return `${label}=${typeof value === "number" ? value : 0}${suffix}`;
}

function formatCapacityBundle(value: unknown): string {
	if (!isRecord(value)) {
		return "unknown";
	}

	return [
		formatCapacityValue("vCPU", value.vCpu),
		formatCapacityValue("RAM", value.ramGb, "GB"),
		formatCapacityValue("Storage", value.storageTb, "TB"),
		formatCapacityValue("GPU", value.gpuFlops),
	].join(", ");
}

export function formatTextError(errorOrMessage: unknown): string {
	const payload = normalizeErrorPayload(errorOrMessage);
	if (payload.code === "insufficient_capacity") {
		const dcId = typeof payload.dcId === "string" ? payload.dcId : "unknown-dc";
		return `Cannot accept contract on ${dcId}: insufficient available capacity (required: ${formatCapacityBundle(payload.required)}; available: ${formatCapacityBundle(payload.available)})`;
	}

	if (payload.code === "region_not_allowed") {
		const dcId = typeof payload.dcId === "string" ? payload.dcId : "unknown-dc";
		const dcRegionId = typeof payload.dcRegionId === "string" ? payload.dcRegionId : "unknown-region";
		const affinityKey = typeof payload.affinityKey === "string" ? payload.affinityKey.toUpperCase() : "REGION";
		const allowedRegionIds = Array.isArray(payload.allowedRegionIds)
			? payload.allowedRegionIds.filter((value): value is string => typeof value === "string")
			: [];
		return `Cannot accept contract on ${dcId}: ${formatRegionLabel(dcRegionId)} is not allowed (${affinityKey} only: ${allowedRegionIds.map((regionId) => formatRegionLabel(regionId)).join(", ")})`;
	}

	if (payload.code === "out_of_bounds") {
		const dcId = typeof payload.dcId === "string" ? payload.dcId : "unknown-dc";
		const rows = typeof payload.rows === "number" ? payload.rows : 0;
		const positionsPerRow = typeof payload.positionsPerRow === "number" ? payload.positionsPerRow : 0;
		return `Cannot place rack in ${dcId}: row/col out of bounds (valid rows: 0-${Math.max(rows - 1, 0)}, cols: 0-${Math.max(positionsPerRow - 1, 0)})`;
	}

	return payload.message;
}

export function formatJsonError(errorOrMessage: unknown, code: string | number = 1): string {
	return JSON.stringify({ ok: false, error: normalizeErrorPayload(errorOrMessage, code) }, null, 2);
}

export function writeCommandResult(parsed: ParsedArgv, text: string, data?: unknown): void {
	if (hasBooleanFlag(parsed, "--json")) {
		console.log(formatJsonResult(data ?? text));
		return;
	}

	if (!hasBooleanFlag(parsed, "--quiet")) {
		console.log(text);
	}
}

export function parseInteger(value: string, label: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) {
		throw new Error(`Invalid ${label}: ${value}`);
	}
	return parsed;
}

export function createShortId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function requirePositional(parsed: ParsedArgv, index: number, usage: string): string {
	const value = parsed.positionals[index];
	if (!value) {
		throw new Error(`Missing argument at position ${index + 1}. Usage: ${usage}`);
	}

	return value;
}

export async function withClient<T>(
	parsed: ParsedArgv,
	run: (client: CommandClient, paths: CommandPaths) => Promise<T>,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<T> {
	const paths = resolveCommandPaths(parsed);
	const client = clientFactory(createCommandClientOptions(parsed));
	try {
		await client.connect();
		return await run(client, paths);
	} finally {
		await client.close();
	}
}

async function canConnectToSocket(socketPath: string): Promise<boolean> {
	try {
		await new Promise<void>((resolve, reject) => {
			const socket = net.createConnection(socketPath);
			socket.once("connect", () => {
				socket.end();
				resolve();
			});
			socket.once("error", (error) => {
				socket.destroy();
				reject(error);
			});
		});
		return true;
	} catch {
		return false;
	}
}

export async function waitForDaemonShutdown(paths: Pick<CommandPaths, "socketPath" | "pidPath">, timeoutMs = 4_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const socketStillAcceptingConnections = await canConnectToSocket(paths.socketPath);
		const pidLockStillPresent = fs.existsSync(paths.pidPath);
		if (!socketStillAcceptingConnections && !pidLockStillPresent) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	throw new Error(`Timed out waiting for daemon shutdown at ${paths.socketPath}`);
}

export async function bestEffortShutdown(parsed: ParsedArgv, clientFactory?: CommandClientFactory): Promise<void> {
	const noSpawnParsed: ParsedArgv = {
		...parsed,
		flags: {
			...parsed.flags,
			"--no-daemon": true,
		},
	};

	try {
		const paths = resolveCommandPaths(parsed);
		await withClient(
			noSpawnParsed,
			async (client) => {
				await client.control({ op: "shutdown" });
			},
			clientFactory,
		);
		await waitForDaemonShutdown(paths);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("ENOENT") || message.includes("ECONNREFUSED") || message.includes("No daemon running")) {
			return;
		}
		throw error;
	}
}

export function ensureDirectoryForFile(filePath: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeStateFile(savePath: string, serializedState: string): void {
	ensureDirectoryForFile(savePath);
	fs.writeFileSync(savePath, serializedState, "utf8");
}

export function readStateFile(savePath: string): string {
	return fs.readFileSync(savePath, "utf8");
}

export function copyStateFile(sourcePath: string, destinationPath: string): void {
	ensureDirectoryForFile(destinationPath);
	fs.copyFileSync(sourcePath, destinationPath);
}

export function isGameState(value: unknown): value is GameState {
	return Boolean(value && typeof value === "object" && "tick" in (value as Record<string, unknown>) && "player" in (value as Record<string, unknown>));
}
