// Entry bundled into the Go binary. Exposes the subset of game-logic the server uses,
// with JSON-string boundaries so Go never has to model GameState.
import {
  VERSION,
  LEADERBOARD_METRIC_KEYS,
  LEADERBOARD_VERIFICATION_ACTION_TYPES,
  createVerifiedGenesisState,
  replayLeaderboardVerificationActions,
  summarizeLeaderboardFromState,
  totalLeaderboardCapacity,
} from "@datacenter-tycoon/game-logic";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}
function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot encode non-finite numbers.");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") throw new Error(`Canonical JSON cannot encode values of type ${typeof value}.`);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([l], [r]) => l.localeCompare(r));
  return Object.fromEntries(entries.map(([k, v]) => [k, normalize(v)]));
}

(globalThis as any).DT = {
  version: VERSION,
  metricKeys: LEADERBOARD_METRIC_KEYS,
  actionTypes: LEADERBOARD_VERIFICATION_ACTION_TYPES,
  canonicalJson: (json: string) => canonicalJson(JSON.parse(json)),
  genesis: (descJson: string) => JSON.stringify(createVerifiedGenesisState(JSON.parse(descJson))),
  // Returns {ok:true,state,summary} or {ok:false,message}; message mirrors the TS server's
  // `error instanceof Error ? error.message : "Verified run replay failed."`.
  replay: (stateJson: string, actionsJson: string) => {
    try {
      const r = replayLeaderboardVerificationActions(JSON.parse(stateJson), JSON.parse(actionsJson));
      return JSON.stringify({ ok: true, state: r.state, summary: r.summary });
    } catch (error) {
      return JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "Verified run replay failed." });
    }
  },
  summarize: (stateJson: string) => JSON.stringify(summarizeLeaderboardFromState(JSON.parse(stateJson))),
  totalCapacity: (metricsJson: string) => totalLeaderboardCapacity(JSON.parse(metricsJson)),
};
