import { describe, it, expect } from "vitest";
import { predictTrajectory } from "@/ui/TrajectoryMath";

describe("predictTrajectory", () => {
  it("returns the correct number of points", () => {
    const points = predictTrajectory(0, 0, 100, 0, [], 30, 3, 0.08);
    expect(points).toHaveLength(30);
  });

  it("points move in velocity direction when no gravity", () => {
    const points = predictTrajectory(0, 0, 100, 0, [], 10, 1, 0.08);
    expect(points[0].x).toBeGreaterThan(0);
    expect(points[0].y).toBeCloseTo(0, 0);
    expect(points[9].x).toBeGreaterThan(points[0].x);
  });

  it("trajectory curves toward a gravity body", () => {
    const bodies = [{ x: 0, y: 1000, gravityMass: 10000, killRadius: 100 }];
    const points = predictTrajectory(0, 0, 100, 0, bodies, 30, 3, 0.08);
    const lastPoint = points[points.length - 1];
    expect(lastPoint.y).toBeGreaterThan(0);
  });

  it("returns empty array for 0 steps", () => {
    expect(predictTrajectory(0, 0, 0, 0, [], 0, 3, 0.08)).toHaveLength(0);
  });
});
