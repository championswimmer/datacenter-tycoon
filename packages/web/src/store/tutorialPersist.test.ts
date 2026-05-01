import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasSeenTutorial, markTutorialSeen, resetTutorialSeen } from "./tutorialPersist.js";

function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get _store() { return store; },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
});

describe("hasSeenTutorial", () => {
  it("returns false by default", () => {
    expect(hasSeenTutorial()).toBe(false);
  });

  it("returns true after markTutorialSeen", () => {
    markTutorialSeen();
    expect(hasSeenTutorial()).toBe(true);
  });

  it("returns false after resetTutorialSeen", () => {
    markTutorialSeen();
    resetTutorialSeen();
    expect(hasSeenTutorial()).toBe(false);
  });
});

describe("markTutorialSeen", () => {
  it("writes 'seen' to the tutorial localStorage key", () => {
    markTutorialSeen();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "datacenter-tycoon:tutorial-v1",
      "seen",
    );
  });

  it("survives a round-trip", () => {
    markTutorialSeen();
    expect(hasSeenTutorial()).toBe(true);
  });

  it("does not throw on localStorage error", () => {
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => markTutorialSeen()).not.toThrow();
  });
});

describe("resetTutorialSeen", () => {
  it("removes the tutorial key from localStorage", () => {
    markTutorialSeen();
    resetTutorialSeen();
    expect(hasSeenTutorial()).toBe(false);
  });
});
