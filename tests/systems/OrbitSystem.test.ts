import { describe, it, expect } from "vitest";
import { computeOrbitSpeed, stepOrbit } from "@/systems/OrbitSystem";

describe("OrbitSystem", () => {
  describe("computeOrbitSpeed", () => {
    it("returns higher speed for closer bodies", () => {
      const near = computeOrbitSpeed(12_000);
      const far = computeOrbitSpeed(200_000);
      expect(near).toBeGreaterThan(far);
    });

    it("returns 0 for distance 0", () => {
      expect(computeOrbitSpeed(0)).toBe(0);
    });

    it("returns a positive number for positive distance", () => {
      expect(computeOrbitSpeed(12_000)).toBeGreaterThan(0);
    });

    it("Mercury completes a full orbit in roughly 60 seconds", () => {
      const speed = computeOrbitSpeed(12_000);
      const period = (2 * Math.PI) / speed;
      expect(period).toBeGreaterThan(50);
      expect(period).toBeLessThan(70);
    });
  });

  describe("stepOrbit", () => {
    it("updates position based on angle and parent position", () => {
      const result = stepOrbit(0, 100, 0.1, 1000, 1.0, 500, 500);
      expect(result.angle).toBeCloseTo(0.1, 2);
      expect(result.x).toBeCloseTo(500 + Math.cos(0.1) * 100, 1);
      expect(result.y).toBeCloseTo(500 + Math.sin(0.1) * 100, 1);
    });

    it("respects ORBIT_SPEED_SCALE", () => {
      const slow = stepOrbit(0, 100, 0.1, 1000, 0.5, 0, 0);
      const fast = stepOrbit(0, 100, 0.1, 1000, 2.0, 0, 0);
      expect(fast.angle).toBeGreaterThan(slow.angle);
    });

    it("wraps angle past 2*PI", () => {
      const result = stepOrbit(Math.PI * 2 - 0.01, 100, 0.1, 1000, 1.0, 0, 0);
      expect(result.angle).toBeLessThan(Math.PI * 2);
      expect(result.angle).toBeGreaterThan(0);
    });
  });
});
