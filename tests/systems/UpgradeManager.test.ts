import { describe, it, expect, beforeEach } from "vitest";
import { UpgradeManager } from "@/systems/UpgradeManager";
import { ResourceManager } from "@/systems/ResourceManager";

describe("UpgradeManager", () => {
  let um: UpgradeManager;
  let rm: ResourceManager;

  beforeEach(() => {
    rm = new ResourceManager();
    um = new UpgradeManager(rm);
  });

  it("all upgrades start at level 0", () => {
    expect(um.getLevel("thrusters")).toBe(0);
    expect(um.getLevel("beamPower")).toBe(0);
  });

  it("canPurchase returns false if not enough mass", () => {
    expect(um.canPurchase("thrusters", 1)).toBe(false);
  });

  it("canPurchase returns false if tier too low", () => {
    rm.addMass(1000);
    expect(um.canPurchase("beamPower", 1)).toBe(false); // requires tier 2
  });

  it("canPurchase returns true if enough mass and tier", () => {
    rm.addMass(1000);
    expect(um.canPurchase("thrusters", 1)).toBe(true);
  });

  it("purchase deducts mass and increments level", () => {
    rm.addMass(100);
    const cost = um.getNextCost("thrusters");
    const result = um.purchase("thrusters", 1);
    expect(result).toBe(true);
    expect(um.getLevel("thrusters")).toBe(1);
    expect(rm.mass).toBe(100 - cost);
  });

  it("purchase fails if at max level", () => {
    rm.addMass(999999);
    const def = um.getDefinition("clampRange");
    for (let i = 0; i < def.maxLevel; i++) {
      um.purchase("clampRange", 1);
    }
    expect(um.purchase("clampRange", 1)).toBe(false);
    expect(um.getLevel("clampRange")).toBe(def.maxLevel);
  });

  it("getNextCost scales with level", () => {
    rm.addMass(999999);
    const cost0 = um.getNextCost("thrusters");
    um.purchase("thrusters", 1);
    const cost1 = um.getNextCost("thrusters");
    expect(cost1).toBeGreaterThan(cost0);
  });

  it("getAvailableUpgrades filters by tier", () => {
    const tier1 = um.getAvailableUpgrades(1);
    const tier2 = um.getAvailableUpgrades(2);
    expect(tier1.every((u) => u.minTier <= 1)).toBe(true);
    expect(tier2.length).toBeGreaterThan(tier1.length);
  });
});
