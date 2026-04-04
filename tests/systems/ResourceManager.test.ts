import { describe, it, expect, beforeEach } from "vitest";
import { ResourceManager } from "@/systems/ResourceManager";
import { STARTING_ENERGY, STARTING_BATTERY_CAPACITY, ENERGY_PER_MANUAL_CLICK } from "@/constants";

describe("ResourceManager", () => {
  let rm: ResourceManager;

  beforeEach(() => {
    rm = new ResourceManager();
  });

  describe("mass", () => {
    it("starts at 0", () => {
      expect(rm.mass).toBe(0);
    });

    it("addMass increases total mass", () => {
      rm.addMass(50);
      expect(rm.mass).toBe(50);
    });

    it("spendMass reduces mass and returns true if affordable", () => {
      rm.addMass(100);
      expect(rm.spendMass(60)).toBe(true);
      expect(rm.mass).toBe(40);
    });

    it("spendMass returns false and does nothing if unaffordable", () => {
      rm.addMass(10);
      expect(rm.spendMass(20)).toBe(false);
      expect(rm.mass).toBe(10);
    });

    it("totalMassEarned tracks lifetime mass regardless of spending", () => {
      rm.addMass(100);
      rm.spendMass(60);
      expect(rm.totalMassEarned).toBe(100);
      expect(rm.mass).toBe(40);
    });
  });

  describe("energy", () => {
    it("starts at STARTING_ENERGY", () => {
      expect(rm.energy).toBe(STARTING_ENERGY);
    });

    it("battery capacity starts at STARTING_BATTERY_CAPACITY", () => {
      expect(rm.batteryCapacity).toBe(STARTING_BATTERY_CAPACITY);
    });

    it("addEnergy caps at battery capacity", () => {
      rm.addEnergy(9999);
      expect(rm.energy).toBe(STARTING_BATTERY_CAPACITY);
    });

    it("drainEnergy reduces energy", () => {
      rm.drainEnergy(10);
      expect(rm.energy).toBe(STARTING_ENERGY - 10);
    });

    it("drainEnergy does not go below 0", () => {
      rm.drainEnergy(9999);
      expect(rm.energy).toBe(0);
    });

    it("manualGenerate adds ENERGY_PER_MANUAL_CLICK", () => {
      rm.drainEnergy(STARTING_ENERGY); // empty
      rm.manualGenerate();
      expect(rm.energy).toBe(ENERGY_PER_MANUAL_CLICK);
    });

    it("energyRatio returns energy / batteryCapacity", () => {
      expect(rm.energyRatio).toBeCloseTo(STARTING_ENERGY / STARTING_BATTERY_CAPACITY);
    });

    it("isPowerDead returns true when energy is 0", () => {
      rm.drainEnergy(9999);
      expect(rm.isPowerDead).toBe(true);
    });
  });

  describe("fusion reactor mass drain", () => {
    it("massDrainRate reduces mass over time", () => {
      rm.addMass(100);
      rm.massDrainRate = 5; // 5 mass/sec
      rm.updateEnergy(1000); // 1 second
      expect(rm.mass).toBeCloseTo(95);
    });

    it("mass drain stops when mass is insufficient", () => {
      rm.addMass(2);
      rm.massDrainRate = 5;
      rm.updateEnergy(1000);
      expect(rm.mass).toBeGreaterThanOrEqual(0);
    });
  });

  describe("energy generation and drain rates", () => {
    it("net generation rate accounts for generation and drain", () => {
      rm.generationRate = 10;
      rm.drainRate = 4;
      expect(rm.netEnergyRate).toBe(6);
    });

    it("updateEnergy applies net rate over delta seconds", () => {
      rm.generationRate = 10;
      rm.drainRate = 0;
      rm.drainEnergy(STARTING_ENERGY); // start at 0
      rm.updateEnergy(1000); // 1 second in ms
      expect(rm.energy).toBeCloseTo(10);
    });
  });
});
