import { reduce } from "@datacenter-tycoon/game-logic";
import type { Action, GameState } from "@datacenter-tycoon/game-logic";

export interface GameStore {
  getState(): GameState;
  dispatch(action: Action): void;
  subscribe(cb: () => void): () => void;
}

/**
 * Creates a thin reactive wrapper around game-logic's pure `reduce()`.
 * Subscribers are notified synchronously after each dispatch — this is intentional
 * so that `useSyncExternalStore` always sees a consistent snapshot on the same
 * micro-task, avoiding tearing.
 */
export function createGameStore(initial: GameState): GameStore {
  let state = initial;
  const subscribers = new Set<() => void>();

  return {
    getState() {
      return state;
    },

    dispatch(action: Action) {
      state = reduce(state, action);
      // Notify all subscribers. Copy to array first so that a subscriber
      // that unsubscribes during iteration doesn't affect the current batch.
      for (const cb of [...subscribers]) {
        cb();
      }
    },

    subscribe(cb: () => void) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}
