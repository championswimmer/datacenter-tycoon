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

export function attachAudioEvents(store: GameStore): () => void {
  let prevActive = selectActiveContracts(store.getState());
  let prevCash = store.getState().player.cash;
  let musicStarted = false;
  let ambientStarted = false;

  return store.subscribe(() => {
    const state = store.getState();
    const settings = selectAudioSettings(state);

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
        if (!ambientStarted) {
          ambient.start();
          ambientStarted = true;
        }

        const usage = selectResourceUsage(state);
        const capacity = selectCapacity(state);
        const servers = selectTotalServers(state);
        const load = capacity.total.vCpu > 0
          ? Math.min(1, usage.total.powerKw / (capacity.total.vCpu * 0.5))
          : 0;
        ambient.setUsage(load, servers);
        ambient.setSpeed(state.game.speed);
        ambient.setPaused(state.game.paused);
      } else if (ambientStarted) {
        ambient.stop();
        ambientStarted = false;
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
    }

    const currActive = selectActiveContracts(state);

    if (settings.master) {
      if (settings.sfx) {
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
