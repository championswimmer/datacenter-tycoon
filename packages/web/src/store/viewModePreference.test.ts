import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VIEW_MODE_PREFERENCE_KEY,
  buildViewModeUrl,
  getStoredViewModePreference,
  isGameViewMode,
  parseViewModeFromPathname,
  resolveInitialViewModeState,
  syncViewModeHistory,
  writeStoredViewModePreference,
} from "./viewModePreference.js";

describe("viewModePreference", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  describe("isGameViewMode", () => {
    it("accepts '2d' and '3d' and rejects other values", () => {
      expect(isGameViewMode("2d")).toBe(true);
      expect(isGameViewMode("3d")).toBe(true);
      expect(isGameViewMode("4d")).toBe(false);
      expect(isGameViewMode("")).toBe(false);
      expect(isGameViewMode(null)).toBe(false);
      expect(isGameViewMode(undefined)).toBe(false);
      expect(isGameViewMode(2)).toBe(false);
    });
  });

  describe("localStorage preference read/write", () => {
    it("returns null when no preference is stored", () => {
      expect(getStoredViewModePreference()).toBeNull();
    });

    it("round-trips valid '2d' and '3d' preferences", () => {
      writeStoredViewModePreference("3d");
      expect(localStorage.getItem(VIEW_MODE_PREFERENCE_KEY)).toBe("3d");
      expect(getStoredViewModePreference()).toBe("3d");

      writeStoredViewModePreference("2d");
      expect(localStorage.getItem(VIEW_MODE_PREFERENCE_KEY)).toBe("2d");
      expect(getStoredViewModePreference()).toBe("2d");
    });

    it("returns null for invalid stored values", () => {
      localStorage.setItem(VIEW_MODE_PREFERENCE_KEY, "isometric");
      expect(getStoredViewModePreference()).toBeNull();
    });

    it("swallows localStorage errors on read and write", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      expect(getStoredViewModePreference()).toBeNull();
      expect(() => writeStoredViewModePreference("3d")).not.toThrow();
    });
  });

  describe("parseViewModeFromPathname", () => {
    it("parses /2d, /3d, and trailing-slash variants", () => {
      expect(parseViewModeFromPathname("/2d")).toBe("2d");
      expect(parseViewModeFromPathname("/3d")).toBe("3d");
      expect(parseViewModeFromPathname("/2d/")).toBe("2d");
      expect(parseViewModeFromPathname("/3d/")).toBe("3d");
      expect(parseViewModeFromPathname("/app/2d")).toBe("2d");
      expect(parseViewModeFromPathname("/app/3d///")).toBe("3d");
    });

    it("returns null for root and unknown pathnames", () => {
      expect(parseViewModeFromPathname("/")).toBeNull();
      expect(parseViewModeFromPathname("")).toBeNull();
      expect(parseViewModeFromPathname("/unknown")).toBeNull();
      expect(parseViewModeFromPathname("/2d/extra")).toBeNull();
    });
  });

  describe("buildViewModeUrl", () => {
    it("preserves search query and hash when building mode URL", () => {
      expect(buildViewModeUrl("2d", { search: "", hash: "" })).toBe("/2d");
      expect(
        buildViewModeUrl("3d", { search: "?seed=abc&speed=2", hash: "#/dc/dc-1/floor" }),
      ).toBe("/3d?seed=abc&speed=2#/dc/dc-1/floor");
    });
  });

  describe("syncViewModeHistory", () => {
    it("pushes a new history entry by default when pathname differs", () => {
      const pushSpy = vi.spyOn(window.history, "pushState");
      const replaceSpy = vi.spyOn(window.history, "replaceState");

      window.history.replaceState(null, "", "/?seed=42#/contracts");
      replaceSpy.mockClear();

      syncViewModeHistory("3d");

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith(null, "", "/3d?seed=42#/contracts");
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/3d");
    });

    it("replaces history entry when replace option is true", () => {
      const pushSpy = vi.spyOn(window.history, "pushState");
      const replaceSpy = vi.spyOn(window.history, "replaceState");

      syncViewModeHistory("2d", { replace: true });

      expect(replaceSpy).toHaveBeenCalledTimes(1);
      expect(replaceSpy).toHaveBeenCalledWith(null, "", "/2d");
      expect(pushSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/2d");
    });

    it("is a no-op when pathname already matches the target mode", () => {
      window.history.replaceState(null, "", "/3d");
      const pushSpy = vi.spyOn(window.history, "pushState");
      const replaceSpy = vi.spyOn(window.history, "replaceState");

      syncViewModeHistory("3d");
      syncViewModeHistory("3d", { replace: true });

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
    });

    it("is a no-op on non-http(s) protocols such as Electron file:", () => {
      const pushSpy = vi.spyOn(window.history, "pushState");
      const replaceSpy = vi.spyOn(window.history, "replaceState");
      vi.stubGlobal("location", {
        protocol: "file:",
        pathname: "/index.html",
        search: "",
        hash: "#/dc/dc-1/floor",
      });

      syncViewModeHistory("3d");
      syncViewModeHistory("2d", { replace: true });

      expect(pushSpy).not.toHaveBeenCalled();
      expect(replaceSpy).not.toHaveBeenCalled();
    });
  });

  describe("resolveInitialViewModeState", () => {
    it("overrides stored preference when URL specifies /2d or /3d", () => {
      writeStoredViewModePreference("2d");

      const resolved = resolveInitialViewModeState("/3d");

      expect(resolved).toEqual({
        mode: "3d",
        hasStoredPreference: true,
        fromUrl: true,
      });
      expect(getStoredViewModePreference()).toBe("3d");
    });

    it("redirects root / to stored preference via replaceState", () => {
      writeStoredViewModePreference("3d");
      const replaceSpy = vi.spyOn(window.history, "replaceState");

      const resolved = resolveInitialViewModeState("/");

      expect(resolved).toEqual({
        mode: "3d",
        hasStoredPreference: true,
        fromUrl: false,
      });
      expect(replaceSpy).toHaveBeenCalledWith(null, "", "/3d");
      expect(window.location.pathname).toBe("/3d");
    });

    it("defaults to '2d' for first-time visitors without writing to localStorage", () => {
      const resolved = resolveInitialViewModeState("/");

      expect(resolved).toEqual({
        mode: "2d",
        hasStoredPreference: false,
        fromUrl: false,
      });
      expect(localStorage.getItem(VIEW_MODE_PREFERENCE_KEY)).toBeNull();
      expect(window.location.pathname).toBe("/");
    });

    it("reads window.location.pathname when no explicit pathname argument is given", () => {
      window.history.replaceState(null, "", "/2d");

      const resolved = resolveInitialViewModeState();

      expect(resolved).toEqual({
        mode: "2d",
        hasStoredPreference: true,
        fromUrl: true,
      });
      expect(getStoredViewModePreference()).toBe("2d");
    });
  });
});
