import { describe, it, expect } from "vitest";
import { BODY_DEFS } from "@/data/bodies";

describe("BODY_DEFS", () => {
  it("defines exactly 9 celestial bodies", () => {
    expect(BODY_DEFS).toHaveLength(9);
  });

  it("every body has killRadius equal to visualRadius", () => {
    for (const body of BODY_DEFS) {
      expect(body.killRadius, `${body.name} killRadius`).toBe(body.visualRadius);
    }
  });

  it("every body has a color", () => {
    for (const body of BODY_DEFS) {
      expect(body.color, `${body.name} color`).toBeGreaterThan(0);
    }
  });

  it("every body has positive health, massYield, and energyYield", () => {
    for (const body of BODY_DEFS) {
      expect(body.health, `${body.name} health`).toBeGreaterThan(0);
      expect(body.massYield, `${body.name} massYield`).toBeGreaterThan(0);
      expect(body.energyYield, `${body.name} energyYield`).toBeGreaterThan(0);
    }
  });

  it("every body has at least one visual primitive", () => {
    for (const body of BODY_DEFS) {
      expect(body.visual.length, `${body.name} visual primitives`).toBeGreaterThan(0);
    }
  });

  it("all body names are unique", () => {
    const names = BODY_DEFS.map(b => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes Earth, Sun, and all 7 named planets", () => {
    const names = BODY_DEFS.map(b => b.name);
    for (const expected of ["Sun", "Earth", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
      expect(names, `missing ${expected}`).toContain(expected);
    }
  });
});
