import type {
  DatacenterId,
  RackPlacementId,
} from "@datacenter-tycoon/game-logic";

/**
 * ID helpers for the web frontend.
 *
 * IDs are generated with `crypto.randomUUID()` (available in all modern browsers
 * and Node ≥ 18) and tagged with a short type prefix for readability in devtools.
 *
 * Deterministic / seeded ID generation is not needed for the web frontend MVP —
 * the game-logic reducer validates uniqueness at the state level. If replay support
 * is added later, a seeded UUID approach can be introduced without changing the
 * game-logic contract (IDs are just branded strings there).
 */

function uuid(): string {
  // crypto.randomUUID is available in Secure Context browsers and Node ≥ 18.
  // The fallback covers jsdom in tests (which also exposes crypto.randomUUID).
  return crypto.randomUUID();
}

/** Generate a new unique DatacenterId. */
export function nextDcId(): DatacenterId {
  return `dc-${uuid()}` as DatacenterId;
}

/** Generate a new unique RackPlacementId. */
export function nextRackPlacementId(): RackPlacementId {
  return `rack-${uuid()}` as RackPlacementId;
}
