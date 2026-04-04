import { describe, it, expect } from "vitest";
import { UPGRADES, getUpgradeCost } from "@/data/upgrades";
import { UPGRADE_COST_SCALING } from "@/constants";

describe("upgrades", () => {
  it("every upgrade has a baseCost > 0", () => {
    for (const u of Object.values(UPGRADES)) {
      expect(u.baseCost).toBeGreaterThan(0);
    }
  });

  it("every upgrade has a minTier between 1 and 5", () => {
    for (const u of Object.values(UPGRADES)) {
      expect(u.minTier).toBeGreaterThanOrEqual(1);
      expect(u.minTier).toBeLessThanOrEqual(5);
    }
  });

  it("every upgrade has maxLevel > 0", () => {
    for (const u of Object.values(UPGRADES)) {
      expect(u.maxLevel).toBeGreaterThan(0);
    }
  });

  it("getUpgradeCost scales by 1.5x per level", () => {
    const base = 10;
    expect(getUpgradeCost(base, 0)).toBe(10);
    expect(getUpgradeCost(base, 1)).toBeCloseTo(10 * UPGRADE_COST_SCALING);
    expect(getUpgradeCost(base, 2)).toBe(Math.floor(10 * UPGRADE_COST_SCALING ** 2));
  });
});
