import { playSound } from "../audio/AudioEngine.js";
import type { GameStore } from "./gameStore.js";
import { selectActiveContracts, selectAudioEnabled } from "./selectors.js";

export function attachAudioEvents(store: GameStore): () => void {
  let prevActive = selectActiveContracts(store.getState());

  return store.subscribe(() => {
    const state = store.getState();
    const audioEnabled = selectAudioEnabled(state);
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
    }

    prevActive = currActive;
  });
}
