import { describe, it, expect } from "vitest";
import { TUTORIAL_STEPS } from "./tutorialContent.js";

describe("TUTORIAL_STEPS", () => {
  it("has exactly 5 steps", () => {
    expect(TUTORIAL_STEPS).toHaveLength(5);
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

  it("includes an aging and maintenance step", () => {
    const maintenanceStep = TUTORIAL_STEPS[4]!;
    expect(maintenanceStep.id).toBe("maintenance");
    expect(maintenanceStep.title).toContain("Aging");
    expect(maintenanceStep.illustration).toBe("maintenance");
    expect(maintenanceStep.body).toContain("decommission");
    expect(maintenanceStep.body).toContain("maintenance staffing");
    expect(maintenanceStep.body).toContain("repair racks faster");
  });
});
