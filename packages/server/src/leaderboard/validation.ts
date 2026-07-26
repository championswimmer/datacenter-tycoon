import type {
  LeaderboardVerificationAction,
  Difficulty,
} from "@datacenter-tycoon/game-logic";
import { LEADERBOARD_VERIFICATION_ACTION_TYPES } from "@datacenter-tycoon/game-logic";
import {
  LeaderboardValidationError,
  type VerifiedRunCheckpointGenesis,
  type VerifiedRunCheckpointSubmission,
} from "./types.js";

const CLIENT_RUN_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RULESET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const GAME_DIFFICULTIES = ["easy", "hard"] as const satisfies readonly Difficulty[];

export function parseVerifiedRunCheckpointSubmission(payload: unknown): VerifiedRunCheckpointSubmission {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new LeaderboardValidationError("Verified leaderboard submission must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  assertOnlyKeys(record, ["playerId", "clientRunId", "genesis", "parentHeadHash", "actions"]);

  if ("metrics" in record || "gameMonth" in record) {
    throw new LeaderboardValidationError(
      "Verified leaderboard submissions must not include client-computed metrics or gameMonth.",
    );
  }

  return {
    playerId: parseRequiredString(record.playerId, "playerId"),
    clientRunId: parseClientRunId(record.clientRunId),
    genesis: parseOptionalGenesis(record.genesis),
    parentHeadHash: parseParentHeadHash(record.parentHeadHash),
    actions: parseActions(record.actions),
  };
}

function parseOptionalGenesis(value: unknown): VerifiedRunCheckpointGenesis | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeaderboardValidationError("genesis must be an object when provided.");
  }

  const record = value as Record<string, unknown>;
  assertOnlyKeys(record, ["seed", "difficulty", "rulesetId"]);

  return {
    seed: parseSeed(record.seed),
    difficulty: parseDifficulty(record.difficulty),
    rulesetId: parseRulesetId(record.rulesetId),
  };
}

function parseActions(value: unknown): readonly LeaderboardVerificationAction[] {
  if (!Array.isArray(value)) {
    throw new LeaderboardValidationError("actions must be an array.");
  }

  return value.map((action, index) => parseAction(action, index));
}

function parseAction(value: unknown, index: number): LeaderboardVerificationAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeaderboardValidationError(`actions[${index}] must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const type = parseRequiredString(record.type, `actions[${index}].type`);

  if (!LEADERBOARD_VERIFICATION_ACTION_TYPES.includes(type as LeaderboardVerificationAction["type"])) {
    throw new LeaderboardValidationError(`actions[${index}].type is unsupported: ${type}`);
  }

  switch (type) {
    case "BuildDatacenter":
      assertOnlyKeys(record, ["type", "specId", "dcId", "regionId"]);
      return {
        type,
        specId: parseBoundedString(record.specId, `actions[${index}].specId`),
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        regionId: parseBoundedString(record.regionId, `actions[${index}].regionId`),
      } as LeaderboardVerificationAction;
    case "PlaceRack":
      assertOnlyKeys(record, ["type", "dcId", "specId", "row", "position", "placementId"]);
      return {
        type,
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        specId: parseBoundedString(record.specId, `actions[${index}].specId`),
        row: parseSmallInteger(record.row, `actions[${index}].row`),
        position: parseSmallInteger(record.position, `actions[${index}].position`),
        placementId: parseBoundedString(record.placementId, `actions[${index}].placementId`),
      } as LeaderboardVerificationAction;
    case "RemoveRack":
      assertOnlyKeys(record, ["type", "dcId", "placementId"]);
      return {
        type,
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        placementId: parseBoundedString(record.placementId, `actions[${index}].placementId`),
      } as LeaderboardVerificationAction;
    case "MoveRack":
      assertOnlyKeys(record, ["type", "dcId", "placementId", "targetDcId", "row", "position"]);
      return {
        type,
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        placementId: parseBoundedString(record.placementId, `actions[${index}].placementId`),
        targetDcId: parseBoundedString(record.targetDcId, `actions[${index}].targetDcId`),
        row: parseSmallInteger(record.row, `actions[${index}].row`),
        position: parseSmallInteger(record.position, `actions[${index}].position`),
      } as LeaderboardVerificationAction;
    case "AcceptContract":
      assertOnlyKeys(record, ["type", "contractId", "dcId"]);
      return {
        type,
        contractId: parseBoundedString(record.contractId, `actions[${index}].contractId`),
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
      } as LeaderboardVerificationAction;
    case "CancelContract":
      assertOnlyKeys(record, ["type", "contractId"]);
      return {
        type,
        contractId: parseBoundedString(record.contractId, `actions[${index}].contractId`),
      } as LeaderboardVerificationAction;
    case "FabricLink":
      assertOnlyKeys(record, ["type", "sourceDcId", "targetDcId"]);
      return {
        type,
        sourceDcId: parseBoundedString(record.sourceDcId, `actions[${index}].sourceDcId`),
        targetDcId: parseBoundedString(record.targetDcId, `actions[${index}].targetDcId`),
      } as LeaderboardVerificationAction;
    case "UpgradeDatacenter":
      assertOnlyKeys(record, ["type", "dcId", "trackId", "targetNodeId"]);
      return {
        type,
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        trackId: parseBoundedString(record.trackId, `actions[${index}].trackId`),
        targetNodeId: parseBoundedString(record.targetNodeId, `actions[${index}].targetNodeId`),
      } as LeaderboardVerificationAction;
    case "SetMaintenanceStaff":
      assertOnlyKeys(record, ["type", "dcId", "maintenanceStaff"]);
      return {
        type,
        dcId: parseBoundedString(record.dcId, `actions[${index}].dcId`),
        maintenanceStaff: parseSmallInteger(record.maintenanceStaff, `actions[${index}].maintenanceStaff`),
      } as LeaderboardVerificationAction;
    case "Subtick":
    case "Tick":
      assertOnlyKeys(record, ["type"]);
      return { type } as LeaderboardVerificationAction;
    default:
      throw new LeaderboardValidationError(`actions[${index}].type is unsupported: ${type}`);
  }
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new LeaderboardValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new LeaderboardValidationError(`${fieldName} is required.`);
  }

  return trimmed;
}

function parseClientRunId(value: unknown): string {
  const clientRunId = parseRequiredString(value, "clientRunId");

  if (!CLIENT_RUN_ID_PATTERN.test(clientRunId)) {
    throw new LeaderboardValidationError(
      "clientRunId may only contain letters, numbers, periods, underscores, colons, and hyphens.",
    );
  }

  return clientRunId;
}

function parseParentHeadHash(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  const hash = parseRequiredString(value, "parentHeadHash");

  if (!HASH_PATTERN.test(hash)) {
    throw new LeaderboardValidationError("parentHeadHash must be a 64-character lowercase hex SHA-256 digest or null.");
  }

  return hash;
}

function parseRulesetId(value: unknown): string {
  const rulesetId = parseRequiredString(value, "genesis.rulesetId");

  if (!RULESET_ID_PATTERN.test(rulesetId)) {
    throw new LeaderboardValidationError("genesis.rulesetId contains unsupported characters.");
  }

  return rulesetId;
}

function parseSeed(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new LeaderboardValidationError("genesis.seed must be a non-negative 32-bit safe integer.");
  }

  return value;
}

function parseDifficulty(value: unknown): Difficulty {
  if (typeof value !== "string" || !GAME_DIFFICULTIES.includes(value as Difficulty)) {
    throw new LeaderboardValidationError("genesis.difficulty must be one of: easy, hard.");
  }

  return value as Difficulty;
}

function parseBoundedString(value: unknown, fieldName: string): string {
  const parsed = parseRequiredString(value, fieldName);

  if (parsed.length > 128) {
    throw new LeaderboardValidationError(`${fieldName} must be at most 128 characters.`);
  }

  return parsed;
}

function parseSmallInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new LeaderboardValidationError(`${fieldName} must be a safe integer between 0 and 10000.`);
  }

  return value;
}

function assertOnlyKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new LeaderboardValidationError(
      `Unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }
}
