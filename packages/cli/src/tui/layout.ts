export type TuiTabId = "dashboard" | "datacenters" | "contracts" | "catalog";

export interface TuiLayoutModel {
	tick: number;
	cash: number;
	difficulty: "easy" | "hard";
	speedTps: number;
	paused: boolean;
	activeTab: TuiTabId;
	bodyLines: string[];
	statusLine: string;
	showHelp?: boolean;
	reconnecting?: boolean;
}

const TAB_LABELS: Array<{ id: TuiTabId; label: string }> = [
	{ id: "dashboard", label: "1 Dashboard" },
	{ id: "datacenters", label: "2 DCs" },
	{ id: "contracts", label: "3 Contracts" },
	{ id: "catalog", label: "4 Catalog" },
];

function formatMoney(amount: number): string {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function pad(line: string, width = 78): string {
	return line.length >= width ? line.slice(0, width) : line.padEnd(width);
}

export function renderLayout(model: TuiLayoutModel): string {
	const statusBadge = model.paused ? "PAUSED" : `speed ${model.speedTps}x`;
	const difficultyBadge = `mode ${model.difficulty.toUpperCase()}`;
	const header = pad(`Datacenter Tycoon  tick ${model.tick}  cash $${formatMoney(model.cash)}  ${difficultyBadge}  ${statusBadge}`);
	const tabs = TAB_LABELS.map((tab) => (tab.id === model.activeTab ? `[${tab.label}]` : ` ${tab.label} `)).join("  ");
	const reconnecting = model.reconnecting ? "  reconnecting…" : "";
	const body = model.bodyLines.length > 0 ? model.bodyLines : ["Loading terminal UI..."];
	const helpLines = model.showHelp
		? [
			"",
			"Keys: 1-4 tabs · : command palette · ? help · q quit",
			"Dashboard: default view",
			"Datacenters: arrow keys to move selection",
			"Contracts: a accept · c cancel",
		]
		: [];

	return [header, pad(`${tabs}${reconnecting}`), "-".repeat(78), ...body.map((line) => pad(line)), ...helpLines.map((line) => pad(line)), "-".repeat(78), pad(model.statusLine)].join("\n");
}
