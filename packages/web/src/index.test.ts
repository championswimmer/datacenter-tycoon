import { describe, it, expect } from "vitest";
import { VERSION } from "@datacenter-tycoon/game-logic";

describe("web package bootstrap", () => {
  it("imports VERSION from game-logic", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
