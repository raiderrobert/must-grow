import { describe, it, expect, beforeEach } from "vitest";
import { ResourceManager } from "@/systems/ResourceManager";

describe("ResourceManager", () => {
  let rm: ResourceManager;
  beforeEach(() => { rm = new ResourceManager(); });

  describe("mass", () => {
    it("starts at 0", () => { expect(rm.mass).toBe(0); });

    it("addMass increases totalMassEarned", () => {
      rm.addMass(10);
      expect(rm.totalMassEarned).toBe(10);
      expect(rm.mass).toBe(10);
    });

    it("addMass applies massMultiplier", () => {
      rm.massMultiplier = 1.5;
      rm.addMass(10);
      expect(rm.mass).toBeCloseTo(15);
    });
  });

  describe("energy", () => {
    it("starts at 100", () => { expect(rm.energy).toBe(100); });

    it("onKill recharges energy", () => {
      rm.energy = 50;
      rm.onKill();
      expect(rm.energy).toBe(55);
    });

    it("onKill caps at batteryCapacity", () => {
      rm.energy = 98;
      rm.onKill();
      expect(rm.energy).toBe(100);
    });

    it("spendBurst deducts burstCost and returns true", () => {
      const spent = rm.spendBurst();
      expect(spent).toBe(true);
      expect(rm.energy).toBe(85);
    });

    it("spendBurst returns false if insufficient energy", () => {
      rm.energy = 5;
      expect(rm.spendBurst()).toBe(false);
      expect(rm.energy).toBe(5);
    });

    it("drainBoost returns false and does not drain if insufficient energy", () => {
      rm.energy = 0;
      expect(rm.drainBoost(1000)).toBe(false);
      expect(rm.energy).toBe(0);
    });

    it("drainBoost drains proportionally to delta", () => {
      rm.drainBoost(1000); // 1 second
      expect(rm.energy).toBeCloseTo(100 - 8);
    });

    it("update recharges passively", () => {
      rm.energy = 0;
      rm.update(1000); // 1 second
      expect(rm.energy).toBeCloseTo(8);
    });

    it("update caps at batteryCapacity", () => {
      rm.energy = 99;
      rm.update(1000);
      expect(rm.energy).toBe(100);
    });

    it("canBurst is false when energy below burstCost", () => {
      rm.energy = 10;
      expect(rm.canBurst).toBe(false);
    });
  });
});
