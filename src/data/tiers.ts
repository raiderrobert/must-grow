export interface TierDefinition {
  tier: number;
  name: string;
  massThreshold: number;
  unlocks: string[]; // upgrade IDs unlocked at this tier
}

export const TIERS: TierDefinition[] = [
  {
    tier: 1,
    name: "Satellite",
    massThreshold: 0,
    unlocks: [
      "clampRange",
      "chewSpeed",
      "jawStrength",
      "manualGenerator",
      "basicBattery",
      "thrusters",
      "solarPanels",
    ],
  },
  {
    tier: 2,
    name: "Space Station",
    massThreshold: 100,
    unlocks: [
      "beamPower",
      "fireRate",
      "autoTurret",
      "capacitorBanks",
      "multiBeam",
      "energyAmplifier",
      "shieldGenerator",
      "efficiencyUpgrades",
    ],
  },
  {
    tier: 3,
    name: "Mega Station",
    massThreshold: 500,
    unlocks: ["tractorBeam", "droneSwarm", "fusionReactor", "powerCore"],
  },
  {
    tier: 4,
    name: "Planet Eater",
    massThreshold: 2000,
    unlocks: ["gravityWell", "stellarHarvester", "darkEnergyMatrix"],
  },
  {
    tier: 5,
    name: "Star Killer",
    massThreshold: 10000,
    unlocks: ["superWeapon"],
  },
];

export function getTierForMass(totalMassEarned: number): number {
  let tier = 1;
  for (const t of TIERS) {
    if (totalMassEarned >= t.massThreshold) {
      tier = t.tier;
    }
  }
  return tier;
}

export function getTierName(tier: number): string {
  return TIERS[tier - 1]?.name ?? "Unknown";
}
