import { playSound, music, ambient } from "../audio/AudioEngine.js";
import type { GameStore } from "./gameStore.js";
import {
  selectActiveContracts,
  selectAudioEnabled,
  selectResourceUsage,
  selectCapacity,
} from "./selectors.js";

export function attachAudioEvents(store: GameStore): () => void {
  let prevActive = selectActiveContracts(store.getState());
  let prevCash = store.getState().player.cash;
  let musicStarted = false;
  let ambientStarted = false;

  return store.subscribe(() => {
    const state = store.getState();
    const audioEnabled = selectAudioEnabled(state);
    
    // Handle continuous audio lifecycle
    if (audioEnabled) {
      if (!musicStarted) {
        music.start();
        musicStarted = true;
      }
      if (!ambientStarted) {
        ambient.start();
        ambientStarted = true;
      }

      // Modulate ambient hum based on usage
      const usage = selectResourceUsage(state);
      const capacity = selectCapacity(state);
      
      // Calculate a rough "load" percentage based on power usage
      const load = capacity.total.vCpu > 0 
        ? Math.min(1, usage.total.powerKw / (capacity.total.vCpu * 0.5)) // 0.5kW per vCPU is a rough guess
        : 0;
      
      ambient.setUsage(load);
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

    if (audioEnabled) {
      const currActiveIds = new Set(currActive.map((c) => c.id));

      for (const prev of prevActive) {
        if (!currActiveIds.has(prev.id)) {
          // A contract dropped out of the active list.
          const updated = state.activeContracts.find((c) => c.id === prev.id);
          
          if (updated?.status === "cancelled") {
            playSound("error", false);
          } else if (updated?.status === "completed") {
            playSound("success", false);
          } else {
            // Fallback for any other removal
            playSound("error", false);
          }
        }
      }

      // Money sounds
      const cashDelta = state.player.cash - prevCash;
      if (cashDelta > 0) {
        playSound("revenue", false);
      } else if (cashDelta < 0) {
        // Only play opex sound if it's a significant drop (avoid small maintenance blips if any)
        // or just play it for any drop since it's likely opex/capex.
        playSound("opex", false);
      }
    }

    prevActive = currActive;
    prevCash = state.player.cash;
  });
}
