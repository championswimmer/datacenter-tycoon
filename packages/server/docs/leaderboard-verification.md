# Leaderboard verification protocol

This document defines the verified leaderboard checkpoint protocol that replaces trusted client score summaries.

## Goals

- The client never proves legitimacy by sending `metrics`, `money`, `gameMonth`, or a final `GameState`.
- The server derives the authoritative state and leaderboard summary by replaying validated actions from a deterministic genesis or a previously stored verified head.
- The backend stores one rolling verified checkpoint per `(playerId, clientRunId)` rather than a full action archive.

## Trust model

- The game client is **untrusted**.
- `playerId` is a bearer identifier, **not authentication**.
- HTTPS is required in deployment so checkpoint payloads and `playerId` values are not exposed in transit.
- A hash chain provides lineage and optimistic concurrency only after the server has accepted a checkpoint. It is not itself the anti-cheat mechanism.

## Protocol identifiers and limits

The server binds every accepted run to a protocol version and verifier ruleset identifier.

| Config | Default | Meaning |
| --- | --- | --- |
| `LEADERBOARD_VERIFICATION_PROTOCOL_VERSION` | `verified-run-v1` | Stable wire/hash format version. |
| `LEADERBOARD_VERIFICATION_RULESET_ID` | `leaderboard-ruleset-v1` | Server replay ruleset / season identifier. |
| `LEADERBOARD_VERIFICATION_MAX_TICK_DELTA` | `15` | Maximum completed monthly ticks advanced by one accepted checkpoint. |
| `LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT` | `1024` | Hard cap on validated replay actions in one request. Clients send one `Subtick` per game day, so the tick allowance alone accounts for `15 × 30 = 450` actions. |
| `LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES` | `262144` | Hard cap on raw JSON request bytes. |

These limits are intentionally independent. The server rejects oversized bodies and overly large action arrays even if a batch does not advance time.

## Request and response

```ts
interface VerifiedRunCheckpointRequest {
  playerId: string;
  clientRunId: string;
  genesis?: {
    seed: number;
    difficulty: "easy" | "hard";
    rulesetId: string;
  };
  parentHeadHash: string | null;
  actions: unknown[];
}

interface VerifiedRunCheckpointResponse {
  created: boolean;
  rootHash: string;
  headHash: string;
  gameMonth: number;
  metrics: {
    money: number;
    cumulativeRevenue: number;
    totalServers: number;
    computeCapacity: number;
    memoryCapacity: number;
    storageCapacity: number;
    gpuCapacity: number;
  };
}
```

Rules:

- `genesis` is required only when the server has no stored head for `(playerId, clientRunId)`.
- `parentHeadHash` must be `null` only for the first checkpoint from genesis.
- Continuation requests must omit `genesis` and must provide exactly the current stored `headHash`.
- Clients must not send score fields, final state fields, or client-computed hashes as proof.

## Stable canonicalization and hashes

The server computes hashes only from server-normalized data.

```text
rootHash    = SHA-256(canonical({ protocolVersion, rulesetId, genesisDescriptor, genesisState }))
stateHash   = SHA-256(canonical(serverPersistedResultState))
requestHash = SHA-256(canonical({ parentHeadHash, normalizedActions }))
headHash    = SHA-256(canonical({ rootHash, parentHeadHash, requestHash, stateHash }))
```

`canonical(...)` means:

- JSON primitives/arrays/objects only
- stable sorted object keys at every depth
- no `undefined`, functions, symbols, `Map`, `Set`, or non-JSON runtime values
- numbers serialized as normal JSON numbers after server validation/rounding

The server never treats a client-supplied hash as proof.

## Error codes

| Code | Meaning |
| --- | --- |
| `INVALID_VERIFIED_RUN` | Payload shape, body-size, field, or action validation failed. |
| `UNKNOWN_RUN_HEAD` | The client attempted a continuation for a run the server has never accepted. |
| `STALE_RUN_HEAD` | `parentHeadHash` does not match the current verified head for this run. |
| `RUN_RULESET_UNSUPPORTED` | The request names a ruleset or verifier id the server will not replay. |
| `RUN_TICK_GAP_EXCEEDED` | Replay would advance more than `maxTickDelta` completed monthly ticks. |
| `RUN_REPLAY_REJECTED` | The validated action batch failed during authoritative replay. |

## Compatibility and rollout policy

- Existing leaderboard rows remain stored.
- Existing rows are migrated/marked `verificationStatus: "unverified"`.
- The ranked leaderboard includes only rows with `verificationStatus: "verified"` and a matching verified run head.
- New replay-accepted checkpoints are persisted as `verificationStatus: "verified"`.
- A pre-existing local save only becomes eligible if it can submit an unbroken journal from genesis that stays within the configured gap. In practice this usually means a fresh run.
- Gameplay rule changes must either preserve the same verifier behavior for the active ruleset id or start a new verified-leaderboard season/ruleset id.

## Idempotent retry behavior

The server stores enough digest information to recognize an exact retry of the last accepted request for a run.

- If a client repeats the identical last request because it lost the prior response, the server returns the already committed success.
- If a client retries with the same parent head but different normalized actions, the request is stale/conflicting and is rejected.
- Clients must persist both their acknowledged cursor and pending action journal before compacting acknowledged actions.

## Worked flows

### Example 1 — genesis checkpoint

1. Client starts a fresh online-eligible run.
2. Client persists actions locally.
3. Client submits:

```json
{
  "playerId": "player_123",
  "clientRunId": "run-alpha",
  "genesis": {
    "seed": 42,
    "difficulty": "easy",
    "rulesetId": "leaderboard-ruleset-v1"
  },
  "parentHeadHash": null,
  "actions": [
    { "type": "BuildDatacenter", "specId": "starter-edge", "dcId": "dc-1", "regionId": "usa-west-1" }
  ]
}
```

4. Server builds canonical genesis, replays actions, derives metrics, stores the new head, and returns `{ created: true, rootHash, headHash, gameMonth, metrics }`.

### Example 2 — normal continuation

1. Client has acknowledged `headHash = H1`.
2. Client records more actions and submits `{ parentHeadHash: "H1", actions: [...] }`.
3. Server loads the authoritative snapshot for `H1`, replays the validated actions, and atomically replaces the stored head with `H2`.

### Example 3 — stale branch

1. Two devices or browser tabs branch from `H1`.
2. One checkpoint commits first and advances the run to `H2`.
3. The second request still names `parentHeadHash: "H1"`.
4. Server rejects it with `STALE_RUN_HEAD`.

### Example 4 — six-tick gap rejection

1. A client stays offline too long and accumulates six completed monthly ticks beyond the acknowledged checkpoint.
2. Replay succeeds mechanically, but `resultTick - previousTick > 5`.
3. Server rejects the request with `RUN_TICK_GAP_EXCEEDED`.
4. The client must keep the run local-only/unverified from that point onward.

### Example 5 — lost response retry

1. Server accepts a checkpoint and commits `headHash = H2`.
2. Client does not receive the HTTP response.
3. Client retries the exact same request.
4. Server recognizes the repeated parent/request digest and returns the already committed success instead of creating a second branch.

## Non-goals

This protocol does **not** claim:

- authenticated accounts or device ownership
- protection from bearer `playerId` theft
- proof that a human, rather than a script, performed the actions
- immunity to server-side or game-logic bugs
- immutable historical audit retention
