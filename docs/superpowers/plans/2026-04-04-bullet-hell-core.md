# Bullet Hell Core Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the game back to a fun bullet-hell core — lasers from the start, auto-fire always on, manual burst costs energy, roguelite pause-and-pick-3 upgrades at mass milestones, with density and firepower scaling toward chaos.

**Architecture:** Six focused changes: (1) simplify ResourceManager to a plain battery, (2) rework CombatSystem for always-on auto-fire + burst, (3) add Shift boost to PlayerStation, (4) replace the sidebar shop with a fullscreen roguelite UpgradeScreen, (5) replace upgrades data with bullet-hell card pool, (6) wire milestone triggers in GameScene. Everything not listed is left as-is.

**Tech Stack:** Phaser 3, TypeScript, Vite, pnpm, vitest

**Pre-commit validation:** Run before every commit:
```bash
pnpm exec tsc --noEmit && pnpm test
```

---

## What Changes

| File | Action |
|------|--------|
| `src/systems/ResourceManager.ts` | Simplify — remove generationRate/drainRate/massDrainRate, add passive trickle + kill bonus |
| `src/systems/CombatSystem.ts` | Rewrite — remove clamp/chew, auto-fire always on from frame 1, add manual burst |
| `src/entities/PlayerStation.ts` | Remove K/clamp keys, add Shift boost key |
| `src/data/upgrades.ts` | Replace with bullet-hell card pool |
| `src/ui/UpgradeScreen.ts` | **Create** — fullscreen pause overlay, 3 cards, pick one |
| `src/ui/UpgradeShop.ts` | Delete — replaced by UpgradeScreen |
| `src/ui/GeneratorButton.ts` | Delete — no more manual power button |
| `src/ui/HUD.ts` | Remove generator button, add boost indicator |
| `src/scenes/GameScene.ts` | Wire milestone check, pause/resume, remove old shop/generator refs |
| `tests/systems/ResourceManager.test.ts` | Update for new simplified energy model |

---

## Design Reference

### Energy Model (simplified)

```
Battery capacity:    100 (upgradeable)
Passive recharge:    +8/sec (always)
Kill recharge:       +5 per kill (upgradeable)
Manual burst cost:   15 energy per activation
Boost cost:          8 energy/sec while Shift held
Auto-fire cost:      FREE — always fires regardless of energy
If battery empty:    auto-fire continues, burst and boost disabled
```

### Auto-Fire Behavior

One gun fires at nearest target. Starts slow (one shot per 900ms). Upgrades accelerate this. Multi-shot/spread upgrades add more beams per trigger. As upgrades stack, the player creates dense patterns — this is the bullet hell.

### Manual Burst

Space or J: fires a tight cluster of shots (default 3) in rapid succession. Satisfying button mash. Costs energy. Cooldown 800ms. Upgradeable count and cooldown.

### Roguelite Upgrades

Every 30 total mass earned → game pauses → 3 random cards appear → pick one → resume. Cards draw from a weighted pool. Same card can appear again (effects stack). No mass cost — the choice IS the cost (opportunity cost of the other 2).

### Upgrade Card Pool

| ID | Name | Effect |
|----|------|--------|
| `fireRate` | Overclocked Guns | Auto cooldown ×0.80 |
| `doubleShot` | Twin Cannons | +1 auto shot per trigger |
| `spreadShot` | Scatter Shot | Shots spread ±15° (stacks) |
| `damage` | High Yield | Shot damage +30% |
| `burstSize` | Bigger Burst | Manual burst +2 shots |
| `burstCooldown` | Hair Trigger | Burst cooldown ×0.75 |
| `speed` | Afterburners | Move speed +25% |
| `boostCost` | Efficient Boost | Boost energy cost ×0.6 |
| `battery` | Capacitor Bank | Battery +50 capacity |
| `recharge` | Solar Array | Passive recharge +4/sec |
| `killRecharge` | Combat Scavenger | Kill recharge +4 energy |
| `massGain` | Dense Core | Mass from kills ×1.25 |
| `gravResist` | Gravity Shield | Gravity pull on player ×0.7 |

Rarity: `fireRate`, `doubleShot`, `spreadShot`, `speed`, `battery` are Common. `damage`, `burstSize`, `massGain`, `recharge` are Uncommon. `gravResist`, `killRecharge`, `boostCost`, `burstCooldown` are Rare. Commons appear 3×, Uncommons 2×, Rares 1× in the draw pool.

### Milestone Trigger

```
UPGRADE_MILESTONE = 30  // every 30 total mass earned
```

At 30, 60, 90, 120... mass → trigger upgrade screen.

---

## Task 1: Simplify ResourceManager

**Files:**
- Modify: `src/systems/ResourceManager.ts`
- Modify: `tests/systems/ResourceManager.test.ts`

- [ ] **Step 1: Replace ResourceManager.ts entirely**

```typescript
// src/systems/ResourceManager.ts

const STARTING_ENERGY = 100;
const STARTING_BATTERY = 100;
const PASSIVE_RECHARGE_RATE = 8; // energy/sec
const BASE_KILL_RECHARGE = 5;
const BURST_ENERGY_COST = 15;
const BOOST_ENERGY_COST_PER_SEC = 8;

export class ResourceManager {
  mass: number = 0;
  totalMassEarned: number = 0;
  energy: number = STARTING_ENERGY;
  batteryCapacity: number = STARTING_BATTERY;

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

  /** Drains boost energy for deltaMs milliseconds. Returns whether boost is active. */
  drainBoost(deltaMs: number): boolean {
    const cost = this.boostCostPerSec * (deltaMs / 1000);
    if (this.energy < cost) return false;
    this.energy -= cost;
    return true;
  }

  /** Call each frame. Passive recharge. */
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

export { BURST_ENERGY_COST, BOOST_ENERGY_COST_PER_SEC, PASSIVE_RECHARGE_RATE, BASE_KILL_RECHARGE };
```

- [ ] **Step 2: Replace ResourceManager tests**

Replace `tests/systems/ResourceManager.test.ts` entirely:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ResourceManager } from "@/systems/ResourceManager";

describe("ResourceManager", () => {
  let rm: ResourceManager;
  beforeEach(() => { rm = new ResourceManager(); });

  describe("mass", () => {
    it("starts at 0", () => { expect(rm.mass).toBe(0); });

    it("addMass increases totalMassEarned", () => {
      rm.addMass(10);
      expect(rm.totalMassEarned).toBe(10);
      expect(rm.mass).toBe(10);
    });

    it("addMass applies massMultiplier", () => {
      rm.massMultiplier = 1.5;
      rm.addMass(10);
      expect(rm.mass).toBeCloseTo(15);
    });
  });

  describe("energy", () => {
    it("starts at 100", () => { expect(rm.energy).toBe(100); });

    it("onKill recharges energy", () => {
      rm.energy = 50;
      rm.onKill();
      expect(rm.energy).toBe(55);
    });

    it("onKill caps at batteryCapacity", () => {
      rm.energy = 98;
      rm.onKill();
      expect(rm.energy).toBe(100);
    });

    it("spendBurst deducts burstCost and returns true", () => {
      const spent = rm.spendBurst();
      expect(spent).toBe(true);
      expect(rm.energy).toBe(85);
    });

    it("spendBurst returns false if insufficient energy", () => {
      rm.energy = 5;
      expect(rm.spendBurst()).toBe(false);
      expect(rm.energy).toBe(5);
    });

    it("drainBoost returns false and does not drain if insufficient energy", () => {
      rm.energy = 0;
      expect(rm.drainBoost(1000)).toBe(false);
      expect(rm.energy).toBe(0);
    });

    it("drainBoost drains proportionally to delta", () => {
      rm.drainBoost(1000); // 1 second
      expect(rm.energy).toBeCloseTo(100 - 8);
    });

    it("update recharges passively", () => {
      rm.energy = 0;
      rm.update(1000); // 1 second
      expect(rm.energy).toBeCloseTo(8);
    });

    it("update caps at batteryCapacity", () => {
      rm.energy = 99;
      rm.update(1000);
      expect(rm.energy).toBe(100);
    });

    it("canBurst is false when energy below burstCost", () => {
      rm.energy = 10;
      expect(rm.canBurst).toBe(false);
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test -- tests/systems/ResourceManager.test.ts
```

Expected: all ResourceManager tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/systems/ResourceManager.ts tests/systems/ResourceManager.test.ts
git commit -m "refactor: simplify ResourceManager to plain battery with passive regen"
```

---

## Task 2: Rewrite Upgrade Card Data

**Files:**
- Modify: `src/data/upgrades.ts`
- Modify: `tests/data/upgrades.test.ts`

- [ ] **Step 1: Replace upgrades.ts**

```typescript
// src/data/upgrades.ts
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
    apply(combat) { combat.autoFireCooldown = Math.max(200, combat.autoFireCooldown * 0.8); },
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
    apply(combat) { combat.spreadAngle += 15; },
  },
  {
    id: "speed",
    name: "Afterburners",
    description: "Movement speed +25%",
    rarity: "common",
    apply(_, __, player) { player.speed = Math.round(player.speed * 1.25); },
  },
  {
    id: "battery",
    name: "Capacitor Bank",
    description: "Battery capacity +50",
    rarity: "common",
    apply(_, resources) { resources.batteryCapacity += 50; },
  },
  // ── Uncommon ──────────────────────────────────────────────────────
  {
    id: "damage",
    name: "High Yield",
    description: "Shot damage +30%",
    rarity: "uncommon",
    apply(combat) { combat.beamDamage = Math.round(combat.beamDamage * 1.3); },
  },
  {
    id: "burstSize",
    name: "Bigger Burst",
    description: "Manual burst fires +2 extra shots",
    rarity: "uncommon",
    apply(combat) { combat.burstShotCount += 2; },
  },
  {
    id: "massGain",
    name: "Dense Core",
    description: "Absorb 25% more mass from kills",
    rarity: "uncommon",
    apply(_, resources) { resources.massMultiplier *= 1.25; },
  },
  {
    id: "recharge",
    name: "Solar Array",
    description: "Passive energy recharge +4/sec",
    rarity: "uncommon",
    apply(_, resources) { resources.passiveRechargeRate += 4; },
  },
  // ── Rare ──────────────────────────────────────────────────────────
  {
    id: "killRecharge",
    name: "Combat Scavenger",
    description: "Gain +4 energy per kill",
    rarity: "rare",
    apply(_, resources) { resources.killRechargeBonus += 4; },
  },
  {
    id: "burstCooldown",
    name: "Hair Trigger",
    description: "Manual burst cooldown 25% shorter",
    rarity: "rare",
    apply(combat) { combat.burstCooldownMax = Math.max(300, combat.burstCooldownMax * 0.75); },
  },
  {
    id: "boostCost",
    name: "Efficient Boost",
    description: "Boost energy cost 40% less",
    rarity: "rare",
    apply(_, resources) { resources.boostCostPerSec *= 0.6; },
  },
  {
    id: "gravResist",
    name: "Gravity Shield",
    description: "Gravity pull reduced 30%",
    rarity: "rare",
    apply(_, __, player) { player.gravityResistance = Math.min(0.9, player.gravityResistance + 0.3); },
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
```

- [ ] **Step 2: Update upgrade tests**

Replace `tests/data/upgrades.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { UPGRADE_CARDS, buildDrawPool, drawCards } from "@/data/upgrades";

describe("upgrade cards", () => {
  it("every card has id, name, description, rarity, and apply", () => {
    for (const card of UPGRADE_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(["common", "uncommon", "rare"]).toContain(card.rarity);
      expect(typeof card.apply).toBe("function");
    }
  });

  it("all card ids are unique", () => {
    const ids = UPGRADE_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("buildDrawPool weights commons more than rares", () => {
    const pool = buildDrawPool();
    const fireRateCount = pool.filter(c => c.id === "fireRate").length;
    const gravResistCount = pool.filter(c => c.id === "gravResist").length;
    expect(fireRateCount).toBe(3);
    expect(gravResistCount).toBe(1);
  });

  it("drawCards returns n distinct cards", () => {
    const cards = drawCards(3);
    expect(cards).toHaveLength(3);
    const ids = cards.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("drawCards never returns more cards than exist", () => {
    const cards = drawCards(999);
    expect(cards.length).toBeLessThanOrEqual(UPGRADE_CARDS.length);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test -- tests/data/upgrades.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/upgrades.ts tests/data/upgrades.test.ts
git commit -m "refactor: replace upgrade shop data with roguelite card pool"
```

---

## Task 3: Rewrite CombatSystem — Auto-Fire Always On, Manual Burst, No Clamp

**Files:**
- Modify: `src/systems/CombatSystem.ts`

Replace the entire file:

- [ ] **Step 1: Replace CombatSystem.ts**

```typescript
// src/systems/CombatSystem.ts
import Phaser from "phaser";
import { PlayerStation } from "@/entities/PlayerStation";
import { SpaceObject } from "@/entities/SpaceObject";
import { Debris } from "@/entities/Debris";
import { ResourceManager } from "@/systems/ResourceManager";
import { ZoneManager } from "@/systems/ZoneManager";
import { COLORS, ENERGY_FROM_DESTROY_BASE } from "@/constants";
import type { AudioManager } from "@/systems/AudioManager";

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: PlayerStation;
  private resources: ResourceManager;
  private zones: ZoneManager;
  private audio: AudioManager | null = null;
  private debrisList: Debris[] = [];
  private beamGraphics: Phaser.GameObjects.Graphics;
  private droneGraphics: Phaser.GameObjects.Graphics;
  private droneBeamGraphics: Phaser.GameObjects.Graphics;

  // Auto-fire state
  private autoFireTimer: number = 0;

  // Burst fire state
  private burstCooldown: number = 0;
  private burstQueue: number = 0; // shots remaining in current burst
  private burstFireTimer: number = 0;
  private readonly BURST_FIRE_INTERVAL = 80; // ms between shots in a burst

  // Drone state (visual orbit — no AI yet, placeholder for later)
  private droneAngles: number[] = [];
  private droneCooldowns: number[] = [];
  private readonly DRONE_ORBIT_RADIUS = 60;
  private readonly DRONE_FIRE_INTERVAL = 2500;
  private readonly DRONE_DAMAGE = 5;

  // ── Stats (modified by upgrade cards) ────────────────────────────
  autoFireCooldown: number = 900;   // ms between auto shots
  autoShotCount: number = 1;         // shots per auto trigger
  spreadAngle: number = 0;           // total spread in degrees (splits evenly across shots)
  beamDamage: number = 10;
  beamRange: number = 300;
  burstShotCount: number = 3;        // shots per manual burst activation
  burstCooldownMax: number = 800;    // ms before another burst allowed

  debrisGroup!: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: PlayerStation,
    resources: ResourceManager,
    zones: ZoneManager
  ) {
    this.scene = scene;
    this.player = player;
    this.resources = resources;
    this.zones = zones;
    this.beamGraphics = scene.add.graphics();
    this.droneGraphics = scene.add.graphics().setDepth(5);
    this.droneBeamGraphics = scene.add.graphics().setDepth(5);
    this.debrisGroup = scene.physics.add.group();

    if (!scene.textures.exists("particle")) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("particle", 4, 4);
      g.destroy();
    }
  }

  setAudio(audio: AudioManager): void {
    this.audio = audio;
  }

  /** Called by GameScene when the player presses the burst key. */
  triggerBurst(): void {
    if (this.burstCooldown > 0) return;
    if (!this.resources.spendBurst()) return;

    this.burstQueue = this.burstShotCount;
    this.burstFireTimer = 0;
    this.burstCooldown = this.burstCooldownMax;
  }

  private findNearest(fromX: number, fromY: number, range: number): SpaceObject | null {
    let nearest: SpaceObject | null = null;
    let nearestDist = range;
    for (const obj of this.zones.getObjects()) {
      const dist = Phaser.Math.Distance.Between(fromX, fromY, obj.sprite.x, obj.sprite.y);
      if (dist < nearestDist) { nearest = obj; nearestDist = dist; }
    }
    return nearest;
  }

  private fireBeamsAt(
    fromX: number,
    fromY: number,
    target: SpaceObject,
    shotCount: number,
    spread: number,
    damage: number,
    color: number = COLORS.beam,
    volumeScale: number = 1
  ): void {
    const baseAngle = Phaser.Math.Angle.Between(fromX, fromY, target.sprite.x, target.sprite.y);
    const spreadRad = Phaser.Math.DegToRad(spread);
    const step = shotCount > 1 ? spreadRad / (shotCount - 1) : 0;
    const startAngle = baseAngle - spreadRad / 2;

    for (let i = 0; i < shotCount; i++) {
      const angle = shotCount === 1 ? baseAngle : startAngle + step * i;
      const range = this.beamRange * 1.2;
      const ex = fromX + Math.cos(angle) * range;
      const ey = fromY + Math.sin(angle) * range;

      this.beamGraphics.lineStyle(2, color, 0.85);
      this.beamGraphics.lineBetween(fromX, fromY, ex, ey);
    }

    this.scene.time.delayedCall(90, () => this.beamGraphics.clear());
    this.audio?.play("sfx_zap", volumeScale * 0.7);

    // Only the primary shot (aimed at target) deals damage
    const destroyed = target.takeDamage(damage);
    if (destroyed) {
      this.audio?.play("sfx_explosion", 0.8);
      this.createExplosion(target.sprite.x, target.sprite.y, target.config.color);
      this.spawnDebris(target);
      this.resources.addMass(target.config.massYield);
      this.resources.onKill();
      this.zones.removeObject(target);
    }
  }

  private updateAutoFire(delta: number): void {
    this.autoFireTimer += delta;
    if (this.autoFireTimer < this.autoFireCooldown) return;
    this.autoFireTimer = 0;

    const nearest = this.findNearest(this.player.x, this.player.y, this.beamRange);
    if (!nearest) return;

    this.fireBeamsAt(
      this.player.x, this.player.y,
      nearest,
      this.autoShotCount,
      this.spreadAngle,
      this.beamDamage,
      COLORS.beam,
      0.5
    );
  }

  private updateBurstQueue(delta: number): void {
    if (this.burstQueue <= 0) return;

    this.burstFireTimer += delta;
    if (this.burstFireTimer < this.BURST_FIRE_INTERVAL) return;
    this.burstFireTimer = 0;
    this.burstQueue--;

    const nearest = this.findNearest(this.player.x, this.player.y, this.beamRange * 1.3);
    if (!nearest) return;

    this.fireBeamsAt(
      this.player.x, this.player.y,
      nearest,
      Math.max(1, Math.ceil(this.autoShotCount * 1.5)),
      this.spreadAngle + 10,
      Math.round(this.beamDamage * 1.5),
      0xffd93d, // gold burst color
      1.0
    );
  }

  private createExplosion(x: number, y: number, color: number): void {
    const particles = this.scene.add.particles(x, y, "particle", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.6, end: 0 },
      tint: color,
      lifespan: 400,
      quantity: 12,
      emitting: false,
    });
    particles.explode(12);
    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  private spawnDebris(source: SpaceObject): void {
    const count = 2 + Math.floor(Math.random() * 3);
    const energyEach = source.config.energyYield / count;
    for (let i = 0; i < count; i++) {
      const d = new Debris(this.scene, {
        x: source.sprite.x, y: source.sprite.y,
        mass: 0, // mass awarded immediately on kill via resources.addMass
        energy: energyEach,
      });
      this.debrisList.push(d);
      this.debrisGroup.add(d.sprite);
    }
  }

  collectDebris(debris: Debris): void {
    this.resources.addEnergy = this.resources.addEnergy ?? (() => {});
    // Energy from debris
    this.resources.energy = Math.min(
      this.resources.batteryCapacity,
      this.resources.energy + debris.energy
    );
    this.audio?.playWithVariation("sfx_pickup");
    const idx = this.debrisList.indexOf(debris);
    if (idx !== -1) this.debrisList.splice(idx, 1);
    debris.destroy();
  }

  private updateDroneSwarm(delta: number, droneCount: number): void {
    this.droneGraphics.clear();
    if (droneCount === 0) {
      this.droneAngles = [];
      this.droneCooldowns = [];
      return;
    }

    while (this.droneAngles.length < droneCount) {
      this.droneAngles.push((this.droneAngles.length / droneCount) * Math.PI * 2);
      this.droneCooldowns.push(Math.random() * this.DRONE_FIRE_INTERVAL);
    }
    this.droneAngles.length = droneCount;
    this.droneCooldowns.length = droneCount;

    const orbitRadius = this.DRONE_ORBIT_RADIUS + this.player.size * 0.5;
    const rotateSpeed = 0.0015 * delta;

    for (let i = 0; i < droneCount; i++) {
      this.droneAngles[i] += rotateSpeed;
      const droneX = this.player.x + Math.cos(this.droneAngles[i]) * orbitRadius;
      const droneY = this.player.y + Math.sin(this.droneAngles[i]) * orbitRadius;

      const fwd = this.droneAngles[i] + Math.PI / 2;
      const sz = 5;
      this.droneGraphics.fillStyle(COLORS.mass, 0.9);
      this.droneGraphics.fillTriangle(
        droneX + Math.cos(fwd) * sz, droneY + Math.sin(fwd) * sz,
        droneX + Math.cos(fwd + 2.3) * sz, droneY + Math.sin(fwd + 2.3) * sz,
        droneX + Math.cos(fwd - 2.3) * sz, droneY + Math.sin(fwd - 2.3) * sz
      );

      this.droneCooldowns[i] -= delta;
      if (this.droneCooldowns[i] <= 0) {
        this.droneCooldowns[i] = this.DRONE_FIRE_INTERVAL;
        const nearest = this.findNearest(droneX, droneY, this.beamRange);
        if (nearest) {
          this.droneBeamGraphics.lineStyle(1, COLORS.mass, 0.7);
          this.droneBeamGraphics.lineBetween(droneX, droneY, nearest.sprite.x, nearest.sprite.y);
          this.scene.time.delayedCall(80, () => this.droneBeamGraphics.clear());
          const destroyed = nearest.takeDamage(this.DRONE_DAMAGE);
          if (destroyed) {
            this.createExplosion(nearest.sprite.x, nearest.sprite.y, nearest.config.color);
            this.spawnDebris(nearest);
            this.resources.addMass(nearest.config.massYield);
            this.resources.onKill();
            this.zones.removeObject(nearest);
          }
        }
      }
    }
  }

  update(delta: number, droneCount: number = 0): void {
    if (this.burstCooldown > 0) this.burstCooldown -= delta;

    this.updateAutoFire(delta);
    this.updateBurstQueue(delta);
    this.updateDroneSwarm(delta, droneCount);

    this.debrisList = this.debrisList.filter(d => d.sprite.active);
  }
}
```

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

Fix any errors — most will be GameScene calling removed methods (`setUpgrades`, `attackPressed`, `releaseClamp`, `clampedTarget`). Note what needs updating in GameScene for Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/systems/CombatSystem.ts
git commit -m "refactor: rewrite CombatSystem — always-on auto-fire, manual burst, no clamp"
```

---

## Task 4: Update PlayerStation — Remove Clamp Keys, Add Boost

**Files:**
- Modify: `src/entities/PlayerStation.ts`

- [ ] **Step 1: Remove clamp keys, add Shift boost and gravityResistance**

In `src/entities/PlayerStation.ts`:

**Replace** the `attackKeys`, `powerKey`, `upgradeKey` fields and their constructor registration with:

```typescript
private attackKeys: Phaser.Input.Keyboard.Key[];
private boostKey: Phaser.Input.Keyboard.Key;
private upgradeKey: Phaser.Input.Keyboard.Key;
private pad: Phaser.Input.Gamepad.Gamepad | null = null;
```

In constructor, replace registration to:

```typescript
    this.attackKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
    ];
    this.boostKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.upgradeKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    if (scene.input.gamepad) {
      scene.input.gamepad.once("connected", (pad: Phaser.Input.Gamepad.Gamepad) => {
        this.pad = pad;
      });
    }
```

**Add** `gravityResistance` to the stats fields:

```typescript
  gravityResistance: number = 0; // 0 = full gravity, 0.9 = 90% reduction
```

**Replace** `consumeAttack()` and `consumePower()` methods with:

```typescript
  consumeAttack(): boolean {
    const keyJustDown = this.attackKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
    const padJustDown = this.pad?.buttons[0]?.justDown === true;
    return keyJustDown || padJustDown;
  }

  isBoostHeld(): boolean {
    const keyHeld = this.boostKey.isDown;
    const padHeld = this.pad?.buttons[4]?.pressed === true; // LB
    return keyHeld || padHeld;
  }

  consumeUpgradeToggle(): boolean {
    const keyJustDown = Phaser.Input.Keyboard.JustDown(this.upgradeKey);
    const padJustDown = this.pad?.buttons[9]?.justDown === true;
    return keyJustDown || padJustDown;
  }
```

**Remove** the `consumePower()` method entirely.

- [ ] **Step 2: Apply gravity resistance in GameScene**

In `GameScene.update()`, change the gravity apply line from:

```typescript
this.player.applyGravity(pull.x * (delta / 1000), pull.y * (delta / 1000));
```

to:

```typescript
const resist = 1 - this.player.gravityResistance;
this.player.applyGravity(pull.x * (delta / 1000) * resist, pull.y * (delta / 1000) * resist);
```

- [ ] **Step 3: Handle boost in GameScene.update()**

Replace the `consumePower()` block in `GameScene.update()`:

```typescript
    // Boost — held Shift drains energy, increases speed temporarily
    if (this.player.isBoostHeld()) {
      const boosting = this.resources.drainBoost(delta);
      this.player.isBoosting = boosting;
    } else {
      this.player.isBoosting = false;
    }
```

**Add** `isBoosting` field to `PlayerStation` and use it in `update()` to apply a speed multiplier:

```typescript
  isBoosting: boolean = false;
```

In `PlayerStation.update()`, change the acceleration line to:

```typescript
    const accel = this.speed * 3 * (this.isBoosting ? 1.8 : 1.0);
```

- [ ] **Step 4: Update HUD controls hint**

In `src/ui/HUD.ts`, update the controls hint text:

```typescript
    scene.add.text(scene.scale.width / 2, scene.scale.height - 16,
      "WASD move  ·  SHIFT boost  ·  SPACE/J burst fire",
      { fontFamily: "monospace", fontSize: "11px", color: "#666", alpha: 0.7 }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
```

Also remove the `GeneratorButton` import and instantiation from `HUD.ts` — replace with just the static text hint. Remove `generatorButton` field.

- [ ] **Step 5: Delete GeneratorButton.ts**

```bash
rm src/ui/GeneratorButton.ts
```

- [ ] **Step 6: Type check**

```bash
pnpm exec tsc --noEmit
```

Fix any import errors from removed GeneratorButton.

- [ ] **Step 7: Commit**

```bash
git add src/entities/PlayerStation.ts src/ui/HUD.ts
git rm src/ui/GeneratorButton.ts
git commit -m "refactor: replace manual power with Shift boost, remove generator button"
```

---

## Task 5: Build Roguelite Upgrade Screen

**Files:**
- Create: `src/ui/UpgradeScreen.ts`
- Delete: `src/ui/UpgradeShop.ts`

- [ ] **Step 1: Create src/ui/UpgradeScreen.ts**

```typescript
// src/ui/UpgradeScreen.ts
import Phaser from "phaser";
import { drawCards, type UpgradeCard } from "@/data/upgrades";
import type { CombatSystem } from "@/systems/CombatSystem";
import type { ResourceManager } from "@/systems/ResourceManager";
import type { PlayerStation } from "@/entities/PlayerStation";
import type { AudioManager } from "@/systems/AudioManager";

const RARITY_COLORS: Record<string, string> = {
  common: "#4ecdc4",
  uncommon: "#6c63ff",
  rare: "#ffd93d",
};

export class UpgradeScreen {
  private scene: Phaser.Scene;
  private combat: CombatSystem;
  private resources: ResourceManager;
  private player: PlayerStation;
  private audio: AudioManager | null;
  private container!: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private onClose?: () => void;

  constructor(
    scene: Phaser.Scene,
    combat: CombatSystem,
    resources: ResourceManager,
    player: PlayerStation,
    audio: AudioManager | null = null
  ) {
    this.scene = scene;
    this.combat = combat;
    this.resources = resources;
    this.player = player;
    this.audio = audio;
  }

  /** Show the screen with 3 random cards. Calls onClose when a card is picked. */
  show(onClose: () => void): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.onClose = onClose;

    const cards = drawCards(3);
    this.build(cards);
  }

  private build(cards: UpgradeCard[]): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Dark overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(500);
    objects.push(overlay);

    // Title
    const title = this.scene.add.text(width / 2, height * 0.12, "CHOOSE AN UPGRADE", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);
    objects.push(title);

    // Subtitle
    const sub = this.scene.add.text(width / 2, height * 0.12 + 40, "Press 1 · 2 · 3  or  click a card", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#888",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);
    objects.push(sub);

    // Cards
    const cardW = Math.min(260, (width - 120) / 3);
    const cardH = 220;
    const spacing = cardW + 30;
    const startX = width / 2 - spacing;

    for (let i = 0; i < cards.length; i++) {
      const cx = startX + i * spacing;
      const cy = height * 0.5;
      const cardObjects = this.buildCard(cards[i], cx, cy, cardW, cardH, i + 1);
      objects.push(...cardObjects);
    }

    this.container = this.scene.add.container(0, 0, objects);
    this.container.setDepth(500);

    // Keyboard shortcuts 1/2/3
    const keys = [
      this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    for (let i = 0; i < keys.length; i++) {
      keys[i].once("down", () => {
        if (this.isVisible) this.pick(cards[i], keys);
      });
    }
  }

  private buildCard(
    card: UpgradeCard,
    cx: number,
    cy: number,
    w: number,
    h: number,
    keyNumber: number
  ): Phaser.GameObjects.GameObject[] {
    const color = RARITY_COLORS[card.rarity] ?? "#ccc";
    const colorHex = parseInt(color.replace("#", ""), 16);
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Card background
    const bg = this.scene.add.rectangle(cx, cy, w, h, 0x111133, 1)
      .setStrokeStyle(2, colorHex, 0.9)
      .setScrollFactor(0)
      .setDepth(501)
      .setInteractive({ useHandCursor: true });
    objects.push(bg);

    bg.on("pointerover", () => bg.setFillStyle(0x222255));
    bg.on("pointerout", () => bg.setFillStyle(0x111133));
    bg.on("pointerdown", () => this.pick(card, []));

    // Key hint
    objects.push(
      this.scene.add.text(cx, cy - h / 2 + 20, `[${keyNumber}]`, {
        fontFamily: "monospace", fontSize: "18px", color: "#fff", alpha: 0.5,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    // Rarity label
    objects.push(
      this.scene.add.text(cx, cy - h / 2 + 44, card.rarity.toUpperCase(), {
        fontFamily: "monospace", fontSize: "11px", color,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    // Card name
    objects.push(
      this.scene.add.text(cx, cy - 10, card.name, {
        fontFamily: "monospace", fontSize: "17px", color: "#fff",
        wordWrap: { width: w - 20 }, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    // Description
    objects.push(
      this.scene.add.text(cx, cy + 40, card.description, {
        fontFamily: "monospace", fontSize: "13px", color: "#bbb",
        wordWrap: { width: w - 24 }, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    return objects;
  }

  private pick(card: UpgradeCard, keys: Phaser.Input.Keyboard.Key[]): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    // Remove keyboard listeners
    for (const key of keys) key.removeAllListeners();

    // Apply the upgrade
    card.apply(this.combat, this.resources, this.player);
    this.audio?.play("sfx_upgrade");

    // Destroy overlay
    this.container?.destroy();

    this.onClose?.();
  }
}
```

- [ ] **Step 2: Delete UpgradeShop.ts**

```bash
rm src/ui/UpgradeShop.ts
```

- [ ] **Step 3: Type check**

```bash
pnpm exec tsc --noEmit
```

Expected: errors about `UpgradeShop` references in `GameScene.ts` — these get fixed in Task 6.

- [ ] **Step 4: Commit (with type errors still present — fixed next task)**

```bash
git add src/ui/UpgradeScreen.ts
git rm src/ui/UpgradeShop.ts
git commit -m "feat: add roguelite UpgradeScreen, remove sidebar UpgradeShop"
```

---

## Task 6: Rewrite GameScene — Wire New Systems

**Files:**
- Modify: `src/scenes/GameScene.ts`

Replace the entire file:

- [ ] **Step 1: Replace GameScene.ts**

```typescript
// src/scenes/GameScene.ts
import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS, GRAVITY_CONSTANT } from "@/constants";
import { createStarfield, updateStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";
import { ResourceManager } from "@/systems/ResourceManager";
import { GravitySystem } from "@/systems/GravitySystem";
import { ZoneManager } from "@/systems/ZoneManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import { CombatSystem } from "@/systems/CombatSystem";
import { HUD } from "@/ui/HUD";
import { UpgradeScreen } from "@/ui/UpgradeScreen";
import { AudioManager } from "@/systems/AudioManager";
import type { SpaceObject } from "@/entities/SpaceObject";

const UPGRADE_MILESTONE = 30; // trigger upgrade screen every 30 mass
const GRAVITY_SCALE = 0.15;   // tune down gravity — was too strong

export class GameScene extends Phaser.Scene {
  player!: PlayerStation;
  resources!: ResourceManager;
  gravity!: GravitySystem;
  zones!: ZoneManager;
  combat!: CombatSystem;
  hud!: HUD;
  upgradeScreen!: UpgradeScreen;
  audio!: AudioManager;

  currentTier: number = 1;
  private upgradeCount: number = 0; // how many upgrades taken so far
  private nextMilestone: number = UPGRADE_MILESTONE;
  private isPaused: boolean = false;

  private starfieldLayers!: Phaser.GameObjects.TileSprite[];
  private gravityIndicatorGraphics!: Phaser.GameObjects.Graphics;
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private collisionCooldowns: WeakSet<Phaser.Physics.Arcade.Sprite> = new WeakSet();

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.starfieldLayers = createStarfield(this);

    this.resources = new ResourceManager();
    this.gravity = new GravitySystem();
    this.zones = new ZoneManager(this);
    this.player = new PlayerStation(this);

    // Earth gravity body
    this.gravity.addBody({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 + 600, gravityMass: 500 });
    // Sun gravity body
    this.gravity.addBody({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 - 3500, gravityMass: 50000 });

    this.gravity.initGraphics(this);
    this.renderEarth();

    this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.audio = new AudioManager(this);
    this.combat.setAudio(this.audio);

    this.hud = new HUD(this, this.resources, this.audio);

    this.upgradeScreen = new UpgradeScreen(
      this, this.combat, this.resources, this.player, this.audio
    );

    this.input.once("pointerdown", () => this.audio.music.play("ambient"));

    // Pre-populate zone with objects at start
    this.zones.populate(this.player.x, this.player.y, 1);

    // Collisions
    this.physics.add.overlap(
      this.player.body,
      this.zones.objectGroup,
      (_p, objSprite) => {
        const obj = (objSprite as Phaser.Physics.Arcade.Sprite).getData("spaceObject") as SpaceObject;
        if (obj) this.onCollision(obj);
      }
    );
    this.physics.add.overlap(
      this.player.body,
      this.combat.debrisGroup,
      (_p, debrisSprite) => {
        const debris = (debrisSprite as Phaser.Physics.Arcade.Sprite).getData("debris") as import("@/entities/Debris").Debris;
        if (debris) this.combat.collectDebris(debris);
      }
    );

    // UI camera — fixed zoom so HUD never scales with main camera
    const uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCamera.setZoom(1);
    this.hud.ignoreWithCamera(this.cameras.main);
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // Gravity (scaled down + delta-based + gravity resistance)
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    const resist = 1 - this.player.gravityResistance;
    this.player.applyGravity(
      pull.x * (delta / 1000) * GRAVITY_SCALE * resist,
      pull.y * (delta / 1000) * GRAVITY_SCALE * resist
    );

    // Gravity death
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      this.handleDeath();
    }

    // Player movement
    this.player.isLocked = false;
    this.player.update(delta);

    // Boost
    if (this.player.isBoostHeld()) {
      this.player.isBoosting = this.resources.drainBoost(delta);
    } else {
      this.player.isBoosting = false;
    }

    // Burst fire
    if (this.player.consumeAttack()) {
      this.combat.triggerBurst();
    }

    // Combat
    const droneCount = 0; // drones re-enabled via upgrade card later
    this.combat.update(delta, droneCount);

    // Zone spawning
    const tier = getTierForMass(this.resources.totalMassEarned);
    this.zones.update(delta, this.player.x, this.player.y, tier, this.resources.totalMassEarned);

    // Energy passive regen
    this.resources.update(delta);

    // Tier evolution
    const newTier = getTierForMass(this.resources.totalMassEarned);
    if (newTier > this.currentTier) {
      this.triggerEvolution(newTier);
    }
    this.currentTier = newTier;
    this.player.tier = newTier;

    // Upgrade milestone check
    if (this.resources.totalMassEarned >= this.nextMilestone) {
      this.nextMilestone += UPGRADE_MILESTONE;
      this.triggerUpgrade();
      return; // skip rest of frame — game is now paused
    }

    // Station growth
    const baseSize = 16;
    const growthFactor = 1 + Math.log2(1 + this.resources.totalMassEarned) * 0.3;
    this.player.setSize(baseSize * growthFactor);

    // Camera zoom
    const targetZoom = Math.max(1 / growthFactor, 0.2);
    const currentZoom = this.cameras.main.zoom;
    const lerpFactor = 1 - Math.exp(-1.5 * (delta / 1000));
    this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * lerpFactor);

    // HUD + visuals
    this.hud.update();
    updateStarfield(this.starfieldLayers, this.cameras.main);
    this.gravity.renderDangerZones(this.player.x, this.player.y, this.player.thrustPower);
    this.updateGravityIndicator();
    this.updateDangerVignette();
  }

  private triggerUpgrade(): void {
    this.isPaused = true;
    this.physics.world.pause();
    this.upgradeCount++;

    this.upgradeScreen.show(() => {
      this.isPaused = false;
      this.physics.world.resume();
      this.audio.music.onTierChange(this.currentTier);
    });
  }

  private triggerEvolution(newTier: number): void {
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut");

    const text = this.add.text(
      this.scale.width / 2, this.scale.height / 2 - 50,
      `TIER ${newTier}: ${getTierName(newTier).toUpperCase()}`,
      { fontFamily: "monospace", fontSize: "32px", color: "#6c63ff", stroke: "#000", strokeThickness: 4 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    this.audio.play("sfx_tier_up");
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40, duration: 3000, ease: "Power2",
      onComplete: () => text.destroy(),
    });
    this.audio.music.onTierChange(newTier);
  }

  private handleDeath(): void {
    this.audio.play("sfx_game_over");
    this.cameras.main.flash(500, 255, 100, 100);
    this.resources.energy = this.resources.batteryCapacity;
    this.player.body.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.player.body.setVelocity(0, 0);
  }

  onCollision(obj: SpaceObject): void {
    if (this.collisionCooldowns.has(obj.sprite)) return;
    this.collisionCooldowns.add(obj.sprite);
    this.time.delayedCall(500, () => this.collisionCooldowns.delete(obj.sprite));

    const sizeRatio = obj.config.size / this.player.size;
    if (sizeRatio < 0.3) {
      this.resources.addMass(obj.config.massYield * 0.2);
      this.zones.removeObject(obj);
      return;
    }

    const damage = sizeRatio * 20;
    this.resources.energy = Math.max(0, this.resources.energy - damage);

    const dx = this.player.x - obj.sprite.x;
    const dy = this.player.y - obj.sprite.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    this.player.body.body!.velocity.x += (dx / dist) * 200;
    this.player.body.body!.velocity.y += (dy / dist) * 200;
  }

  private renderEarth(): void {
    const earthX = WORLD_WIDTH / 2;
    const earthY = WORLD_HEIGHT / 2 + 600;
    const radius = 180;
    const g = this.add.graphics().setDepth(-3);

    g.fillStyle(0x1a3a5c, 0.3);
    g.fillCircle(earthX, earthY, radius + 30);
    g.fillStyle(0x1a4a8a, 0.9);
    g.fillCircle(earthX, earthY, radius);
    g.fillStyle(0x2d6e2d, 0.85);
    g.fillEllipse(earthX - 40, earthY - 30, 90, 70);
    g.fillEllipse(earthX + 50, earthY + 20, 70, 80);
    g.fillEllipse(earthX - 20, earthY + 50, 60, 40);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(earthX, earthY, radius);
    g.lineStyle(2, 0x4488cc, 0.4);
    g.strokeCircle(earthX, earthY, radius);

    this.add.text(earthX, earthY + radius + 20, "Earth", {
      fontFamily: "monospace", fontSize: "14px", color: "#4488cc",
    }).setOrigin(0.5).setDepth(-3).setAlpha(0.6);
  }

  private updateGravityIndicator(): void {
    this.gravityIndicatorGraphics.clear();
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    if (pull.magnitude < 0.1) return;

    const nx = pull.x / pull.magnitude;
    const ny = pull.y / pull.magnitude;

    let color = 0x4488cc;
    let alpha = 0.6;
    let arrowLength = 20;

    for (const body of this.gravity.getBodies()) {
      const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { color = 0xff4444; alpha = 1.0; arrowLength = 28; break; }
      else if (level === "warning") { color = 0xffaa44; alpha = 0.85; arrowLength = 24; }
    }

    const startDist = this.player.size + 4;
    const sx = this.player.x + nx * startDist;
    const sy = this.player.y + ny * startDist;
    const ex = sx + nx * arrowLength;
    const ey = sy + ny * arrowLength;

    this.gravityIndicatorGraphics.lineStyle(2, color, alpha);
    this.gravityIndicatorGraphics.lineBetween(sx, sy, ex, ey);

    const headSize = 5;
    const angle = Math.atan2(ny, nx);
    const spread = Math.PI * 0.7;
    this.gravityIndicatorGraphics.fillStyle(color, alpha);
    this.gravityIndicatorGraphics.fillTriangle(
      ex, ey,
      ex - Math.cos(angle - spread) * headSize, ey - Math.sin(angle - spread) * headSize,
      ex - Math.cos(angle + spread) * headSize, ey - Math.sin(angle + spread) * headSize
    );
  }

  private updateDangerVignette(): void {
    this.dangerVignette.clear();

    let worstLevel: import("@/systems/GravitySystem").DangerLevel = "safe";
    for (const body of this.gravity.getBodies()) {
      const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { worstLevel = "deadly"; break; }
      if (level === "warning") worstLevel = "warning";
    }
    if (worstLevel === "safe") return;

    const w = this.scale.width;
    const h = this.scale.height;
    const pulse = (Math.sin(this.time.now / (worstLevel === "deadly" ? 150 : 400)) + 1) / 2;
    const baseAlpha = worstLevel === "deadly" ? 0.25 : 0.10;
    const alpha = baseAlpha + pulse * (worstLevel === "deadly" ? 0.15 : 0.06);
    const color = worstLevel === "deadly" ? 0xff2222 : 0xff8800;

    const edgeSize = Math.floor(Math.min(w, h) * 0.12);
    this.dangerVignette.fillStyle(color, alpha);
    this.dangerVignette.fillRect(0, 0, w, edgeSize);
    this.dangerVignette.fillRect(0, h - edgeSize, w, edgeSize);
    this.dangerVignette.fillRect(0, 0, edgeSize, h);
    this.dangerVignette.fillRect(w - edgeSize, 0, edgeSize, h);
  }
}
```

- [ ] **Step 2: Add ignoreWithCamera() to HUD**

In `src/ui/HUD.ts`, add a method that collects all HUD game objects and passes them to a camera's ignore list:

```typescript
  /** Returns all HUD GameObjects so the main camera can ignore them. */
  ignoreWithCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    const objs = [
      this.energyBarBg,
      this.energyBarFill,
      this.energyText,
      this.massText,
      this.tierText,
    ];
    camera.ignore(objs.filter(Boolean));
  }
```

Remove the `generatorButton` field and the `GeneratorButton` import from `HUD.ts` if not already done.

- [ ] **Step 3: Remove UpgradeManager imports everywhere**

`UpgradeManager` no longer exists as an import. Check and remove from:
- `src/scenes/GameScene.ts` — already done in the rewrite above
- Any lingering test files

Also delete `src/systems/UpgradeManager.ts` if it still exists — it's replaced by the card system:

```bash
rm -f src/systems/UpgradeManager.ts
```

- [ ] **Step 4: Type check**

```bash
pnpm exec tsc --noEmit
```

Fix any remaining errors.

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Tests that reference `UpgradeManager` will need to be deleted or updated — delete `tests/systems/UpgradeManager.test.ts` since the system no longer exists:

```bash
rm -f tests/systems/UpgradeManager.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts src/ui/HUD.ts src/ui/UpgradeScreen.ts
git rm -f src/systems/UpgradeManager.ts tests/systems/UpgradeManager.test.ts
git commit -m "feat: wire roguelite upgrade screen, bullet hell auto-fire, boost, milestone triggers"
```

---

## Task 7: Tune Spawn Density + Bullet Hell Scaling

**Files:**
- Modify: `src/data/zones.ts`
- Modify: `src/systems/ZoneManager.ts`

- [ ] **Step 1: Add populate() to ZoneManager**

In `src/systems/ZoneManager.ts`, add this method (used by GameScene to pre-fill on start):

```typescript
  /** Pre-populate all zones near the player at game start. */
  populate(playerX: number, playerY: number, playerTier: number): void {
    for (const zone of ZONES) {
      const target = Math.floor(zone.maxObjects * 0.7);
      for (let i = 0; i < target; i++) {
        this.spawnInZone(zone, playerTier, playerX, playerY, true);
      }
    }
  }
```

Modify `spawnInZone` signature to accept an optional `skipDistCheck` parameter:

```typescript
  private spawnInZone(
    zone: ZoneDefinition,
    playerTier: number,
    playerX: number,
    playerY: number,
    skipDistCheck: boolean = false
  ): void {
    // ... existing code ...

    // Replace the dist check block:
    if (!skipDistCheck) {
      const distToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY);
      if (distToPlayer < 200 || distToPlayer > 2000) return;
    }
```

Also increase the max spawn distance from 1200 to 2000 in the normal (non-skip) path.

- [ ] **Step 2: Increase Near-Earth Orbit density**

In `src/data/zones.ts`, increase `maxObjects` for the Near-Earth zone from `15` to `25`. This means more targets visible on screen at Tier 1.

Also tighten the spawn spread so objects cluster around the player's starting altitude (not scattered from the center to edge of the zone):

```typescript
  // In spawnInZone, replace the zone position calculation with:
  // Bias spawn toward player distance rather than full zone radius
  const playerDist = Phaser.Math.Distance.Between(playerX, playerY, CENTER_X, CENTER_Y);
  const bias = skipDistCheck ? 0 : playerDist;
  const minD = skipDistCheck ? zone.minDistance : Math.max(zone.minDistance, bias - 400);
  const maxD = skipDistCheck ? zone.maxDistance : Math.min(zone.maxDistance, bias + 600);
  const dist = minD + Math.random() * (maxD - minD);
```

- [ ] **Step 3: Verify type check and tests**

```bash
pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 4: Run dev and verify spawn density**

```bash
pnpm dev
```

On first load, you should immediately see asteroids and satellites within a couple hundred pixels of the player. No waiting.

- [ ] **Step 5: Commit**

```bash
git add src/systems/ZoneManager.ts src/data/zones.ts
git commit -m "fix: pre-populate zones on start, increase spawn density and radius"
```

---

## Task 8: Final Validation

- [ ] **Step 1: Full validation suite**

```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test
```

All must pass.

- [ ] **Step 2: Manual playtest checklist**

Run `pnpm dev` and verify:

- [ ] Game loads — targets visible immediately around player
- [ ] Auto-lasers fire slowly at nearest target without any input
- [ ] WASD moves freely, gravity pulls gently downward
- [ ] Space/J fires a burst (3 gold beams rapid-fire) — energy bar decreases
- [ ] Energy recharges passively — bar refills when not bursting
- [ ] Killing targets gives instant energy spike
- [ ] Shift held = faster movement, energy drains
- [ ] Earth is visible below, gravity arrow points toward it
- [ ] Screen edges pulse when near Earth
- [ ] At 30 total mass — game pauses, 3 upgrade cards appear
- [ ] Click a card or press 1/2/3 — upgrade applies, game resumes
- [ ] After "Overclocked Guns" — auto-fire visibly faster
- [ ] After "Twin Cannons" — two beams per auto-fire
- [ ] After "Scatter Shot" — beams spread out
- [ ] HUD stays fixed size as station grows (doesn't shrink with camera zoom)
- [ ] E key does nothing (old upgrade toggle removed)
- [ ] No console errors

- [ ] **Step 3: Commit any remaining tweaks**

```bash
git add -A
git commit -m "chore: final validation — bullet hell core loop complete"
```

---

## Summary

| Task | What It Does |
|------|-------------|
| 1 | ResourceManager: simple battery, passive regen, burst/boost costs |
| 2 | Upgrade data: 13 bullet-hell cards with rarity and weighted draw |
| 3 | CombatSystem: always-on auto-fire + manual burst, no clamp |
| 4 | PlayerStation: Shift boost, gravity resistance field, remove power key |
| 5 | UpgradeScreen: fullscreen pause overlay, 3 cards, keyboard shortcuts |
| 6 | GameScene: wire everything, milestone triggers, GRAVITY_SCALE tuning |
| 7 | ZoneManager: pre-populate on start, tighter spawn clustering |
| 8 | Final validation playtest |
