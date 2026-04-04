import { UPGRADE_COST_SCALING } from "@/constants";

export type UpgradeCategory =
  | "weapon"
  | "automation"
  | "energyGen"
  | "energyStorage"
  | "station";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  baseCost: number;
  maxLevel: number;
  minTier: number;
  stackable: boolean; // if true, buying adds another instance instead of leveling up
  energyDrain?: number; // energy/sec per level (for automation)
}

export const UPGRADES: Record<string, UpgradeDefinition> = {
  // Tier 1 — Clamp & Survival
  clampRange: {
    id: "clampRange",
    name: "Clamp Range",
    description: "Grab targets from further away",
    category: "weapon",
    baseCost: 5,
    maxLevel: 5,
    minTier: 1,
    stackable: false,
  },
  chewSpeed: {
    id: "chewSpeed",
    name: "Chew Speed",
    description: "Fewer clicks to consume a target",
    category: "weapon",
    baseCost: 8,
    maxLevel: 5,
    minTier: 1,
    stackable: false,
  },
  jawStrength: {
    id: "jawStrength",
    name: "Jaw Strength",
    description: "More mass extracted per chew click",
    category: "weapon",
    baseCost: 8,
    maxLevel: 5,
    minTier: 1,
    stackable: false,
  },
  thrusters: {
    id: "thrusters",
    name: "Thrusters",
    description: "Move faster, resist gravity better",
    category: "station",
    baseCost: 10,
    maxLevel: 10,
    minTier: 1,
    stackable: false,
  },
  manualGenerator: {
    id: "manualGenerator",
    name: "Manual Generator",
    description: "More energy per click",
    category: "energyGen",
    baseCost: 5,
    maxLevel: 10,
    minTier: 1,
    stackable: false,
  },
  basicBattery: {
    id: "basicBattery",
    name: "Basic Battery",
    description: "Increase energy storage capacity",
    category: "energyStorage",
    baseCost: 8,
    maxLevel: 5,
    minTier: 1,
    stackable: false,
  },
  solarPanels: {
    id: "solarPanels",
    name: "Solar Panels",
    description: "Passive energy generation",
    category: "energyGen",
    baseCost: 15,
    maxLevel: 5,
    minTier: 1,
    stackable: true,
  },

  // Tier 2 — Beam & First Automation
  beamPower: {
    id: "beamPower",
    name: "Beam Power",
    description: "More damage per zap",
    category: "weapon",
    baseCost: 15,
    maxLevel: 10,
    minTier: 2,
    stackable: false,
  },
  fireRate: {
    id: "fireRate",
    name: "Fire Rate",
    description: "Faster manual shooting",
    category: "weapon",
    baseCost: 15,
    maxLevel: 10,
    minTier: 2,
    stackable: false,
  },
  multiBeam: {
    id: "multiBeam",
    name: "Multi-beam",
    description: "Hit multiple targets per shot",
    category: "weapon",
    baseCost: 50,
    maxLevel: 5,
    minTier: 2,
    stackable: false,
  },
  autoTurret: {
    id: "autoTurret",
    name: "Auto-turret",
    description: "Fires at nearest small target",
    category: "automation",
    baseCost: 30,
    maxLevel: 5,
    minTier: 2,
    stackable: true,
    energyDrain: 2,
  },
  capacitorBanks: {
    id: "capacitorBanks",
    name: "Capacitor Banks",
    description: "Bigger energy storage",
    category: "energyStorage",
    baseCost: 20,
    maxLevel: 5,
    minTier: 2,
    stackable: true,
  },
  energyAmplifier: {
    id: "energyAmplifier",
    name: "Energy Amplifier",
    description: "More energy from destroyed objects",
    category: "energyGen",
    baseCost: 25,
    maxLevel: 5,
    minTier: 2,
    stackable: false,
  },
  shieldGenerator: {
    id: "shieldGenerator",
    name: "Shield Generator",
    description: "Absorb collision damage",
    category: "station",
    baseCost: 40,
    maxLevel: 3,
    minTier: 2,
    stackable: false,
  },
  efficiencyUpgrades: {
    id: "efficiencyUpgrades",
    name: "Efficiency",
    description: "Reduce energy drain on all systems",
    category: "energyStorage",
    baseCost: 30,
    maxLevel: 5,
    minTier: 2,
    stackable: false,
  },

  // Tier 3 — Planet Destroyer
  tractorBeam: {
    id: "tractorBeam",
    name: "Tractor Beam",
    description: "Pulls in nearby debris automatically",
    category: "automation",
    baseCost: 80,
    maxLevel: 3,
    minTier: 3,
    stackable: false,
    energyDrain: 5,
  },
  droneSwarm: {
    id: "droneSwarm",
    name: "Drone Swarm",
    description: "AI drones hunt and destroy for you",
    category: "automation",
    baseCost: 100,
    maxLevel: 5,
    minTier: 3,
    stackable: true,
    energyDrain: 4,
  },
  fusionReactor: {
    id: "fusionReactor",
    name: "Fusion Reactor",
    description: "High passive energy — consumes mass",
    category: "energyGen",
    baseCost: 120,
    maxLevel: 3,
    minTier: 3,
    stackable: false,
  },
  powerCore: {
    id: "powerCore",
    name: "Power Core",
    description: "Massive energy storage buffer",
    category: "energyStorage",
    baseCost: 100,
    maxLevel: 3,
    minTier: 3,
    stackable: false,
  },

  // Tier 4 — Planet Eater
  gravityWell: {
    id: "gravityWell",
    name: "Gravity Well",
    description: "Everything nearby drifts toward you",
    category: "automation",
    baseCost: 300,
    maxLevel: 3,
    minTier: 4,
    stackable: false,
    energyDrain: 10,
  },
  stellarHarvester: {
    id: "stellarHarvester",
    name: "Stellar Harvester",
    description: "Siphon energy from nearby stars",
    category: "energyGen",
    baseCost: 400,
    maxLevel: 3,
    minTier: 4,
    stackable: false,
  },
  darkEnergyMatrix: {
    id: "darkEnergyMatrix",
    name: "Dark Energy Matrix",
    description: "Near-infinite energy storage",
    category: "energyStorage",
    baseCost: 500,
    maxLevel: 3,
    minTier: 4,
    stackable: false,
  },

  // Tier 5 — Star Killer
  superWeapon: {
    id: "superWeapon",
    name: "Super Weapon",
    description: "Charged planet-killer blast",
    category: "weapon",
    baseCost: 2000,
    maxLevel: 3,
    minTier: 5,
    stackable: false,
  },
};

export function getUpgradeCost(baseCost: number, currentLevel: number): number {
  return Math.floor(baseCost * UPGRADE_COST_SCALING ** currentLevel);
}
