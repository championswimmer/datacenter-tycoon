export type GameViewMode = "2d" | "3d";

export const VIEW_MODE_PREFERENCE_KEY = "datacenter-tycoon:view-mode-v1";

export interface ResolvedViewModeState {
  mode: GameViewMode;
  hasStoredPreference: boolean;
  fromUrl: boolean;
}

/** Type guard for supported game view modes. */
export function isGameViewMode(value: unknown): value is GameViewMode {
  return value === "2d" || value === "3d";
}

/** Read the persisted view mode preference from localStorage, or null if unset/invalid. */
export function getStoredViewModePreference(): GameViewMode | null {
  try {
    const stored = localStorage.getItem(VIEW_MODE_PREFERENCE_KEY);
    return isGameViewMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persist the selected view mode preference to localStorage. */
export function writeStoredViewModePreference(mode: GameViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_PREFERENCE_KEY, mode);
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}

/** Parse a view mode ("2d" or "3d") from a URL pathname, ignoring trailing slashes. */
export function parseViewModeFromPathname(pathname: string): GameViewMode | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized === "/3d" || normalized.endsWith("/3d")) return "3d";
  if (normalized === "/2d" || normalized.endsWith("/2d")) return "2d";
  return null;
}

/** Build a root-relative view mode URL preserving query string and hash. */
export function buildViewModeUrl(
  mode: GameViewMode,
  locationLike: Pick<Location, "search" | "hash"> = typeof window !== "undefined"
    ? window.location
    : { search: "", hash: "" },
): string {
  return `/${mode}${locationLike.search || ""}${locationLike.hash || ""}`;
}

/** Synchronize browser history pathname to the active view mode on http(s) origins. */
export function syncViewModeHistory(
  mode: GameViewMode,
  options: { replace?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return;
  if (parseViewModeFromPathname(window.location.pathname) === mode) return;

  window.history[options.replace ? "replaceState" : "pushState"](
    null,
    "",
    buildViewModeUrl(mode, window.location),
  );
}

/** Resolve the initial view mode from URL pathname, stored preference, or first-time default. */
export function resolveInitialViewModeState(pathname?: string): ResolvedViewModeState {
  const targetPathname =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const urlMode = parseViewModeFromPathname(targetPathname);
  const storedMode = getStoredViewModePreference();

  if (urlMode) {
    writeStoredViewModePreference(urlMode);
    return {
      mode: urlMode,
      hasStoredPreference: true,
      fromUrl: true,
    };
  }

  if (storedMode) {
    syncViewModeHistory(storedMode, { replace: true });
    return {
      mode: storedMode,
      hasStoredPreference: true,
      fromUrl: false,
    };
  }

  return {
    mode: "2d",
    hasStoredPreference: false,
    fromUrl: false,
  };
}
