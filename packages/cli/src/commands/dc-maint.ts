/**
 * `dct dc maint` — inspect and adjust maintenance staffing for a datacenter.
 *
 * Usage:
 *   dct dc maint <dcId>              show detailed staffing view
 *   dct dc maint inc <dcId> [--by n] increase maintenance staff (default +1)
 *   dct dc maint dec <dcId> [--by n] decrease maintenance staff (default -1)
 *   dct dc maint set <dcId> <count>  set an absolute staffing level
 */

import type { DatacenterMaintenanceStaffingView, DatacenterId } from "@datacenter-tycoon/game-logic";
import { getFlagValue } from "../argv.js";
import type { ParsedArgv } from "../argv.js";
import { DctClient } from "../client/client.js";
import type { DatacenterListItem, ListResult } from "../protocol/messages.js";
import { hasBooleanFlag, withClient, writeCommandResult, type CommandClient, type CommandClientFactory } from "./common.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function renderMaintenanceView(dcId: string, m: DatacenterMaintenanceStaffingView, detail = false): string[] {
	const riskLabel = m.canIncrease
		? `Spare regional staff: ${m.availableRegionalStaff}`
		: m.currentStaff >= m.maxStaff
			? "AT STAFF CAP"
			: "REGIONAL LABOR FULL";

	const lines: string[] = [
		`=== Maintenance staffing: ${dcId} ===`,
		`  Current staff   : ${m.currentStaff} / ${m.maxStaff} (max)`,
		`  Repair speed    : ${m.repairSpeedDaysPerTick.toFixed(1)} days/tick`,
		`  Repairing racks : ${m.repairingRackCount} / ${m.totalRackCount}`,
		`  Avg rack age    : ${m.averageRackAgeMonths.toFixed(1)} mo`,
		`  Wage/head/mo    : $${m.staffWagePerHead.toLocaleString()}`,
		`  Extra wages/mo  : $${m.extraWagesMonthly.toLocaleString()}`,
		`  Regional labor  : ${riskLabel}`,
	];

	if (detail) {
		lines.push("");
		lines.push(
			m.canIncrease
				? `  [+] can increase — hiring costs $${m.staffWagePerHead.toLocaleString()}/mo extra`
				: `  [-] cannot increase — ${m.currentStaff >= m.maxStaff ? "at cap" : "regional labor exhausted"}`,
		);
		lines.push(m.canDecrease ? `  [-] can decrease` : `  [=] already at 0 staff`);
	}

	return lines;
}

/** Resolve the maintenance view for a specific dcId from a datacenter list. */
function findMaintenanceView(items: DatacenterListItem[], dcId: string): DatacenterMaintenanceStaffingView {
	const item = items.find((i) => i.datacenter.id === dcId);
	if (!item) {
		throw new Error(`Datacenter not found: ${dcId}`);
	}
	return item.maintenance;
}

async function fetchDatacenterItems(client: CommandClient): Promise<DatacenterListItem[]> {
	const result = (await client.query({ kind: "list", target: "datacenters" })) as ListResult;
	return result.kind === "datacenters" ? (result.items as DatacenterListItem[]) : [];
}

// ── show ─────────────────────────────────────────────────────────────────────

async function showMaintenance(
	dcId: string,
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory,
): Promise<void> {
	const isJson = hasBooleanFlag(parsed, "--json");

	await withClient(
		parsed,
		async (client) => {
			const items = await fetchDatacenterItems(client);
			const maintenance = findMaintenanceView(items, dcId);

			if (isJson) {
				writeCommandResult(parsed, "", { ok: true, dcId, maintenance });
				return;
			}

			const lines = renderMaintenanceView(dcId, maintenance, /* detail */ true);
			writeCommandResult(parsed, lines.join("\n"), { ok: true, dcId, maintenance });
		},
		clientFactory,
	);
}

// ── mutate (inc / dec / set) ─────────────────────────────────────────────────

type MutateVerb = "inc" | "dec" | "set";

async function mutateMaintenance(
	verb: MutateVerb,
	dcId: string,
	count: number,
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory,
): Promise<void> {
	const isJson = hasBooleanFlag(parsed, "--json");

	await withClient(
		parsed,
		async (client) => {
			// fetch current view so we can compute the target count
			const itemsBefore = await fetchDatacenterItems(client);
			const before = findMaintenanceView(itemsBefore, dcId);

			// Check canIncrease before computing the target so the error is user-friendly.
			if (verb === "inc" && !before.canIncrease) {
				const reason =
					before.currentStaff >= before.maxStaff
						? "at maximum staff cap"
						: "regional labor pool exhausted";
				throw new Error(`Cannot increase maintenance staff for ${dcId}: ${reason}.`);
			}

			let target: number;
			if (verb === "inc") {
				target = before.currentStaff + count;
			} else if (verb === "dec") {
				target = before.currentStaff - count;
			} else {
				target = count;
			}

			if (target < 0) {
				throw new Error(
					`Cannot decrease maintenance staff below 0 (current: ${before.currentStaff}, by: ${count}).`,
				);
			}
			if (target > before.maxStaff) {
				throw new Error(
					`Cannot exceed max maintenance staff of ${before.maxStaff} (current: ${before.currentStaff}, requested: ${target}).`,
				);
			}
			if (target === before.currentStaff) {
				if (isJson) {
					writeCommandResult(parsed, "", {
						ok: true,
						changed: false,
						dcId,
						maintenance: before,
					});
				} else {
					writeCommandResult(
						parsed,
						`No change — maintenance staff for ${dcId} is already ${before.currentStaff}.`,
						{ ok: true, changed: false, dcId, maintenance: before },
					);
				}
				return;
			}
			// Dispatch the action
			await client.dispatch({ type: "SetMaintenanceStaff", dcId: dcId as DatacenterId, maintenanceStaff: target });

			// Fetch updated view
			const itemsAfter = await fetchDatacenterItems(client);
			const after = findMaintenanceView(itemsAfter, dcId);

			if (isJson) {
				writeCommandResult(parsed, "", {
					ok: true,
					changed: true,
					dcId,
					before: { currentStaff: before.currentStaff },
					maintenance: after,
				});
				return;
			}

			const lines = [
				`Maintenance staff updated: ${before.currentStaff} → ${after.currentStaff}`,
				...renderMaintenanceView(dcId, after),
			];
			writeCommandResult(parsed, lines.join("\n"), {
				ok: true,
				changed: true,
				dcId,
				before: { currentStaff: before.currentStaff },
				maintenance: after,
			});
		},
		clientFactory,
	);
}

// ── router ───────────────────────────────────────────────────────────────────

export async function runDcMaintCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	// positionals[0] is the verb (inc / dec / set / <dcId>)
	const first = parsed.positionals[0];

	if (!first) {
		throw new Error(
			"Usage: dct dc maint <dcId>\n" +
				"       dct dc maint inc <dcId> [--by <n>]\n" +
				"       dct dc maint dec <dcId> [--by <n>]\n" +
				"       dct dc maint set <dcId> <count>",
		);
	}

	if (first === "inc" || first === "dec") {
		const dcId = parsed.positionals[1];
		if (!dcId) {
			throw new Error(`Usage: dct dc maint ${first} <dcId> [--by <n>]`);
		}
		const byFlag = getFlagValue(parsed, "--by");
		const by = byFlag !== undefined ? Number(byFlag) : 1;
		if (!Number.isInteger(by) || by < 1) {
			throw new Error(`--by must be a positive integer, got: ${String(byFlag)}`);
		}
		await mutateMaintenance(first, dcId, by, parsed, clientFactory);
		return;
	}

	if (first === "set") {
		const dcId = parsed.positionals[1];
		const countArg = parsed.positionals[2];
		if (!dcId || countArg === undefined) {
			throw new Error("Usage: dct dc maint set <dcId> <count>");
		}
		const count = Number(countArg);
		if (!Number.isInteger(count) || count < 0) {
			throw new Error(`count must be a non-negative integer, got: ${countArg}`);
		}
		await mutateMaintenance("set", dcId, count, parsed, clientFactory);
		return;
	}

	// default: show detail for the given dcId
	await showMaintenance(first, parsed, clientFactory);
}
