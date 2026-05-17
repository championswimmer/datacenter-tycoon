import { performance } from "node:perf_hooks";

import { summarizeOpenMarketContractFits } from "../query/contracts.js";
import { summarizeDistinctCapacityPoolsFromState, summarizeNetworkCapacityFromState } from "../query/datacenters.js";
import { tick } from "../sim/tick.js";
import { reduce } from "../state/reduce.js";
import {
	PERFORMANCE_FIXTURE_PROFILES,
	createPerformanceFixture,
	type PerformanceFixture,
	type PerformanceFixtureProfileName,
} from "./fixtures.js";

interface BenchmarkSample {
	name: string;
	iterations: number;
	totalMs: number;
	averageMs: number;
	minMs: number;
	maxMs: number;
	opsPerSecond: number;
	retainedHeapDeltaKbPerIteration: number | null;
	resultMarker: string;
}

interface ProfileBenchmarkResult {
	profileName: PerformanceFixtureProfileName;
	stateMarker: string;
	samples: BenchmarkSample[];
}

interface CliOptions {
	profiles: PerformanceFixtureProfileName[];
	scale: number;
	json: boolean;
}

const PROFILE_NAMES = Object.keys(PERFORMANCE_FIXTURE_PROFILES) as PerformanceFixtureProfileName[];

const DEFAULT_ITERATIONS: Record<string, Partial<Record<PerformanceFixtureProfileName, number>>> = {
	tick: {
		small: 5,
		medium: 3,
		stress: 2,
	},
	networkCapacity: {
		small: 90,
		medium: 45,
		stress: 20,
	},
	fabricPools: {
		small: 90,
		medium: 45,
		stress: 20,
	},
	contractFits: {
		small: 45,
		medium: 20,
		stress: 8,
	},
	reduceBuildDatacenter: {
		small: 30,
		medium: 20,
		stress: 10,
	},
	reducePlaceRack: {
		small: 70,
		medium: 45,
		stress: 20,
	},
	reduceRemoveRack: {
		small: 90,
		medium: 50,
		stress: 24,
	},
	reduceMoveRack: {
		small: 55,
		medium: 30,
		stress: 14,
	},
	reduceAcceptContract: {
		small: 35,
		medium: 20,
		stress: 10,
	},
	reduceCancelContract: {
		small: 70,
		medium: 40,
		stress: 20,
	},
	reduceSetMaintenanceStaff: {
		small: 100,
		medium: 60,
		stress: 30,
	},
	reduceFabricLink: {
		small: 30,
		medium: 20,
		stress: 10,
	},
};

function parseCliOptions(argv: readonly string[]): CliOptions {
	let profiles = PROFILE_NAMES;
	let scale = 1;
	let json = false;

	for (const arg of argv) {
		if (arg.startsWith("--profiles=")) {
			const requested = arg.slice("--profiles=".length).split(",").filter(Boolean) as PerformanceFixtureProfileName[];
			profiles = requested;
			continue;
		}
		if (arg.startsWith("--scale=")) {
			const parsed = Number(arg.slice("--scale=".length));
			if (Number.isFinite(parsed) && parsed > 0) {
				scale = parsed;
			}
			continue;
		}
		if (arg === "--json") {
			json = true;
		}
	}

	for (const profileName of profiles) {
		if (!PROFILE_NAMES.includes(profileName)) {
			throw new Error(`Unknown performance fixture profile '${profileName}'. Expected one of: ${PROFILE_NAMES.join(", ")}`);
		}
	}

	return { profiles, scale, json };
}

function benchmarkIterations(name: keyof typeof DEFAULT_ITERATIONS, profileName: PerformanceFixtureProfileName, scale: number): number {
	const profileConfig = DEFAULT_ITERATIONS[name];
	if (!profileConfig) {
		throw new Error(`Missing benchmark config for '${name}'`);
	}
	const configured = profileConfig[profileName];
	if (!configured) {
		throw new Error(`Missing iteration config for benchmark '${name}' profile '${profileName}'`);
	}
	return Math.max(1, Math.round(configured * scale));
}

function runGarbageCollection(): void {
	const gc = globalThis.gc as (() => void) | undefined;
	gc?.();
}

function measureRetainedHeapDelta(iterations: number, run: () => unknown): number | null {
	if (typeof process.memoryUsage !== "function") {
		return null;
	}

	runGarbageCollection();
	const before = process.memoryUsage().heapUsed;
	for (let index = 0; index < iterations; index += 1) {
		run();
	}
	runGarbageCollection();
	const after = process.memoryUsage().heapUsed;
	return (after - before) / iterations / 1024;
}

function markerOf(value: unknown): string {
	if (value && typeof value === "object") {
		if ("tick" in value && "subtick" in value && "datacenters" in value) {
			const state = value as { tick: number; subtick: number; datacenters: { placements: unknown[] }[]; contracts?: unknown[]; ledger?: unknown[] };
			const rackCount = state.datacenters.reduce((total, datacenter) => total + datacenter.placements.length, 0);
			return `state:t${state.tick}:s${state.subtick}:dc${state.datacenters.length}:r${rackCount}:c${state.contracts?.length ?? 0}:l${state.ledger?.length ?? 0}`;
		}
		if (Array.isArray(value)) {
			return `array:${value.length}`;
		}
		if ("perDc" in value && Array.isArray((value as { perDc?: unknown[] }).perDc)) {
			const summary = value as { perDc: unknown[]; available?: { vCpu: number; ramGb: number; storageTb: number; gpuFlops: number } };
			return `network:${summary.perDc.length}:${summary.available?.vCpu ?? 0}:${summary.available?.ramGb ?? 0}:${summary.available?.storageTb ?? 0}:${summary.available?.gpuFlops ?? 0}`;
		}
	}

	return String(value);
}

function measureBenchmark(name: string, iterations: number, run: () => unknown): BenchmarkSample {
	const durationsMs: number[] = [];
	let lastResult: unknown;

	for (let warmup = 0; warmup < Math.min(3, iterations); warmup += 1) {
		lastResult = run();
	}

	const start = performance.now();
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const iterationStart = performance.now();
		lastResult = run();
		durationsMs.push(performance.now() - iterationStart);
	}
	const totalMs = performance.now() - start;

	const retainedHeapDeltaKbPerIteration = measureRetainedHeapDelta(Math.min(iterations, 5), run);

	return {
		name,
		iterations,
		totalMs,
		averageMs: totalMs / iterations,
		minMs: Math.min(...durationsMs),
		maxMs: Math.max(...durationsMs),
		opsPerSecond: iterations / (totalMs / 1000),
		retainedHeapDeltaKbPerIteration,
		resultMarker: markerOf(lastResult),
	};
}

function stateMarkerOf(fixture: PerformanceFixture): string {
	const rackCount = fixture.state.datacenters.reduce((total, datacenter) => total + datacenter.placements.length, 0);
	return `regions=${fixture.state.map.regions.length}, dcs=${fixture.state.datacenters.length}, racks=${rackCount}, contracts=${fixture.state.contracts.length}`;
}

function benchmarkProfile(profileName: PerformanceFixtureProfileName, scale: number): ProfileBenchmarkResult {
	const fixture = createPerformanceFixture(profileName);
	const reduceCases = [
		{
			name: "reduceBuildDatacenter",
			run: () => reduce(fixture.state, fixture.targets.buildDatacenter),
		},
		{
			name: "reducePlaceRack",
			run: () => reduce(fixture.state, fixture.targets.placeRack),
		},
		{
			name: "reduceRemoveRack",
			run: () => reduce(fixture.state, fixture.targets.removeRack),
		},
		{
			name: "reduceMoveRack",
			run: () => reduce(fixture.state, fixture.targets.moveRack),
		},
		{
			name: "reduceAcceptContract",
			run: () => reduce(fixture.state, fixture.targets.acceptContract),
		},
		{
			name: "reduceCancelContract",
			run: () => reduce(fixture.state, fixture.targets.cancelContract),
		},
		{
			name: "reduceSetMaintenanceStaff",
			run: () => reduce(fixture.state, fixture.targets.setMaintenanceStaff),
		},
		...(fixture.targets.fabricLink
			? [
					{
						name: "reduceFabricLink",
						run: () => reduce(fixture.state, fixture.targets.fabricLink!),
					},
			  ]
			: []),
	] as const;

	const samples: BenchmarkSample[] = [
		measureBenchmark("tick", benchmarkIterations("tick", profileName, scale), () => tick(fixture.state)),
		measureBenchmark(
			"networkCapacity",
			benchmarkIterations("networkCapacity", profileName, scale),
			() => summarizeNetworkCapacityFromState(fixture.state),
		),
		measureBenchmark(
			"fabricPools",
			benchmarkIterations("fabricPools", profileName, scale),
			() => summarizeDistinctCapacityPoolsFromState(fixture.state),
		),
		measureBenchmark(
			"contractFits",
			benchmarkIterations("contractFits", profileName, scale),
			() => summarizeOpenMarketContractFits(fixture.state),
		),
		...reduceCases.map((entry) =>
			measureBenchmark(
				entry.name,
				benchmarkIterations(entry.name, profileName, scale),
				entry.run,
			),
		),
	];

	return {
		profileName,
		stateMarker: stateMarkerOf(fixture),
		samples,
	};
}

function printHumanReadable(results: readonly ProfileBenchmarkResult[]): void {
	console.log("Datacenter Tycoon — @datacenter-tycoon/game-logic performance benchmarks");
	console.log("Command: npm run bench:perf -w @datacenter-tycoon/game-logic");
	console.log("Memory metric: retained heap delta per iteration after optional GC (Node --expose-gc).");
	console.log("");

	for (const result of results) {
		console.log(`Profile: ${result.profileName} (${result.stateMarker})`);
		console.log("scenario                  iter   avg ms    min ms    max ms    ops/s     heap KB/iter   marker");
		console.log("------------------------  -----  --------  --------  --------  --------  -------------  ------------------------------");
		for (const sample of result.samples) {
			const heap = sample.retainedHeapDeltaKbPerIteration === null
				? "n/a"
				: sample.retainedHeapDeltaKbPerIteration.toFixed(2);
			console.log(
				`${sample.name.padEnd(24)}  ${String(sample.iterations).padStart(5)}  ${sample.averageMs.toFixed(3).padStart(8)}  ${sample.minMs.toFixed(3).padStart(8)}  ${sample.maxMs.toFixed(3).padStart(8)}  ${sample.opsPerSecond.toFixed(1).padStart(8)}  ${heap.padStart(13)}  ${sample.resultMarker}`,
			);
		}
		console.log("");
	}
}

async function main(): Promise<void> {
	const options = parseCliOptions(process.argv.slice(2));
	const results = options.profiles.map((profileName) => benchmarkProfile(profileName, options.scale));
	if (options.json) {
		console.log(JSON.stringify(results, null, 2));
		return;
	}
	printHumanReadable(results);
}

void main();
