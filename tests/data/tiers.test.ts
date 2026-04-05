import { describe, it, expect } from "vitest";
import { TIERS, getTierForMass, getTierName } from "@/data/tiers";

describe("tiers", () => {
  it("has 5 tiers", () => {
    expect(TIERS).toHaveLength(5);
  });

  it("tier thresholds are ascending", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].massThreshold).toBeGreaterThan(TIERS[i - 1].massThreshold);
    }
  });

  it("getTierForMass returns tier 1 at 0 mass", () => {
    expect(getTierForMass(0)).toBe(1);
  });

  it("getTierForMass returns tier 2 at 100 mass", () => {
    expect(getTierForMass(100)).toBe(2);
  });

  it("getTierForMass returns tier 5 at 50000 mass", () => {
    expect(getTierForMass(50000)).toBe(5);
  });

  it("getTierName returns correct name", () => {
    expect(getTierName(1)).toBe("I Must Grow");
    expect(getTierName(5)).toBe("Annihilation");
  });

  it("every tier has a monologue", () => {
    for (const t of TIERS) {
      expect(t.monologue).toBeTruthy();
    }
  });
});
