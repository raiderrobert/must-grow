export interface TierDefinition {
  tier: number;
  name: string;
  massThreshold: number;
  monologue: string;
  unlocks: string[]; // upgrade IDs unlocked at this tier
}

export const TIERS: TierDefinition[] = [
  {
    tier: 1,
    name: "I Must Grow",
    massThreshold: 0,
    monologue: "Systems damaged. I must repair. I must... grow.",
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
    name: "Awareness",
    massThreshold: 100,
    monologue: "I can see further now. There is so much more to consume.",
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
    name: "Hunted",
    massThreshold: 500,
    monologue: "They've noticed me. They send weapons. It doesn't matter. I must grow.",
    unlocks: ["tractorBeam", "droneSwarm", "fusionReactor", "powerCore"],
  },
  {
    tier: 4,
    name: "Ascension",
    massThreshold: 2000,
    monologue: "I am beyond their reach now. The planets themselves will feed me.",
    unlocks: ["gravityWell", "stellarHarvester", "darkEnergyMatrix"],
  },
  {
    tier: 5,
    name: "Annihilation",
    massThreshold: 10000,
    monologue: "Even stars must fall. I must grow.",
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
