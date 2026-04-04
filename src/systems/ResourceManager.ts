import {
  STARTING_MASS,
  STARTING_ENERGY,
  STARTING_BATTERY_CAPACITY,
  ENERGY_PER_MANUAL_CLICK,
} from "@/constants";

export class ResourceManager {
  mass: number = STARTING_MASS;
  totalMassEarned: number = 0;

  energy: number = STARTING_ENERGY;
  batteryCapacity: number = STARTING_BATTERY_CAPACITY;

  generationRate: number = 0; // energy per second from passive sources
  drainRate: number = 0; // energy per second consumed by active systems
  massDrainRate: number = 0; // mass consumed per second (fusion reactor)

  manualGenerateAmount: number = ENERGY_PER_MANUAL_CLICK;

  addMass(amount: number): void {
    this.mass += amount;
    this.totalMassEarned += amount;
  }

  spendMass(cost: number): boolean {
    if (this.mass < cost) return false;
    this.mass -= cost;
    return true;
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.energy + amount, this.batteryCapacity);
  }

  drainEnergy(amount: number): void {
    this.energy = Math.max(this.energy - amount, 0);
  }

  manualGenerate(): void {
    this.addEnergy(this.manualGenerateAmount);
  }

  /** Call each frame with delta in milliseconds. */
  updateEnergy(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    const net = this.netEnergyRate * deltaSec;
    if (net >= 0) {
      this.addEnergy(net);
    } else {
      this.drainEnergy(Math.abs(net));
    }
    if (this.massDrainRate > 0) {
      const massCost = this.massDrainRate * deltaSec;
      if (this.mass >= massCost) {
        this.mass -= massCost;
      }
      // If not enough mass, reactor just doesn't feed — no energy added from it
    }
  }

  get netEnergyRate(): number {
    return this.generationRate - this.drainRate;
  }

  get energyRatio(): number {
    return this.batteryCapacity > 0 ? this.energy / this.batteryCapacity : 0;
  }

  get isPowerDead(): boolean {
    return this.energy <= 0;
  }

  /** Systems ordered by shutdown priority (first to go offline). */
  static readonly SHUTDOWN_ORDER = [
    "drones",
    "tractorBeam",
    "autoTurrets",
    "shields",
    "engines",
  ] as const;

  /** Energy ratio thresholds where each system shuts down. */
  private static readonly SHUTDOWN_THRESHOLDS: Record<string, number> = {
    drones: 0.20,
    tractorBeam: 0.15,
    autoTurrets: 0.10,
    shields: 0.05,
    engines: 0.0,
  };

  isSystemOnline(system: string): boolean {
    const threshold = ResourceManager.SHUTDOWN_THRESHOLDS[system] ?? 0;
    return this.energyRatio > threshold;
  }

  get activeShutdowns(): readonly string[] {
    return ResourceManager.SHUTDOWN_ORDER.filter(
      (s) => !this.isSystemOnline(s)
    );
  }
}
