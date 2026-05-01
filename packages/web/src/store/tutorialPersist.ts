const TUTORIAL_KEY = "datacenter-tycoon:tutorial-v1";

/** Returns true if the player has already seen the tutorial. */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "seen";
  } catch {
    return false;
  }
}

/** Mark the tutorial as seen so it does not auto-open again. */
export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, "seen");
  } catch {
    // Silently ignore quota / privacy errors
  }
}

/** Reset the seen flag (useful for testing). */
export function resetTutorialSeen(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    // Silently ignore
  }
}
