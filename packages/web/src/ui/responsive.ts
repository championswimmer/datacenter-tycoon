import { useSyncExternalStore } from "react";

export const PHONE_MAX_WIDTH = 767;
export const TABLET_MAX_WIDTH = 1023;
export const MIN_TOUCH_TARGET_PX = 44;
export const COMFORTABLE_TOUCH_TARGET_PX = 48;

export type ResponsiveMode = "phone" | "tablet" | "desktop";

export function getResponsiveMode(width: number): ResponsiveMode {
  if (width <= PHONE_MAX_WIDTH) {
    return "phone";
  }
  if (width <= TABLET_MAX_WIDTH) {
    return "tablet";
  }
  return "desktop";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("resize", onStoreChange, { passive: true });

  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function getSnapshot(): ResponsiveMode {
  if (typeof window === "undefined") {
    return "desktop";
  }

  return getResponsiveMode(window.innerWidth);
}

export function useResponsiveMode(): ResponsiveMode {
  // SSR has no viewport information, so default to desktop to preserve the
  // existing non-overlay shell layout until the client hydrates and measures.
  return useSyncExternalStore(subscribe, getSnapshot, () => "desktop");
}

export function useIsPhoneViewport(): boolean {
  return useResponsiveMode() === "phone";
}
