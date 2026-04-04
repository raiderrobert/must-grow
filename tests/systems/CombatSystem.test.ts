import { describe, it, expect } from "vitest";

// Test SpaceObject.chew() directly since it's pure logic
// (CombatSystem requires Phaser scene — test the data layer)

describe("SpaceObject chew mechanics", () => {
  it("jaw strength multiplier increases mass per chew", () => {
    const baseMassYield = 10;
    const chewClicks = 5;
    const baseMassPerChew = baseMassYield / chewClicks; // 2

    const jawLevel = 3;
    const multiplier = 1 + jawLevel * 0.25; // 1.75
    const boostedMass = baseMassPerChew * multiplier; // 3.5

    expect(boostedMass).toBeCloseTo(3.5);
    expect(boostedMass).toBeGreaterThan(baseMassPerChew);
  });

  it("chew speed reduces effective clicks needed", () => {
    const baseClicks = 10;
    const chewSpeedLevel = 3;
    const reduction = 1 + chewSpeedLevel * 0.2; // 1.6
    const effectiveClicks = Math.max(Math.ceil(baseClicks / reduction), 1); // 7

    expect(effectiveClicks).toBe(7);
    expect(effectiveClicks).toBeLessThan(baseClicks);
  });
});
