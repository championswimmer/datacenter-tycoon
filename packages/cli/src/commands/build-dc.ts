import type { DatacenterId, DatacenterSpecId, RackPlacementId, RackSpecId, RegionId } from "@datacenter-tycoon/game-logic";
import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";
import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
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

const FIRST_REGION_ID = Object.values(REGION_CATALOG)[0]!.id;

export async function runBuildDatacenterCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const specId = requirePositional(parsed, 0, "dct dc build <specId> [--id <dcId>] [--region <regionId>]");
	const dcId = getOptionalStringFlag(parsed, "--id") ?? createShortId("dc");
	const region = getOptionalStringFlag(parsed, "--region") ?? FIRST_REGION_ID;
	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({ type: "BuildDatacenter", specId: datacenterSpecId(specId), dcId: datacenterId(dcId), regionId: regionId(region) });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Built datacenter ${dcId}`, { dcId, specId, region });
}

export async function runAddRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct add-rack <dcId> <row> <position> <rackSpecId>");
	const row = parseInteger(requirePositional(parsed, 1, "dct add-rack <dcId> <row> <position> <rackSpecId>"), "row");
	const position = parseInteger(requirePositional(parsed, 2, "dct add-rack <dcId> <row> <position> <rackSpecId>"), "position");
	const specId = requirePositional(parsed, 3, "dct add-rack <dcId> <row> <position> <rackSpecId>");
	const placementId = getOptionalStringFlag(parsed, "--id") ?? createShortId("rp");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({
				type: "PlaceRack",
				dcId: datacenterId(dcId),
				specId: rackSpecId(specId),
				row,
				position,
				placementId: rackPlacementId(placementId),
			});
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Added rack ${placementId}`, { placementId, dcId, specId, row, position });
}

export async function runRemoveRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct remove-rack <dcId> <placementId>");
	const placementId = requirePositional(parsed, 1, "dct remove-rack <dcId> <placementId>");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({
				type: "RemoveRack",
				dcId: datacenterId(dcId),
				placementId: rackPlacementId(placementId),
			});
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Removed rack ${placementId}`, { dcId, placementId });
}

export async function runMoveRackCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const dcId = requirePositional(parsed, 0, "dct move-rack <dcId> <placementId> <targetDcId> <row> <position>");
	const placementId = requirePositional(parsed, 1, "dct move-rack <dcId> <placementId> <targetDcId> <row> <position>");
	const targetDcId = requirePositional(parsed, 2, "dct move-rack <dcId> <placementId> <targetDcId> <row> <position>");
	const row = parseInteger(requirePositional(parsed, 3, "dct move-rack <dcId> <placementId> <targetDcId> <row> <position>"), "row");
	const position = parseInteger(requirePositional(parsed, 4, "dct move-rack <dcId> <placementId> <targetDcId> <row> <position>"), "position");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({
				type: "MoveRack",
				dcId: datacenterId(dcId),
				placementId: rackPlacementId(placementId),
				targetDcId: datacenterId(targetDcId),
				row,
				position,
			});
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Moved rack ${placementId} to ${targetDcId} at row ${row}, position ${position}`, {
		dcId,
		placementId,
		targetDcId,
		row,
		position,
	});
}
