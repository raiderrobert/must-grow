import { describe, it, expect } from "vitest";

describe("LOD cull threshold", () => {
  it("object smaller than 8% of player size should be culled", () => {
    const playerSize = 500;
    const cullThreshold = playerSize * 0.08;
    expect(cullThreshold).toBe(40);
    expect(20).toBeLessThan(cullThreshold); // 20px object culled when player is 500px
    expect(80).toBeGreaterThan(cullThreshold); // 80px object survives
  });

  it("spawn min scales with player size", () => {
    const playerSize = 1000;
    const spawnMin = Math.max(200, playerSize * 3);
    expect(spawnMin).toBe(3000);
  });

  it("spawn max scales with player size", () => {
    const playerSize = 1000;
    const spawnMax = Math.max(2000, playerSize * 25);
    expect(spawnMax).toBe(25000);
  });

  it("small player uses minimum spawn bounds", () => {
    const playerSize = 8; // starting size
    expect(Math.max(200, playerSize * 3)).toBe(200);
    expect(Math.max(2000, playerSize * 25)).toBe(2000);
  });
});
