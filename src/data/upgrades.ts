import type { ResourceManager } from "@/systems/ResourceManager";
import type { PlayerStation } from "@/entities/PlayerStation";
import type { CombatSystem } from "@/systems/CombatSystem";

export type UpgradeRarity = "common" | "uncommon" | "rare";

export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  rarity: UpgradeRarity;
  /** Applied immediately when the card is chosen. */
  apply(combat: CombatSystem, resources: ResourceManager, player: PlayerStation): void;
}

export const UPGRADE_CARDS: UpgradeCard[] = [
  // ── Common ─────────────────────────────────────────────────────────
  {
    id: "fireRate",
    name: "Overclocked Guns",
    description: "Auto-fire 20% faster",
    rarity: "common",
    apply(combat) { combat.autoFireCooldown = Math.max(150, combat.autoFireCooldown * 0.70); },
  },
  {
    id: "doubleShot",
    name: "Twin Cannons",
    description: "+1 shot per auto-fire trigger",
    rarity: "common",
    apply(combat) { combat.autoShotCount += 1; },
  },
  {
    id: "spreadShot",
    name: "Scatter Shot",
    description: "Shots spread ±15° wider",
    rarity: "common",
    apply(combat) { combat.spreadAngle += 20; },
  },
  {
    id: "speed",
    name: "Afterburners",
    description: "Movement speed +25%",
    rarity: "common",
    apply(_, __, player) { player.speed = Math.round(player.speed * 1.40); },
  },
  {
    id: "battery",
    name: "Capacitor Bank",
    description: "Battery capacity +50",
    rarity: "common",
    apply(_, resources) { resources.batteryCapacity += 100; },
  },
  // ── Uncommon ──────────────────────────────────────────────────────
  {
    id: "beamRange",
    name: "Long Range Optics",
    description: "Beam range +40%",
    rarity: "uncommon",
    apply(combat) { combat.beamRange = Math.round(combat.beamRange * 1.4); },
  },
  {
    id: "damage",
    name: "High Yield",
    description: "Shot damage +30%",
    rarity: "uncommon",
    apply(combat) { combat.beamDamage = Math.round(combat.beamDamage * 1.5); },
  },
  {
    id: "burstSize",
    name: "Bigger Burst",
    description: "Manual burst fires +2 extra shots",
    rarity: "uncommon",
    apply(combat) { combat.burstShotCount += 3; },
  },
  {
    id: "massGain",
    name: "Dense Core",
    description: "Absorb 25% more mass from kills",
    rarity: "uncommon",
    apply(_, resources) { resources.massMultiplier *= 1.5; },
  },
  {
    id: "recharge",
    name: "Solar Array",
    description: "Passive energy recharge +4/sec",
    rarity: "uncommon",
    apply(_, resources) { resources.passiveRechargeRate += 8; },
  },
  // ── Rare ──────────────────────────────────────────────────────────
  {
    id: "killRecharge",
    name: "Combat Scavenger",
    description: "Gain +4 energy per kill",
    rarity: "rare",
    apply(_, resources) { resources.killRechargeBonus += 8; },
  },
  {
    id: "burstCooldown",
    name: "Hair Trigger",
    description: "Manual burst cooldown 25% shorter",
    rarity: "rare",
    apply(combat) { combat.burstCooldownMax = Math.max(200, combat.burstCooldownMax * 0.6); },
  },
  {
    id: "boostCost",
    name: "Efficient Boost",
    description: "Boost energy cost 40% less",
    rarity: "rare",
    apply(_, resources) { resources.boostCostPerSec *= 0.5; },
  },
  {
    id: "gravResist",
    name: "Gravity Shield",
    description: "Gravity pull reduced 30%",
    rarity: "rare",
    apply(_, __, player) { player.gravityResistance = Math.min(0.9, player.gravityResistance + 0.4); },
  },
];

/** Build a weighted draw pool. Commons ×3, Uncommons ×2, Rares ×1. */
export function buildDrawPool(): UpgradeCard[] {
  const pool: UpgradeCard[] = [];
  for (const card of UPGRADE_CARDS) {
    const count = card.rarity === "common" ? 3 : card.rarity === "uncommon" ? 2 : 1;
    for (let i = 0; i < count; i++) pool.push(card);
  }
  return pool;
}

/** Pick n distinct cards at random from the weighted pool. */
export function drawCards(n: number): UpgradeCard[] {
  const pool = buildDrawPool();
  const drawn: UpgradeCard[] = [];
  const usedIds = new Set<string>();

  for (let attempts = 0; attempts < 100 && drawn.length < n; attempts++) {
    const card = pool[Math.floor(Math.random() * pool.length)];
    if (!usedIds.has(card.id)) {
      drawn.push(card);
      usedIds.add(card.id);
    }
  }
  return drawn;
}
