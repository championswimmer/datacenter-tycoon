import { playSound, music, ambient } from "../audio/AudioEngine.js";
import type { GameStore } from "./gameStore.js";
import {
  selectActiveContracts,
  selectAudioSettings,
  selectCapacity,
  selectHistoricalContracts,
  selectResourceUsage,
  selectTotalServers,
} from "./selectors.js";

const AMBIENT_LOAD_ACTIONS = new Set([
  "BuildDatacenter",
  "PlaceRack",
  "RemoveRack",
  "MoveRack",
]);

function haveSameContractIds(
  nextContracts: ReturnType<typeof selectActiveContracts>,
  prevContracts: ReturnType<typeof selectActiveContracts>,
): boolean {
  return nextContracts.length === prevContracts.length
    && nextContracts.every((contract, index) => contract.id === prevContracts[index]?.id);
}

export function attachAudioEvents(store: GameStore): () => void {
  let prevActive = selectActiveContracts(store.getState());
  let prevCash = store.getState().player.cash;
  let prevAmbientSpeed: number | null = null;
  let prevAmbientPaused: boolean | null = null;
  let musicStarted = false;
  let ambientStarted = false;

  return store.subscribe(() => {
    const state = store.getState();
    const settings = selectAudioSettings(state);
    const lastActionType = store.getLastAction()?.type;

    if (settings.master) {
      if (settings.music) {
        if (!musicStarted) {
          music.start();
          musicStarted = true;
        }
      } else if (musicStarted) {
        music.stop();
        musicStarted = false;
      }

      if (settings.ambient) {
        const ambientNeedsUsageRefresh = !ambientStarted || Boolean(lastActionType && AMBIENT_LOAD_ACTIONS.has(lastActionType));

        if (!ambientStarted) {
          ambient.start();
          ambientStarted = true;
          prevAmbientSpeed = null;
          prevAmbientPaused = null;
        }

        if (ambientNeedsUsageRefresh) {
          const usage = selectResourceUsage(state);
          const capacity = selectCapacity(state);
          const servers = selectTotalServers(state);
          const load = capacity.total.vCpu > 0
            ? Math.min(1, usage.total.powerKw / (capacity.total.vCpu * 0.5))
            : 0;
          ambient.setUsage(load, servers);
        }

        if (prevAmbientSpeed !== state.game.speed) {
          ambient.setSpeed(state.game.speed);
          prevAmbientSpeed = state.game.speed;
        }

        if (prevAmbientPaused !== state.game.paused) {
          ambient.setPaused(state.game.paused);
          prevAmbientPaused = state.game.paused;
        }
      } else if (ambientStarted) {
        ambient.stop();
        ambientStarted = false;
        prevAmbientSpeed = null;
        prevAmbientPaused = null;
      }
    } else {
      if (musicStarted) {
        music.stop();
        musicStarted = false;
      }
      if (ambientStarted) {
        ambient.stop();
        ambientStarted = false;
      }
      prevAmbientSpeed = null;
      prevAmbientPaused = null;
    }

    const currActive = selectActiveContracts(state);
    const activeIdsChanged = !haveSameContractIds(currActive, prevActive);

    if (settings.master) {
      if (settings.sfx && activeIdsChanged) {
        const currActiveIds = new Set(currActive.map((contract) => contract.id));
        const prevActiveIds = new Set(prevActive.map((contract) => contract.id));
        const historicalById = new Map(
          selectHistoricalContracts(state).map((contract) => [contract.id, contract]),
        );

        for (const curr of currActive) {
          if (!prevActiveIds.has(curr.id)) {
            playSound("contract_accepted", false);
          }
        }

        for (const prev of prevActive) {
          if (!currActiveIds.has(prev.id)) {
            const updated = historicalById.get(prev.id);
            if (updated?.lifecycleState === "cancelled") {
              playSound("error", false);
            } else if (updated?.lifecycleState === "completed") {
              playSound("success", false);
            } else {
              playSound("error", false);
            }
          }
        }
      }

      if (settings.money) {
        const cashDelta = state.player.cash - prevCash;
        if (cashDelta > 0) {
          playSound("revenue", false);
        } else if (cashDelta < 0) {
          playSound("opex", false);
        }
      }
    }

    prevActive = currActive;
    prevCash = state.player.cash;
  });
}
