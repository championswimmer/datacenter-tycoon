import type { DatacenterId, DatacenterSpecId, RackPlacementId, RackSpecId, RegionId } from "@datacenter-tycoon/game-logic";
import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";
import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import {
	appendOnlineSyncToCommandResult,
	syncLeaderboardFromCommand,
} from "../online/sync.js";
import {
	createShortId,
	parseInteger,
	requirePositional,
	withClient,
	writeCommandResult,
	type CommandClientFactory,
} from "./common.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const datacenterSpecId = (value: string): DatacenterSpecId => value as DatacenterSpecId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;
const rackSpecId = (value: string): RackSpecId => value as RackSpecId;
const regionId = (value: string): RegionId => value as RegionId;

function getOptionalStringFlag(parsed: ParsedArgv, flag: string): string | undefined {
	const value = parsed.flags[flag];
	return typeof value === "string" ? value : undefined;
}

const FIRST_REGION = Object.values(REGION_CATALOG)[0]!;
const FIRST_REGION_ID = FIRST_REGION.id;

function describeRegion(regionIdValue: string): {
	id: string;
	code?: string;
	city?: string;
	name?: string;
	label: string;
	powerCostPerKwh?: number;
	staffWagePerMonth?: number;
} {
	const region = REGION_CATALOG[regionIdValue] ?? Object.values(REGION_CATALOG).find((entry) => entry.id === regionIdValue);
	if (!region) {
		return { id: regionIdValue, label: regionIdValue };
	}

	return {
		id: region.id,
		code: region.code,
		city: region.city,
		name: region.name,
		label: `${region.code} · ${region.city} · ${region.name}`,
		powerCostPerKwh: region.powerCostPerKwh,
		staffWagePerMonth: region.staffWage,
	};
}

export async function runBuildDatacenterCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const specId = requirePositional(parsed, 0, "dct dc build <specId> [--id <dcId>] [--region <regionId>]");
	const dcId = getOptionalStringFlag(parsed, "--id") ?? createShortId("dc");
	const region = getOptionalStringFlag(parsed, "--region") ?? FIRST_REGION_ID;
	const regionDetails = describeRegion(region);
	const onlineSync = await withClient(
		parsed,
		async (client, paths) => {
			await client.dispatch({ type: "BuildDatacenter", specId: datacenterSpecId(specId), dcId: datacenterId(dcId), regionId: regionId(regionDetails.id) });
			return await syncLeaderboardFromCommand(parsed, client, paths);
		},
		clientFactory,
	);

	const regionOpexSummary = regionDetails.powerCostPerKwh !== undefined && regionDetails.staffWagePerMonth !== undefined
		? `Power $${regionDetails.powerCostPerKwh.toFixed(3)}/kWh, Labor $${regionDetails.staffWagePerMonth.toLocaleString()}/mo`
		: undefined;

	const output = appendOnlineSyncToCommandResult(
		`Built datacenter ${dcId} in ${regionDetails.label}${regionOpexSummary ? ` (${regionOpexSummary})` : ""}`,
		{
			dcId,
			specId,
			region: regionDetails.id,
			regionCode: regionDetails.code,
			regionCity: regionDetails.city,
			regionName: regionDetails.name,
			regionLabel: regionDetails.label,
			powerCostPerKwh: regionDetails.powerCostPerKwh,
			staffWagePerMonth: regionDetails.staffWagePerMonth,
		},
		onlineSync,
	);

	writeCommandResult(parsed, output.text, output.data);
}

export async function runAddRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct racks add <dcId> <row> <position> <rackSpecId>");
	const row = parseInteger(requirePositional(parsed, 1, "dct racks add <dcId> <row> <position> <rackSpecId>"), "row");
	const position = parseInteger(requirePositional(parsed, 2, "dct racks add <dcId> <row> <position> <rackSpecId>"), "position");
	const specId = requirePositional(parsed, 3, "dct racks add <dcId> <row> <position> <rackSpecId>");
	const placementId = getOptionalStringFlag(parsed, "--id") ?? createShortId("rp");

	const onlineSync = await withClient(
		parsed,
		async (client, paths) => {
			await client.dispatch({
				type: "PlaceRack",
				dcId: datacenterId(dcId),
				specId: rackSpecId(specId),
				row,
				position,
				placementId: rackPlacementId(placementId),
			});
			return await syncLeaderboardFromCommand(parsed, client, paths);
		},
		clientFactory,
	);

	const output = appendOnlineSyncToCommandResult(
		`Added rack ${placementId}`,
		{ placementId, dcId, specId, row, position },
		onlineSync,
	);

	writeCommandResult(parsed, output.text, output.data);
}

export async function runRemoveRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct racks decom <dcId> <placementId>");
	const placementId = requirePositional(parsed, 1, "dct racks decom <dcId> <placementId>");

	const onlineSync = await withClient(
		parsed,
		async (client, paths) => {
			await client.dispatch({
				type: "RemoveRack",
				dcId: datacenterId(dcId),
				placementId: rackPlacementId(placementId),
			});
			return await syncLeaderboardFromCommand(parsed, client, paths);
		},
		clientFactory,
	);

	const output = appendOnlineSyncToCommandResult(
		`Removed rack ${placementId}`,
		{ dcId, placementId },
		onlineSync,
	);

	writeCommandResult(parsed, output.text, output.data);
}

export async function runMoveRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const placementId = requirePositional(parsed, 1, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const targetDcId = requirePositional(parsed, 2, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const row = parseInteger(requirePositional(parsed, 3, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>"), "row");
	const position = parseInteger(requirePositional(parsed, 4, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>"), "position");

	const onlineSync = await withClient(
		parsed,
		async (client, paths) => {
			await client.dispatch({
				type: "MoveRack",
				dcId: datacenterId(dcId),
				placementId: rackPlacementId(placementId),
				targetDcId: datacenterId(targetDcId),
				row,
				position,
			});
			return await syncLeaderboardFromCommand(parsed, client, paths);
		},
		clientFactory,
	);

	const output = appendOnlineSyncToCommandResult(
		`Moved rack ${placementId} to ${targetDcId} at row ${row}, position ${position}`,
		{
			dcId,
			placementId,
			targetDcId,
			row,
			position,
		},
		onlineSync,
	);

	writeCommandResult(parsed, output.text, output.data);
}
