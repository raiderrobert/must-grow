import { type SpaceObjectConfig } from "@/entities/SpaceObject";

export interface ZoneDefinition {
  name: string;
  minDistance: number; // from center of world
  maxDistance: number;
  spawnTable: SpawnEntry[];
  maxObjects: number;
}

export interface SpawnEntry {
  weight: number; // relative spawn probability
  minTier: number;
  factory: (x: number, y: number) => Omit<SpaceObjectConfig, "x" | "y">;
}

const junkColors = [0x888888, 0x666666, 0x999999];
const asteroidColors = [0x8b7355, 0xa0926b, 0x7a6b50];

export const ZONES: ZoneDefinition[] = [
  {
    name: "Near-Earth Orbit",
    minDistance: 0,
    maxDistance: 1000,
    maxObjects: 25,
    spawnTable: [
      {
        weight: 5,
        minTier: 1,
        factory: () => ({
          size: 6 + Math.random() * 4,
          health: 10,
          massYield: 2,
          energyYield: 1,
          gravityMass: 0,
          color: junkColors[Math.floor(Math.random() * junkColors.length)],
          chewClicks: 3,
        }),
      },
      {
        weight: 3,
        minTier: 1,
        factory: () => ({
          size: 10 + Math.random() * 6,
          health: 20,
          massYield: 5,
          energyYield: 2,
          gravityMass: 0,
          color:
            asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
          chewClicks: 5,
        }),
      },
      {
        weight: 1,
        minTier: 1,
        factory: () => ({
          size: 8 + Math.random() * 4,
          health: 15,
          massYield: 8,
          energyYield: 3,
          gravityMass: 0,
          color: 0xaaaacc,
          name: "Satellite",
          chewClicks: 6,
        }),
      },
    ],
  },
  {
    name: "Inner Solar System",
    minDistance: 1000,
    maxDistance: 2500,
    maxObjects: 20,
    spawnTable: [
      {
        weight: 5,
        minTier: 2,
        factory: () => ({
          size: 12 + Math.random() * 10,
          health: 30,
          massYield: 8,
          energyYield: 3,
          gravityMass: 0,
          color:
            asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
          chewClicks: 8,
        }),
      },
      {
        weight: 2,
        minTier: 2,
        factory: () => ({
          size: 20 + Math.random() * 10,
          health: 60,
          massYield: 15,
          energyYield: 5,
          gravityMass: 0,
          color: 0x6699cc,
          chewClicks: 12,
        }),
      },
    ],
  },
  {
    name: "Asteroid Belt",
    minDistance: 2500,
    maxDistance: 3500,
    maxObjects: 30,
    spawnTable: [
      {
        weight: 8,
        minTier: 2,
        factory: () => ({
          size: 8 + Math.random() * 15,
          health: 20 + Math.random() * 30,
          massYield: 5 + Math.random() * 10,
          energyYield: 2 + Math.random() * 3,
          gravityMass: 0,
          color:
            asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
          chewClicks: 5 + Math.floor(Math.random() * 5),
        }),
      },
    ],
  },
  {
    name: "Outer Solar System",
    minDistance: 3500,
    maxDistance: 5500,
    maxObjects: 15,
    spawnTable: [
      {
        weight: 3,
        minTier: 3,
        factory: () => ({
          size: 15 + Math.random() * 20,
          health: 80,
          massYield: 30,
          energyYield: 10,
          gravityMass: 0,
          color: 0x99aacc,
          chewClicks: 15,
        }),
      },
    ],
  },
  {
    name: "Kuiper Belt",
    minDistance: 5500,
    maxDistance: 7000,
    maxObjects: 10,
    spawnTable: [
      {
        weight: 5,
        minTier: 4,
        factory: () => ({
          size: 10 + Math.random() * 12,
          health: 50,
          massYield: 20,
          energyYield: 8,
          gravityMass: 0,
          color: 0xccddff,
          chewClicks: 10,
        }),
      },
      {
        weight: 1,
        minTier: 4,
        factory: () => ({
          size: 25,
          health: 150,
          massYield: 80,
          energyYield: 20,
          gravityMass: 50,
          color: 0xddccaa,
          name: "Pluto",
          chewClicks: 20,
        }),
      },
    ],
  },
  {
    name: "Solar Core",
    minDistance: 7000,
    maxDistance: 8000,
    maxObjects: 1,
    spawnTable: [
      {
        weight: 1,
        minTier: 5,
        factory: () => ({
          size: 200,
          health: 10000,
          massYield: 50000,
          energyYield: 10000,
          gravityMass: 50000,
          color: 0xffdd44,
          name: "The Sun",
          chewClicks: 999,
        }),
      },
    ],
  },
];
