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

  it("isInLethalZone returns true when inside killRadius", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    expect(gs.isInLethalZone(200, 0, 100)).toBe(true);
    expect(gs.isInLethalZone(600, 0, 100)).toBe(false);
  });

  it("isInLethalZone returns true at exact killRadius boundary", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    expect(gs.isInLethalZone(499, 0, 100)).toBe(true);
    expect(gs.isInLethalZone(501, 0, 100)).toBe(false);
  });

  it("isInLethalZone checks multiple bodies", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 100 });
    gs.addBody({ x: 5000, y: 0, gravityMass: 1000, killRadius: 200 });
    expect(gs.isInLethalZone(4900, 0, 100)).toBe(true);
    expect(gs.isInLethalZone(2500, 0, 100)).toBe(false);
  });

  it("getApproachFactor returns 0 outside warning band", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    expect(gs.getApproachFactor(700, 0)).toBe(0);
  });

  it("getApproachFactor returns ~1 at kill surface", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    expect(gs.getApproachFactor(501, 0)).toBeGreaterThan(0.9);
  });

  it("getApproachFactor returns value between 0 and 1 in warning band", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    const factor = gs.getApproachFactor(550, 0);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(1);
  });

  it("getApproachFactor picks the highest factor from multiple bodies", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    gs.addBody({ x: 2000, y: 0, gravityMass: 1000, killRadius: 500 });
    const factor = gs.getApproachFactor(1550, 0);
    expect(factor).toBeGreaterThan(0);
  });

  it("removeBody stops kill zone from being checked", () => {
    const body = { x: 0, y: 0, gravityMass: 1000, killRadius: 500 };
    gs.addBody(body);
    expect(gs.isInLethalZone(200, 0, 100)).toBe(true);
    gs.removeBody(body);
    expect(gs.isInLethalZone(200, 0, 100)).toBe(false);
  });
});
