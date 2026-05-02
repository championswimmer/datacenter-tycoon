import { playSound, music, ambient } from "../audio/AudioEngine.js";
import type { GameStore } from "./gameStore.js";
import {
  selectActiveContracts,
  selectAudioSettings,
  selectResourceUsage,
  selectCapacity,
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
    
    // Handle continuous audio lifecycle
    if (settings.master) {
      // Music
      if (settings.music) {
        if (!musicStarted) {
          music.start();
          musicStarted = true;
        }
      } else {
        if (musicStarted) {
          music.stop();
          musicStarted = false;
        }
      }

      // Ambient
      if (settings.ambient) {
        if (!ambientStarted) {
          ambient.start();
          ambientStarted = true;
        }
        
        // Modulate ambient hum based on usage and scale
        const usage = selectResourceUsage(state);
        const capacity = selectCapacity(state);
        const servers = selectTotalServers(state);
        const load = capacity.total.vCpu > 0 
          ? Math.min(1, usage.total.powerKw / (capacity.total.vCpu * 0.5))
          : 0;
        ambient.setUsage(load, servers);

        // Modulate by speed and pause
        ambient.setSpeed(state.game.speed);
        ambient.setPaused(state.game.paused);
      } else {
        if (ambientStarted) {
          ambient.stop();
          ambientStarted = false;
        }
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
      // SFX (Datacenter events)
      if (settings.sfx) {
        const currActiveIds = new Set(currActive.map((c) => c.id));

        for (const prev of prevActive) {
          if (!currActiveIds.has(prev.id)) {
            const updated = state.activeContracts.find((c) => c.id === prev.id);
            if (updated?.status === "cancelled") {
              playSound("error", false);
            } else if (updated?.status === "completed") {
              playSound("success", false);
            } else {
              playSound("error", false);
            }
          }
        }
      }

      // Money sounds
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
