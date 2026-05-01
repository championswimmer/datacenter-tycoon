import { describe, it, expect } from "vitest";
import { TUTORIAL_STEPS } from "./tutorialContent.js";

describe("TUTORIAL_STEPS", () => {
  it("has exactly 4 steps", () => {
    expect(TUTORIAL_STEPS).toHaveLength(4);
  });

  it("every step has a non-empty id", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.id).toBeTruthy();
      expect(typeof step.id).toBe("string");
    }
  });

  it("every step has a non-empty title", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.title).toBeTruthy();
      expect(typeof step.title).toBe("string");
    }
  });

  it("every step has a non-empty body", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.body).toBeTruthy();
      expect(typeof step.body).toBe("string");
    }
  });

  it("step ids are unique", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("step 1 references live rack catalog examples", () => {
    const step1 = TUTORIAL_STEPS[0]!;
    expect(step1.id).toBe("racks");
    expect(step1.body).toContain("C1 Compute Rack");
    expect(step1.body).toContain("M1 Memory Rack");
    expect(step1.body).toContain("S1 Storage Rack");
    expect(step1.body).toContain("G1 GPU Rack");
  });
});
