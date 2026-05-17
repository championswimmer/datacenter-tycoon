import {
	planContractAutopilot,
	recommendContractActions,
	type AdvisorRecommendation,
	type AutopilotPlan,
	type GameState,
} from "@datacenter-tycoon/game-logic";

import type { ParsedArgv } from "../argv.js";
import { DctClient } from "../client/client.js";
import {
	getNumberFlag,
	hasBooleanFlag,
	withClient,
	writeCommandResult,
	type CommandClientFactory,
} from "./common.js";

function formatMoney(value: number): string {
	const sign = value < 0 ? "-" : "";
	const abs = Math.abs(Math.round(value));
	return `${sign}$${abs.toLocaleString()}`;
}

function formatRecommendation(recommendation: AdvisorRecommendation, index: number): string {
	const lines: string[] = [];
	const tag = recommendation.kind.toUpperCase();
	lines.push(`[${index + 1}] ${tag}  Δ${formatMoney(recommendation.expectedDelta)}`);
	lines.push(`    ${recommendation.reason}`);
	return lines.join("\n");
}

export async function runAdviseContractsCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const limit = getNumberFlag(parsed, "--limit", 10);
	const minDelta = getNumberFlag(parsed, "--min-delta", 1);

	const report = await withClient(
		parsed,
		async (client) => {
			const snapshot = (await client.query({ kind: "snapshot" })) as GameState;
			return recommendContractActions(snapshot, { minNpvDelta: minDelta });
		},
		clientFactory,
	);

	const top = report.recommendations.slice(0, limit);
	const text = top.length === 0
		? "No contract actions recommended right now."
		: [
				`Top ${top.length} recommendation(s) — total expected ΔNPV: ${formatMoney(report.totalExpectedDelta)}`,
				"",
				...top.map((rec, index) => formatRecommendation(rec, index)),
			].join("\n");

	writeCommandResult(parsed, text, {
		totalExpectedDelta: report.totalExpectedDelta,
		recommendations: top,
	});
}

function formatAutopilotPlanText(plan: AutopilotPlan, applied: boolean): string {
	if (plan.actions.length === 0) {
		const reason = plan.skippedReason ?? "no profitable actions found";
		return `Autopilot plan: 0 actions (${reason}).`;
	}

	const header = `Autopilot plan: ${plan.actions.length} action(s) — total expected ΔNPV: ${formatMoney(plan.totalExpectedDelta)}`;
	const steps = plan.actions.map((step, index) => {
		switch (step.action.type) {
			case "AcceptContract":
				return `  ${index + 1}. AcceptContract ${step.action.contractId} → ${step.action.dcId}`;
			case "CancelContract":
				return `  ${index + 1}. CancelContract ${step.action.contractId}`;
			default:
				return `  ${index + 1}. ${step.action.type}`;
		}
	});

	const note = plan.skippedReason ? `\n(${plan.skippedReason})` : "";
	const tail = applied ? "\nAll actions dispatched." : "\nDry run — pass --apply to dispatch.";
	return [header, ...steps].join("\n") + note + tail;
}

export async function runAutopilotContractsCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const apply = hasBooleanFlag(parsed, "--apply");
	const maxActions = getNumberFlag(parsed, "--max-actions", 8);
	const minDelta = getNumberFlag(parsed, "--min-delta", 1);
	const cashBufferMonths = getNumberFlag(parsed, "--buffer-months", 2);

	const result = await withClient(
		parsed,
		async (client) => {
			const snapshot = (await client.query({ kind: "snapshot" })) as GameState;
			const plan = planContractAutopilot(snapshot, {
				maxActions,
				minNpvDelta: minDelta,
				cashBufferMonths,
			});

			if (apply) {
				for (const step of plan.actions) {
					await client.dispatch(step.action);
				}
			}

			return plan;
		},
		clientFactory,
	);

	writeCommandResult(parsed, formatAutopilotPlanText(result, apply), {
		applied: apply,
		plan: result,
	});
}
