import { type SpaceObjectConfig } from "@/entities/SpaceObject";

export interface ZoneDefinition {
  name: string;
  minDistance: number;
  maxDistance: number;
  spawnTable: SpawnEntry[];
  maxObjects: number;
  /** Objects smaller than this ratio relative to player size get culled */
  cullBelowPlayerRatio: number;
  /** Only spawn when player is within this many pixels of zone boundary */
  activationRange: number;
}

export interface SpawnEntry {
  weight: number;
  minTier: number;
  factory: () => Omit<SpaceObjectConfig, "x" | "y">;
}

const junkColors = [0x888888, 0x666666, 0x999999, 0xaaaaaa];
const asteroidColors = [0x8b7355, 0xa0926b, 0x7a6b50, 0x6b5c3e];
const iceColors = [0xaaccee, 0x88aacc, 0xccddff];

export const ZONES: ZoneDefinition[] = [
  {
    name: "Near-Earth Orbit",
    minDistance: 95_000,
    maxDistance: 115_000,
    maxObjects: 40,
    cullBelowPlayerRatio: 0.05,
    activationRange: 15_000,
    spawnTable: [
      {
        weight: 5, minTier: 1,
        factory: () => ({
          size: 20 + Math.random() * 30,
          health: 15,
          massYield: 3,
          energyYield: 1,
          gravityMass: 0,
          color: junkColors[Math.floor(Math.random() * junkColors.length)],
        }),
      },
      {
        weight: 3, minTier: 1,
        factory: () => ({
          size: 40 + Math.random() * 40,
          health: 30,
          massYield: 8,
          energyYield: 2,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 1, minTier: 1,
        factory: () => ({
          size: 35 + Math.random() * 20,
          health: 25,
          massYield: 12,
          energyYield: 4,
          gravityMass: 0,
          color: 0xaaaacc,
          name: "Satellite",
        }),
      },
    ],
  },
  {
    name: "Inner Solar System",
    minDistance: 70_000,
    maxDistance: 95_000,
    maxObjects: 30,
    cullBelowPlayerRatio: 0.03,
    activationRange: 15_000,
    spawnTable: [
      {
        weight: 6, minTier: 1,
        factory: () => ({
          size: 60 + Math.random() * 80,
          health: 50,
          massYield: 15,
          energyYield: 5,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 2, minTier: 2,
        factory: () => ({
          size: 100 + Math.random() * 60,
          health: 120,
          massYield: 35,
          energyYield: 10,
          gravityMass: 0,
          color: 0x6699cc,
        }),
      },
    ],
  },
  {
    name: "Asteroid Belt",
    minDistance: 125_000,
    maxDistance: 145_000,
    maxObjects: 300,
    cullBelowPlayerRatio: 0.02,
    activationRange: 20_000,
    spawnTable: [
      {
        weight: 10, minTier: 2,
        factory: () => ({
          size: 80 + Math.random() * 200,
          health: 40 + Math.random() * 80,
          massYield: 20 + Math.random() * 40,
          energyYield: 5 + Math.random() * 10,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 2, minTier: 2,
        factory: () => ({
          size: 300 + Math.random() * 200,
          health: 200,
          massYield: 100,
          energyYield: 20,
          gravityMass: 0,
          color: 0x998877,
        }),
      },
    ],
  },
  {
    name: "Outer Solar System",
    minDistance: 155_000,
    maxDistance: 195_000,
    maxObjects: 25,
    cullBelowPlayerRatio: 0.01,
    activationRange: 20_000,
    spawnTable: [
      {
        weight: 5, minTier: 3,
        factory: () => ({
          size: 200 + Math.random() * 400,
          health: 300,
          massYield: 200,
          energyYield: 50,
          gravityMass: 0,
          color: 0x99aacc,
        }),
      },
    ],
  },
  {
    name: "Kuiper Belt",
    minDistance: 195_000,
    maxDistance: 200_000,
    maxObjects: 20,
    cullBelowPlayerRatio: 0.005,
    activationRange: 20_000,
    spawnTable: [
      {
        weight: 5, minTier: 4,
        factory: () => ({
          size: 500 + Math.random() * 500,
          health: 800,
          massYield: 500,
          energyYield: 100,
          gravityMass: 0,
          color: iceColors[Math.floor(Math.random() * iceColors.length)],
        }),
      },
    ],
  },
];
