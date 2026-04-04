export const PASSIVE_RECHARGE_RATE = 8; // energy/sec
export const BASE_KILL_RECHARGE = 5;
export const BURST_ENERGY_COST = 15;
export const BOOST_ENERGY_COST_PER_SEC = 8;

export class ResourceManager {
  mass: number = 0;
  totalMassEarned: number = 0;
  energy: number = 100;
  batteryCapacity: number = 100;

  // Upgradeable values (modified by card picks)
  passiveRechargeRate: number = PASSIVE_RECHARGE_RATE;
  killRechargeBonus: number = BASE_KILL_RECHARGE;
  burstCost: number = BURST_ENERGY_COST;
  boostCostPerSec: number = BOOST_ENERGY_COST_PER_SEC;
  massMultiplier: number = 1.0;

  addMass(amount: number): void {
    const gained = amount * this.massMultiplier;
    this.mass += gained;
    this.totalMassEarned += gained;
  }

  onKill(): void {
    this.energy = Math.min(this.batteryCapacity, this.energy + this.killRechargeBonus);
  }

  /** Returns true if there was enough energy. */
  spendBurst(): boolean {
    if (this.energy < this.burstCost) return false;
    this.energy -= this.burstCost;
    return true;
  }

  /** Drains boost energy for deltaMs milliseconds. Returns whether boost was active. */
  drainBoost(deltaMs: number): boolean {
    const cost = this.boostCostPerSec * (deltaMs / 1000);
    if (this.energy < cost) return false;
    this.energy -= cost;
    return true;
  }

  /** Call each frame — passive recharge. */
  update(deltaMs: number): void {
    const regen = this.passiveRechargeRate * (deltaMs / 1000);
    this.energy = Math.min(this.batteryCapacity, this.energy + regen);
  }

  get energyRatio(): number {
    return this.batteryCapacity > 0 ? this.energy / this.batteryCapacity : 0;
  }

  get canBurst(): boolean {
    return this.energy >= this.burstCost;
  }
}
