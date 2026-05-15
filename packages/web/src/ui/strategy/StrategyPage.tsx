import { useMemo } from "react";
import {
	planContractAutopilot,
	recommendContractActions,
	recommendRackActions,
	type AdvisorRecommendation,
	type RackRecommendation,
} from "@datacenter-tycoon/game-logic";
import { useFullGameState, useGameDispatch } from "../../store/storeContext.js";
import { autopilotStore, useAutopilotPreferences, useAutopilotRunnerStatus } from "../../store/autopilotStore.js";
import { NeonButton, Panel } from "../../theme/primitives/index.js";
import styles from "./StrategyPage.module.css";

function formatMoney(value: number, showSign = false): string {
	const sign = showSign && value > 0 ? "+" : value < 0 ? "-" : "";
	const abs = Math.abs(Math.round(value));
	if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
	if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
	return `${sign}$${abs.toLocaleString()}`;
}

function recommendationTagClass(kind: AdvisorRecommendation["kind"]): string {
	switch (kind) {
		case "accept":
			return styles.tagAccept!;
		case "cancel":
			return styles.tagCancel!;
		case "swap":
			return styles.tagSwap!;
	}
}

function contractRowClass(kind: AdvisorRecommendation["kind"]): string {
	switch (kind) {
		case "accept":
			return styles.rowAccept!;
		case "cancel":
			return styles.rowCancel!;
		case "swap":
			return styles.rowSwap!;
	}
}

function rackTagClass(kind: RackRecommendation["kind"]): string {
	switch (kind) {
		case "buy":
			return styles.tagBuy!;
		case "replace":
			return styles.tagReplace!;
		case "upgrade":
			return styles.tagUpgrade!;
	}
}

function rackRowClass(kind: RackRecommendation["kind"]): string {
	switch (kind) {
		case "buy":
			return styles.rowBuy!;
		case "replace":
			return styles.rowReplace!;
		case "upgrade":
			return styles.rowUpgrade!;
	}
}

export function StrategyPage() {
	const state = useFullGameState();
	const dispatch = useGameDispatch();
	const prefs = useAutopilotPreferences();
	const runnerStatus = useAutopilotRunnerStatus();

	const contractReport = useMemo(() => recommendContractActions(state, { minNpvDelta: prefs.minNpvDelta }), [state, prefs.minNpvDelta]);
	const rackReport = useMemo(() => recommendRackActions(state, { limit: 8 }), [state]);
	const previewPlan = useMemo(
		() => planContractAutopilot(state, {
			cashBufferMonths: prefs.cashBufferMonths,
			minNpvDelta: prefs.minNpvDelta,
			maxActions: prefs.maxActionsPerTick,
		}),
		[state, prefs.cashBufferMonths, prefs.minNpvDelta, prefs.maxActionsPerTick],
	);

	const applyContractRecommendation = (recommendation: AdvisorRecommendation) => {
		switch (recommendation.kind) {
			case "accept":
				dispatch({ type: "AcceptContract", contractId: recommendation.contractId, dcId: recommendation.dcId });
				break;
			case "cancel":
				dispatch({ type: "CancelContract", contractId: recommendation.contractId });
				break;
			case "swap":
				dispatch({ type: "CancelContract", contractId: recommendation.dropContractId });
				dispatch({ type: "AcceptContract", contractId: recommendation.acceptContractId, dcId: recommendation.dcId });
				break;
		}
	};

	const applyRackRecommendation = (recommendation: RackRecommendation) => {
		switch (recommendation.kind) {
			case "buy":
			case "upgrade":
				dispatch(recommendation.action);
				break;
			case "replace":
				for (const action of recommendation.actions) {
					dispatch(action);
				}
				break;
		}
	};

	const runAutopilotNow = () => {
		for (const step of previewPlan.actions) {
			dispatch(step.action);
		}
	};

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<h2 className={styles.title}>STRATEGY</h2>
					<p className={styles.subtitle}>Autopilot + advisor algorithms for contracts and rack inventory.</p>
				</div>
			</header>

			<Panel accent="amber" className={styles.autopilotCard}>
				<div className={styles.autopilotHeader}>
					<h3 className={styles.autopilotTitle}>CONTRACT AUTOPILOT</h3>
					<button
						className={[styles.toggle, prefs.enabled ? styles.toggleOn : ""].filter(Boolean).join(" ")}
						onClick={() => autopilotStore.updatePreferences({ enabled: !prefs.enabled })}
						aria-pressed={prefs.enabled}
					>
						{prefs.enabled ? "● ON" : "○ OFF"}
					</button>
				</div>

				<p className={styles.subtitle}>
					When ON: every tick, the autopilot picks the highest-NPV contract action, including cancel-and-swap chains.
					Hard cash-buffer gate prevents bankruptcy.
				</p>

				<div className={styles.statusGrid}>
					<div className={styles.statusItem}>
						<span className={styles.statusLabel}>Pending plan</span>
						<span className={styles.statusValue}>
							{previewPlan.actions.length} action{previewPlan.actions.length === 1 ? "" : "s"}
						</span>
					</div>
					<div className={styles.statusItem}>
						<span className={styles.statusLabel}>Projected ΔNPV</span>
						<span className={styles.statusValue}>{formatMoney(previewPlan.totalExpectedDelta, true)}</span>
					</div>
					<div className={styles.statusItem}>
						<span className={styles.statusLabel}>Dispatched so far</span>
						<span className={styles.statusValue}>{runnerStatus.totalActionsDispatched}</span>
					</div>
				</div>

				<div className={styles.controlsRow}>
					<label className={styles.controlLabel}>
						Cash buffer (months)
						<input
							className={styles.controlInput}
							type="number"
							min={0}
							step={0.5}
							value={prefs.cashBufferMonths}
							onChange={(event) => autopilotStore.updatePreferences({ cashBufferMonths: Number(event.target.value) })}
						/>
					</label>
					<label className={styles.controlLabel}>
						Min ΔNPV ($)
						<input
							className={styles.controlInput}
							type="number"
							min={0}
							step={100}
							value={prefs.minNpvDelta}
							onChange={(event) => autopilotStore.updatePreferences({ minNpvDelta: Number(event.target.value) })}
						/>
					</label>
					<label className={styles.controlLabel}>
						Max actions / tick
						<input
							className={styles.controlInput}
							type="number"
							min={1}
							step={1}
							value={prefs.maxActionsPerTick}
							onChange={(event) => autopilotStore.updatePreferences({ maxActionsPerTick: Number(event.target.value) })}
						/>
					</label>
					<NeonButton variant="secondary" size="sm" disabled={previewPlan.actions.length === 0} onClick={runAutopilotNow}>
						RUN ONCE NOW
					</NeonButton>
				</div>
				{previewPlan.skippedReason && (
					<p className={styles.meta}>{previewPlan.skippedReason}</p>
				)}
			</Panel>

			<Panel accent="lime" className={styles.section}>
				<h3 className={styles.sectionHeading}>
					CONTRACT RECOMMENDATIONS
					<span className={styles.sectionBadge}>{contractReport.recommendations.length} ITEMS · TOTAL {formatMoney(contractReport.totalExpectedDelta, true)}</span>
				</h3>
				{contractReport.recommendations.length === 0 ? (
					<p className={styles.empty}>Nothing to suggest right now. The advisor reviews market + live contracts every tick.</p>
				) : (
					contractReport.recommendations.map((recommendation, index) => (
						<div key={`${recommendation.kind}-${index}`} className={[styles.row, contractRowClass(recommendation.kind)].join(" ")}>
							<span className={[styles.tag, recommendationTagClass(recommendation.kind)].join(" ")}>
								{recommendation.kind.toUpperCase()}
							</span>
							<div className={styles.body}>
								<span className={[styles.delta, recommendation.expectedDelta < 0 ? styles.deltaNegative : ""].filter(Boolean).join(" ")}>
									{formatMoney(recommendation.expectedDelta, true)}
								</span>
								<span className={styles.reason}>{recommendation.reason}</span>
							</div>
							<NeonButton size="sm" onClick={() => applyContractRecommendation(recommendation)}>
								APPLY
							</NeonButton>
						</div>
					))
				)}
			</Panel>

			<Panel accent="cyan" className={styles.section}>
				<h3 className={styles.sectionHeading}>
					RACK & INVENTORY ADVISOR
					<span className={styles.sectionBadge}>{rackReport.recommendations.length} ITEMS</span>
				</h3>
				<p className={styles.meta}>
					Unmet demand signal — vCPU: {Math.round(rackReport.unmetDemand.vCpu)} · RAM: {Math.round(rackReport.unmetDemand.ramGb)}GB · Storage:
					{" "}{Math.round(rackReport.unmetDemand.storageTb)}TB · GPU: {Math.round(rackReport.unmetDemand.gpuFlops)} FLOPS
				</p>
				{rackReport.recommendations.length === 0 ? (
					<p className={styles.empty}>No rack changes recommended. Capacity matches the current market mix.</p>
				) : (
					rackReport.recommendations.map((recommendation, index) => (
						<div key={`${recommendation.kind}-${index}`} className={[styles.row, rackRowClass(recommendation.kind)].join(" ")}>
							<span className={[styles.tag, rackTagClass(recommendation.kind)].join(" ")}>
								{recommendation.kind.toUpperCase()}
							</span>
							<div className={styles.body}>
								<span className={styles.delta}>
									{recommendation.kind === "buy"
										? `${formatMoney(recommendation.expectedMonthlyNet, true)}/mo · payback ${recommendation.paybackMonths.toFixed(1)} mo`
										: recommendation.kind === "upgrade"
											? `${formatMoney(-recommendation.capexCost)} capex`
											: `${formatMoney(-recommendation.netCapex)} rebuild`}
								</span>
								<span className={styles.reason}>{recommendation.reason}</span>
							</div>
							<NeonButton size="sm" variant="secondary" onClick={() => applyRackRecommendation(recommendation)}>
								APPLY
							</NeonButton>
						</div>
					))
				)}
			</Panel>
		</div>
	);
}
