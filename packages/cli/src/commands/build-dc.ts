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

const FIRST_REGION = Object.values(REGION_CATALOG)[0]!;
const FIRST_REGION_ID = FIRST_REGION.id;

function describeRegion(regionIdValue: string): {
	id: string;
	code?: string;
	city?: string;
	name?: string;
	label: string;
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
	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({ type: "BuildDatacenter", specId: datacenterSpecId(specId), dcId: datacenterId(dcId), regionId: regionId(regionDetails.id) });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Built datacenter ${dcId} in ${regionDetails.label}`, {
		dcId,
		specId,
		region: regionDetails.id,
		regionCode: regionDetails.code,
		regionCity: regionDetails.city,
		regionName: regionDetails.name,
		regionLabel: regionDetails.label,
	});
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
	const dcId = requirePositional(parsed, 0, "dct racks decom <dcId> <placementId>");
	const placementId = requirePositional(parsed, 1, "dct racks decom <dcId> <placementId>");

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
	const dcId = requirePositional(parsed, 0, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const placementId = requirePositional(parsed, 1, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const targetDcId = requirePositional(parsed, 2, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>");
	const row = parseInteger(requirePositional(parsed, 3, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>"), "row");
	const position = parseInteger(requirePositional(parsed, 4, "dct racks move <dcId> <placementId> <targetDcId> <row> <position>"), "position");

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
