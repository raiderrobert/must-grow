import { ResourceManager } from "@/systems/ResourceManager";
import { UPGRADES, getUpgradeCost, type UpgradeDefinition } from "@/data/upgrades";

export class UpgradeManager {
  private levels: Map<string, number> = new Map();
  private resources: ResourceManager;

  constructor(resources: ResourceManager) {
    this.resources = resources;
    for (const id of Object.keys(UPGRADES)) {
      this.levels.set(id, 0);
    }
  }

  getLevel(upgradeId: string): number {
    return this.levels.get(upgradeId) ?? 0;
  }

  getDefinition(upgradeId: string): UpgradeDefinition {
    return UPGRADES[upgradeId];
  }

  getNextCost(upgradeId: string): number {
    const def = UPGRADES[upgradeId];
    const level = this.getLevel(upgradeId);
    return getUpgradeCost(def.baseCost, level);
  }

  canPurchase(upgradeId: string, currentTier: number): boolean {
    const def = UPGRADES[upgradeId];
    if (!def) return false;
    if (currentTier < def.minTier) return false;
    if (this.getLevel(upgradeId) >= def.maxLevel) return false;
    if (this.resources.mass < this.getNextCost(upgradeId)) return false;
    return true;
  }

  purchase(upgradeId: string, currentTier: number): boolean {
    if (!this.canPurchase(upgradeId, currentTier)) return false;
    const cost = this.getNextCost(upgradeId);
    this.resources.spendMass(cost);
    this.levels.set(upgradeId, this.getLevel(upgradeId) + 1);
    return true;
  }

  getAvailableUpgrades(currentTier: number): UpgradeDefinition[] {
    return Object.values(UPGRADES).filter(
      (def) =>
        def.minTier <= currentTier && this.getLevel(def.id) < def.maxLevel
    );
  }

  /** Recalculates all stats from current upgrade levels. Call after any purchase. */
  applyEffects(
    player: import("@/entities/PlayerStation").PlayerStation,
    combat: import("@/systems/CombatSystem").CombatSystem,
    resources: ResourceManager
  ): void {
    // Tier 1 weapons
    combat.clampRange = 80 + this.getLevel("clampRange") * 20;
    combat.jawStrengthMultiplier = 1 + this.getLevel("jawStrength") * 0.25;
    combat.chewSpeedMultiplier = 1 + this.getLevel("chewSpeed") * 0.2;
    combat.energyAmplifierMultiplier = 1 + this.getLevel("energyAmplifier") * 0.15;

    // Movement
    player.speed = 150 + this.getLevel("thrusters") * 30;
    player.thrustPower = 50 + this.getLevel("thrusters") * 15;

    // Energy generation
    resources.manualGenerateAmount =
      5 + this.getLevel("manualGenerator") * 3;

    // Battery capacity
    let capacity = 100;
    capacity += this.getLevel("basicBattery") * 30;
    capacity += this.getLevel("capacitorBanks") * 50;
    capacity += this.getLevel("powerCore") * 200;
    capacity += this.getLevel("darkEnergyMatrix") * 1000;
    resources.batteryCapacity = capacity;

    // Always-on generation (no mass cost)
    resources.generationRate =
      this.getLevel("solarPanels") * 1.5 +
      this.getLevel("stellarHarvester") * 25;

    // Reactor generation — gated on mass fuel
    resources.massFuelGenerationRate = this.getLevel("fusionReactor") * 8;
    resources.massDrainRate = this.getLevel("fusionReactor") * 0.5;

    // Drain from automation
    let drain = 0;
    drain += this.getLevel("autoTurret") * 2;
    drain += this.getLevel("tractorBeam") * 5;
    drain += this.getLevel("droneSwarm") * 4;
    drain += this.getLevel("gravityWell") * 10;
    drain += this.getLevel("shieldGenerator") * 2;
    const efficiencyReduction =
      1 - this.getLevel("efficiencyUpgrades") * 0.08;
    drain *= Math.max(efficiencyReduction, 0.4);
    resources.drainRate = drain;

    // Beam weapons (Tier 2+)
    combat.beamDamage = 10 + this.getLevel("beamPower") * 3;
    combat.beamCooldownMax = Math.max(
      500 - this.getLevel("fireRate") * 40,
      100
    );
    combat.beamRange = 200 + this.getLevel("beamPower") * 15;
  }
}
