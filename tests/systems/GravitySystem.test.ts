import { describe, it, expect, beforeEach } from "vitest";
import { GravitySystem, GravityBody } from "@/systems/GravitySystem";

describe("GravitySystem", () => {
  let gs: GravitySystem;

  beforeEach(() => {
    gs = new GravitySystem();
  });

  it("calculates pull force inversely proportional to distance squared", () => {
    const body: GravityBody = { x: 0, y: 0, gravityMass: 1000 };
    const close = gs.calculatePull(body, 100, 0);
    const far = gs.calculatePull(body, 200, 0);
    // At 2x distance, force should be ~4x weaker
    expect(close.magnitude).toBeGreaterThan(far.magnitude * 3.5);
  });

  it("pull direction points toward the body", () => {
    const body: GravityBody = { x: 0, y: 0, gravityMass: 1000 };
    const pull = gs.calculatePull(body, 500, 0); // player is to the right
    expect(pull.x).toBeLessThan(0); // should pull left toward body
    expect(Math.abs(pull.y)).toBeLessThan(0.01); // no vertical component
  });

  it("returns zero pull when on top of body (avoid divide by zero)", () => {
    const body: GravityBody = { x: 100, y: 100, gravityMass: 1000 };
    const pull = gs.calculatePull(body, 100, 100);
    expect(pull.magnitude).toBe(0);
  });

  it("danger level returns 'safe' at far distance", () => {
    const body: GravityBody = { x: 0, y: 0, gravityMass: 1000 };
    expect(gs.getDangerLevel(body, 5000, 0, 100)).toBe("safe");
  });

  it("danger level returns 'deadly' at very close distance with low thrust", () => {
    const body: GravityBody = { x: 0, y: 0, gravityMass: 10000 };
    expect(gs.getDangerLevel(body, 50, 0, 10)).toBe("deadly");
  });
});
