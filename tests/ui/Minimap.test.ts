import { describe, it, expect } from "vitest";
import { computeViewRange, worldToMinimap } from "@/ui/MinimapMath";

describe("Minimap zoom logic", () => {
  it("computeViewRange uses 4th-nearest body distance with padding", () => {
    const distances = [500, 2000, 5000, 12000, 50000];
    const result = computeViewRange(distances);
    // 4th nearest = 12000, * 1.3 = 15600
    expect(result).toBe(15600);
  });

  it("computeViewRange enforces minimum of 10000", () => {
    const distances = [100, 200, 300, 400];
    const result = computeViewRange(distances);
    // 4th nearest = 400, * 1.3 = 520, but min is 10000
    expect(result).toBe(10_000);
  });

  it("computeViewRange uses farthest body when fewer than 4", () => {
    const distances = [3000, 8000];
    const result = computeViewRange(distances);
    // farthest = 8000, * 1.3 = 10400
    expect(result).toBe(10_400);
  });

  it("computeViewRange returns minimum for empty array", () => {
    expect(computeViewRange([])).toBe(10_000);
  });
});

describe("worldToMinimap", () => {
  const MAP_SIZE = 150;
  const MAP_ORIGIN_X = 100;
  const MAP_ORIGIN_Y = 100;
  const MAP_CENTER_X = MAP_ORIGIN_X + MAP_SIZE / 2;
  const MAP_CENTER_Y = MAP_ORIGIN_Y + MAP_SIZE / 2;

  it("maps player position to map center", () => {
    const pos = worldToMinimap(500, 500, 500, 500, 10000, MAP_ORIGIN_X, MAP_ORIGIN_Y, MAP_SIZE);
    expect(pos.x).toBe(MAP_CENTER_X);
    expect(pos.y).toBe(MAP_CENTER_Y);
  });

  it("maps body east of player to right of center", () => {
    const pos = worldToMinimap(1500, 500, 500, 500, 10000, MAP_ORIGIN_X, MAP_ORIGIN_Y, MAP_SIZE);
    expect(pos.x).toBeGreaterThan(MAP_CENTER_X);
    expect(pos.y).toBeCloseTo(MAP_CENTER_Y, 0);
  });

  it("clamps bodies outside map bounds to edge", () => {
    const pos = worldToMinimap(50500, 500, 500, 500, 10000, MAP_ORIGIN_X, MAP_ORIGIN_Y, MAP_SIZE);
    expect(pos.x).toBe(MAP_ORIGIN_X + MAP_SIZE - 2);
    expect(pos.clamped).toBe(true);
  });

  it("returns clamped=false when body is within bounds", () => {
    const pos = worldToMinimap(1500, 500, 500, 500, 10000, MAP_ORIGIN_X, MAP_ORIGIN_Y, MAP_SIZE);
    expect(pos.clamped).toBe(false);
  });
});
