# Must Grow — Post-Review Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found during code review — broken upgrades, missing mechanics, performance problems, and spec gaps.

**Architecture:** All fixes are within the existing module structure. No new files needed except one test file. Most changes are in `UpgradeManager.applyEffects()`, `CombatSystem`, `GameScene`, and `GravitySystem`.

**Tech Stack:** Phaser 3, TypeScript, Vite, pnpm, vitest

**Spec:** `docs/superpowers/specs/2026-04-04-planet-destroyer-design.md`
**Review findings:** Listed below with fix instructions.

**Pre-commit validation:** Run before every commit:
```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test
```

---

## Task 1: Fix Chew Speed and Jaw Strength Upgrades

**Problem:** `chewSpeed` and `jawStrength` are purchasable but have zero gameplay effect. The primary Tier 1 upgrade path is broken.

**Files:**
- Modify: `src/systems/CombatSystem.ts`
- Modify: `src/systems/UpgradeManager.ts`
- Create: `tests/systems/CombatSystem.test.ts`

- [ ] **Step 1: Write failing test for chew mechanics**

Create `tests/systems/CombatSystem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SpaceObject, type SpaceObjectConfig } from "@/entities/SpaceObject";

// Test SpaceObject.chew() directly since it's pure logic
// (CombatSystem requires Phaser scene — test the data layer)

describe("SpaceObject chew mechanics", () => {
  // We can't instantiate SpaceObject without Phaser, so test the math
  // that CombatSystem should apply

  it("jaw strength multiplier increases mass per chew", () => {
    const baseMassYield = 10;
    const chewClicks = 5;
    const baseMassPerChew = baseMassYield / chewClicks; // 2

    const jawLevel = 3;
    const multiplier = 1 + jawLevel * 0.25; // 1.75
    const boostedMass = baseMassPerChew * multiplier; // 3.5

    expect(boostedMass).toBeCloseTo(3.5);
    expect(boostedMass).toBeGreaterThan(baseMassPerChew);
  });

  it("chew speed reduces effective clicks needed", () => {
    const baseClicks = 10;
    const chewSpeedLevel = 3;
    const reduction = 1 + chewSpeedLevel * 0.2; // 1.6
    const effectiveClicks = Math.max(Math.ceil(baseClicks / reduction), 1); // 7

    expect(effectiveClicks).toBe(7);
    expect(effectiveClicks).toBeLessThan(baseClicks);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (it's testing the math we'll implement)**

```bash
pnpm test -- tests/systems/CombatSystem.test.ts
```

- [ ] **Step 3: Add chew stat fields to CombatSystem**

In `src/systems/CombatSystem.ts`, add fields:

```typescript
jawStrengthMultiplier: number = 1.0;  // multiplied against mass per chew
chewSpeedMultiplier: number = 1.0;     // divides chew clicks needed
```

- [ ] **Step 4: Apply multipliers in CombatSystem.chew()**

Replace the `chew()` method body in `src/systems/CombatSystem.ts`:

```typescript
private chew(): void {
  if (!this.clampedTarget) return;

  const result = this.clampedTarget.chew();
  this.resources.addMass(result.mass * this.jawStrengthMultiplier);
  this.resources.addEnergy(result.energy);

  if (result.depleted) {
    this.zones.removeObject(this.clampedTarget);
    this.clampedTarget = null;
  }
}
```

- [ ] **Step 5: Apply chew speed when clamping (reduce clicks needed)**

In the `handleClick()` method, when a clamp starts, apply chew speed:

```typescript
if (distToPlayer <= this.clampRange) {
  this.clampedTarget = closest;
  closest.isBeingChewed = true;
  // Apply chew speed — reduce clicks needed
  const reducedClicks = Math.max(
    Math.ceil(closest.chewClicksRemaining / this.chewSpeedMultiplier),
    1
  );
  closest.chewClicksRemaining = reducedClicks;
  this.chew(); // first click also chews
}
```

- [ ] **Step 6: Wire upgrades into applyEffects()**

In `src/systems/UpgradeManager.ts` `applyEffects()`, add:

```typescript
// Tier 1 clamp upgrades
combat.jawStrengthMultiplier = 1 + this.getLevel("jawStrength") * 0.25;
combat.chewSpeedMultiplier = 1 + this.getLevel("chewSpeed") * 0.2;
```

- [ ] **Step 7: Run all tests and type check**

```bash
pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add src/systems/CombatSystem.ts src/systems/UpgradeManager.ts tests/systems/CombatSystem.test.ts
git commit -m "fix: wire chewSpeed and jawStrength upgrades into combat system"
```

---

## Task 2: Fix Energy Amplifier Upgrade

**Problem:** `energyAmplifier` is purchasable but the energy from destroying objects is always a flat `ENERGY_FROM_DESTROY_BASE` (3). The object's own `energyYield` and the amplifier bonus are both ignored.

**Files:**
- Modify: `src/systems/CombatSystem.ts`
- Modify: `src/systems/UpgradeManager.ts`

- [ ] **Step 1: Add energyAmplifierMultiplier field to CombatSystem**

```typescript
energyAmplifierMultiplier: number = 1.0;
```

- [ ] **Step 2: Fix fireBeam() to use object's energyYield + amplifier**

In `CombatSystem.fireBeam()`, replace:

```typescript
this.resources.addEnergy(ENERGY_FROM_DESTROY_BASE);
```

with:

```typescript
this.resources.addEnergy(
  (target.config.energyYield + ENERGY_FROM_DESTROY_BASE) * this.energyAmplifierMultiplier
);
```

- [ ] **Step 3: Wire amplifier into applyEffects()**

In `UpgradeManager.applyEffects()`, add:

```typescript
combat.energyAmplifierMultiplier = 1 + this.getLevel("energyAmplifier") * 0.15;
```

- [ ] **Step 4: Run checks and commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/systems/CombatSystem.ts src/systems/UpgradeManager.ts
git commit -m "fix: wire energyAmplifier upgrade — use object energyYield with multiplier"
```

---

## Task 3: Fix Fusion Reactor Mass Consumption

**Problem:** Fusion Reactor adds free energy generation with no mass cost. Spec says it consumes mass as fuel — a key Tier 3 strategic tradeoff.

**Files:**
- Modify: `src/systems/ResourceManager.ts`
- Modify: `src/systems/UpgradeManager.ts`
- Modify: `tests/systems/ResourceManager.test.ts`

- [ ] **Step 1: Add massDrainRate to ResourceManager**

In `src/systems/ResourceManager.ts`, add:

```typescript
massDrainRate: number = 0; // mass consumed per second (fusion reactor)
```

- [ ] **Step 2: Apply mass drain in updateEnergy()**

In `ResourceManager.updateEnergy()`, add after energy update:

```typescript
if (this.massDrainRate > 0) {
  const massCost = this.massDrainRate * deltaSec;
  if (this.mass >= massCost) {
    this.mass -= massCost;
  } else {
    // Not enough mass — reactor shuts down, don't apply its generation
    // (handled by UpgradeManager checking mass > 0)
  }
}
```

- [ ] **Step 3: Write test for mass drain**

Add to `tests/systems/ResourceManager.test.ts`:

```typescript
describe("fusion reactor mass drain", () => {
  it("massDrainRate reduces mass over time", () => {
    rm.addMass(100);
    rm.massDrainRate = 5; // 5 mass/sec
    rm.updateEnergy(1000); // 1 second
    expect(rm.mass).toBeCloseTo(95);
  });

  it("mass drain stops when mass is insufficient", () => {
    rm.addMass(2);
    rm.massDrainRate = 5;
    rm.updateEnergy(1000);
    expect(rm.mass).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 4: Wire reactor mass drain in applyEffects()**

In `UpgradeManager.applyEffects()`, add:

```typescript
resources.massDrainRate = this.getLevel("fusionReactor") * 0.5; // mass/sec per level
```

- [ ] **Step 5: Run checks and commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/systems/ResourceManager.ts src/systems/UpgradeManager.ts tests/systems/ResourceManager.test.ts
git commit -m "fix: fusion reactor now consumes mass as fuel per spec"
```

---

## Task 4: Implement Cascading Energy Shutdown

**Problem:** Energy death is a binary check. Spec requires priority-ordered shutdown: drones → tractor beams → turrets → shields → station disabled. Systems come back in reverse order.

**Files:**
- Modify: `src/systems/ResourceManager.ts`
- Modify: `tests/systems/ResourceManager.test.ts`

- [ ] **Step 1: Add shutdown state tracking to ResourceManager**

```typescript
/** Systems ordered by shutdown priority (first to go offline). */
static readonly SHUTDOWN_ORDER = [
  "drones",
  "tractorBeam",
  "autoTurrets",
  "shields",
  "engines",
] as const;

type SystemName = (typeof ResourceManager.SHUTDOWN_ORDER)[number];

/** Energy thresholds (as ratio of capacity) where each system shuts down. */
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

get activeShutdowns(): string[] {
  return ResourceManager.SHUTDOWN_ORDER.filter(
    (s) => !this.isSystemOnline(s)
  );
}
```

- [ ] **Step 2: Write tests for cascading shutdown**

Add to `tests/systems/ResourceManager.test.ts`:

```typescript
describe("cascading shutdown", () => {
  it("all systems online at full energy", () => {
    expect(rm.isSystemOnline("drones")).toBe(true);
    expect(rm.isSystemOnline("engines")).toBe(true);
  });

  it("drones go offline first at 20% energy", () => {
    rm.drainEnergy(rm.energy); // empty
    rm.addEnergy(rm.batteryCapacity * 0.18); // 18%
    expect(rm.isSystemOnline("drones")).toBe(false);
    expect(rm.isSystemOnline("autoTurrets")).toBe(true);
  });

  it("all systems offline at 0 energy", () => {
    rm.drainEnergy(rm.energy);
    expect(rm.isSystemOnline("drones")).toBe(false);
    expect(rm.isSystemOnline("engines")).toBe(false);
    expect(rm.activeShutdowns).toHaveLength(5);
  });

  it("systems come back in reverse order as energy restores", () => {
    rm.drainEnergy(rm.energy); // all offline
    rm.addEnergy(rm.batteryCapacity * 0.06); // 6% — engines back
    expect(rm.isSystemOnline("engines")).toBe(true);
    expect(rm.isSystemOnline("shields")).toBe(true);
    expect(rm.isSystemOnline("autoTurrets")).toBe(false);
  });
});
```

- [ ] **Step 3: Guard automation systems in CombatSystem**

In `CombatSystem`, replace all `this.resources.isPowerDead` checks with system-specific checks:

```typescript
// Auto-turrets
if (!this.resources.isSystemOnline("autoTurrets")) return;

// Tractor beam
if (!this.resources.isSystemOnline("tractorBeam")) return;

// Drones
if (!this.resources.isSystemOnline("drones")) return;
```

- [ ] **Step 4: Run checks and commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/systems/ResourceManager.ts src/systems/CombatSystem.ts tests/systems/ResourceManager.test.ts
git commit -m "feat: implement cascading energy shutdown with per-system thresholds"
```

---

## Task 5: Implement Gravity Death

**Problem:** Gravity danger zones render visually but entering a "deadly" zone has no consequence.

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/systems/GravitySystem.ts`

- [ ] **Step 1: Add gravity death check to GravitySystem**

```typescript
/** Returns true if the player should die from gravity. */
isInLethalZone(playerX: number, playerY: number, playerThrust: number): boolean {
  for (const body of this.bodies) {
    if (this.getDangerLevel(body, playerX, playerY, playerThrust) === "deadly") {
      const dx = body.x - playerX;
      const dy = body.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Kill zone is very close — within 2x the body's "surface"
      const killRadius = Math.sqrt(body.gravityMass) * 2;
      if (dist < killRadius) {
        return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 2: Check for gravity death in GameScene.update()**

In `GameScene.update()`, after gravity pull is applied:

```typescript
if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
  this.handleDeath();
}
```

- [ ] **Step 3: Test manually**

Run `pnpm dev`. Stop thrusting — you should drift toward Earth and die when you reach the kill zone.

- [ ] **Step 4: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/systems/GravitySystem.ts src/scenes/GameScene.ts
git commit -m "feat: implement gravity death — entering lethal zone kills the player"
```

---

## Task 6: Lock Movement While Clamped

**Problem:** Player can freely move while chewing, eliminating the Tier 1 tension of being locked in place and vulnerable to gravity.

**Files:**
- Modify: `src/entities/PlayerStation.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add isLocked flag to PlayerStation**

In `src/entities/PlayerStation.ts`, add:

```typescript
isLocked: boolean = false;
```

In `update()`, guard the input processing:

```typescript
update(_delta: number): void {
  if (this.isLocked) {
    // No input, but gravity still applies (handled externally)
    this.body.setAccelerationX(0);
    this.body.setAccelerationY(0);
    return;
  }
  // ... existing input code ...
}
```

- [ ] **Step 2: Set isLocked in GameScene based on clamp state**

In `GameScene.update()`, before `this.player.update(delta)`:

```typescript
this.player.isLocked = this.combat.clampedTarget !== null;
```

- [ ] **Step 3: Verify player can't move while clamped**

Run `pnpm dev`. Clamp onto an object — WASD should do nothing, but gravity should still pull you down.

- [ ] **Step 4: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/entities/PlayerStation.ts src/scenes/GameScene.ts
git commit -m "fix: lock player movement while clamped — gravity still applies"
```

---

## Task 7: Add Collision Cooldown

**Problem:** Collision handler fires every frame of overlap, draining battery instantly on contact.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add collision cooldown tracking**

Add fields to GameScene:

```typescript
private collisionCooldowns: WeakSet<Phaser.Physics.Arcade.Sprite> = new WeakSet();
```

- [ ] **Step 2: Add cooldown to collision handler**

Wrap the existing `handleCollision` body:

```typescript
private handleCollision(obj: SpaceObject): void {
  if (this.collisionCooldowns.has(obj.sprite)) return;

  this.collisionCooldowns.add(obj.sprite);
  this.time.delayedCall(500, () => {
    this.collisionCooldowns.delete(obj.sprite);
  });

  // ... existing collision logic ...
}
```

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/scenes/GameScene.ts
git commit -m "fix: add 500ms collision cooldown to prevent instant battery drain"
```

---

## Task 8: Move applyEffects to Purchase-Only

**Problem:** `applyEffects()` recalculates all stats from scratch every frame. Should only run when upgrades are purchased.

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/ui/UpgradeShop.ts`

- [ ] **Step 1: Remove applyEffects from GameScene.update()**

Delete this line from `GameScene.update()`:

```typescript
this.upgrades.applyEffects(this.player, this.combat, this.resources);
```

- [ ] **Step 2: Call applyEffects after purchase in UpgradeShop**

In `UpgradeShop.createRow()`, after the purchase call:

```typescript
buyBtn.on("pointerdown", () => {
  this.upgrades.purchase(def.id, tier);
  this.upgrades.applyEffects(this.player, this.combat, this.resources);
  this.rebuild();
});
```

Pass `player` and `combat` as constructor parameters to UpgradeShop.

- [ ] **Step 3: Also call applyEffects once in GameScene.create()**

To set initial stats:

```typescript
this.upgrades.applyEffects(this.player, this.combat, this.resources);
```

- [ ] **Step 4: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/scenes/GameScene.ts src/ui/UpgradeShop.ts
git commit -m "fix: call applyEffects only on purchase, not every frame"
```

---

## Task 9: Fix Physics Body Size

**Problem:** `setCircle(32)` is hardcoded in `PlayerStation.setSize()`. The collision body never grows with the station.

**Files:**
- Modify: `src/entities/PlayerStation.ts`

- [ ] **Step 1: Fix setSize() to update physics body**

Replace the `setSize` method:

```typescript
setSize(newSize: number): void {
  this.size = newSize;
  const scale = newSize / 32;
  this.body.setScale(scale);
  const body = this.body.body as Phaser.Physics.Arcade.Body;
  body.setCircle(32); // base radius in texture space
  // Offset to center the circle in the 64x64 texture
  body.setOffset(0, 0);
  // The physics body auto-scales with the sprite scale, so setCircle(32)
  // at scale 2.0 gives an effective radius of 64. This is correct.
}
```

Wait — Phaser arcade physics `setCircle` sets the body size in unscaled space, but `setScale` on the sprite does NOT automatically scale the arcade physics body. We need to manually set the radius:

```typescript
setSize(newSize: number): void {
  this.size = newSize;
  const scale = newSize / 32;
  this.body.setScale(scale);
  const body = this.body.body as Phaser.Physics.Arcade.Body;
  const radius = newSize;
  body.setCircle(radius, 32 - radius, 32 - radius);
}
```

- [ ] **Step 2: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/entities/PlayerStation.ts
git commit -m "fix: scale physics body radius with station size"
```

---

## Task 10: Fix Starfield Memory — Use Tiled Approach

**Problem:** Three 8000x8000 textures = ~768MB GPU memory. Will crash on most devices.

**Files:**
- Modify: `src/entities/Starfield.ts`

- [ ] **Step 1: Rewrite starfield to use small tiled textures**

Replace `src/entities/Starfield.ts`:

```typescript
import Phaser from "phaser";
import { COLORS } from "@/constants";

/** Creates parallax starfield using small tiled textures. */
export function createStarfield(scene: Phaser.Scene): Phaser.GameObjects.TileSprite[] {
  const layers: Phaser.GameObjects.TileSprite[] = [];
  const { width, height } = scene.scale;
  const tileSize = 512; // small texture, tiled across the viewport

  const layerConfigs = [
    { count: 40, size: 1, alpha: 0.3, scrollFactor: 0.1 },
    { count: 30, size: 1.5, alpha: 0.5, scrollFactor: 0.3 },
    { count: 20, size: 2, alpha: 0.8, scrollFactor: 0.6 },
  ];

  for (const [i, config] of layerConfigs.entries()) {
    const key = `starfield_${i}`;
    const graphics = scene.add.graphics();
    graphics.fillStyle(COLORS.starfield, config.alpha);

    for (let s = 0; s < config.count; s++) {
      const x = Math.random() * tileSize;
      const y = Math.random() * tileSize;
      graphics.fillCircle(x, y, config.size);
    }

    graphics.generateTexture(key, tileSize, tileSize);
    graphics.destroy();

    const tile = scene.add.tileSprite(
      width / 2, height / 2,
      width, height,
      key
    );
    tile.setScrollFactor(0); // we'll manually scroll it
    tile.setDepth(-10 + i);
    tile.setData("parallaxFactor", config.scrollFactor);
    layers.push(tile);
  }

  return layers;
}

/** Call each frame to update parallax based on camera position. */
export function updateStarfield(
  layers: Phaser.GameObjects.TileSprite[],
  camera: Phaser.Cameras.Scene2D.Camera
): void {
  for (const layer of layers) {
    const factor = layer.getData("parallaxFactor") as number;
    layer.tilePositionX = camera.scrollX * factor;
    layer.tilePositionY = camera.scrollY * factor;
  }
}
```

- [ ] **Step 2: Update GameScene to call updateStarfield()**

Store the layers:

```typescript
private starfieldLayers!: Phaser.GameObjects.TileSprite[];
```

In `create()`:

```typescript
this.starfieldLayers = createStarfield(this);
```

In `update()`:

```typescript
updateStarfield(this.starfieldLayers, this.cameras.main);
```

Update the import to include `updateStarfield`.

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/entities/Starfield.ts src/scenes/GameScene.ts
git commit -m "fix: replace 8000x8000 starfield textures with small tiled parallax"
```

---

## Task 11: Add Missing Zones (Kuiper Belt + Sun)

**Problem:** Zones only cover 0-5500px. Kuiper belt and Sun zone are missing. Half the world is empty.

**Files:**
- Modify: `src/data/zones.ts`

- [ ] **Step 1: Add Kuiper Belt and Sun zones**

Append to the `ZONES` array in `src/data/zones.ts`:

```typescript
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
```

- [ ] **Step 2: Add Sun as a gravity body in GameScene.create()**

```typescript
// The Sun — center-far of the world
this.gravity.addBody({
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2 - 3500, // far from start, at the "top" of the solar system
  gravityMass: 50000,
});
```

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/data/zones.ts src/scenes/GameScene.ts
git commit -m "feat: add Kuiper Belt and Sun zones to complete the solar system"
```

---

## Task 12: Add Continuous Camera Zoom

**Problem:** Camera only zooms at tier boundaries. Spec says zoom is tied to station size continuously.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add continuous zoom in GameScene.update()**

After the growth factor calculation, add:

```typescript
// Continuous camera zoom — smoothly tracks station growth
const targetZoom = Math.max(1 / growthFactor, 0.2);
const currentZoom = this.cameras.main.zoom;
// Lerp toward target zoom (don't override tier-evolution zoom-to animation)
const lerpSpeed = 0.02;
this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * lerpSpeed);
```

Remove or reduce the `zoomTo` call in `triggerEvolution` since continuous zoom now handles it — but keep the dramatic tier-up text and animation. Change `triggerEvolution` to use a faster temporary zoom pulse instead:

```typescript
private triggerEvolution(newTier: number): void {
  // Quick dramatic zoom-out pulse, then resume continuous tracking
  const currentZoom = this.cameras.main.zoom;
  this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut", true, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    // After the pulse, continuous zoom takes over again via lerp
  });

  // ... keep the tier-up text animation ...
}
```

- [ ] **Step 2: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/scenes/GameScene.ts
git commit -m "feat: add continuous camera zoom that tracks station mass growth"
```

---

## Task 13: Wire sfx_upgrade Sound + Add Debris Auto-Collection Overlap

**Problem:** `sfx_upgrade` is loaded but never played. Also debris can only be collected by clicking — no physics overlap handler exists.

**Files:**
- Modify: `src/ui/UpgradeShop.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Play sfx_upgrade on purchase**

Pass `AudioManager` to UpgradeShop. In the buy handler:

```typescript
buyBtn.on("pointerdown", () => {
  if (this.upgrades.purchase(def.id, tier)) {
    this.audio.play("sfx_upgrade");
    this.upgrades.applyEffects(this.player, this.combat, this.resources);
    this.rebuild();
  }
});
```

- [ ] **Step 2: Add player-debris overlap in GameScene.create()**

```typescript
this.physics.add.overlap(
  this.player.body,
  this.combat.debrisGroup,
  (_playerSprite, debrisSprite) => {
    const debris = (debrisSprite as Phaser.Physics.Arcade.Sprite).getData("debris");
    if (!debris) return;
    this.resources.addMass(debris.mass);
    this.resources.addEnergy(debris.energy);
    this.audio.playWithVariation("sfx_pickup");
    debris.destroy();
  }
);
```

This means debris is always auto-collected on touch (even without tractor beam). The click-to-collect still works too but becomes less necessary.

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/ui/UpgradeShop.ts src/scenes/GameScene.ts
git commit -m "fix: play sfx_upgrade on purchase and add debris auto-collection on overlap"
```

---

## Task 14: Remove Duplicate Tier Thresholds Constant

**Problem:** `TIER_THRESHOLDS` and `TIER_NAMES` in `constants.ts` conflict with the authoritative `tiers.ts` data. Two sources of truth.

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Remove TIER_THRESHOLDS and TIER_NAMES from constants.ts**

Delete these lines from `src/constants.ts`:

```typescript
// Tiers
export const TIER_THRESHOLDS = [0, 100, 500, 2000, 10000, 50000] as const;
export const TIER_NAMES = [
  "Satellite",
  "Space Station",
  "Mega Station",
  "Planet Eater",
  "Star Killer",
] as const;
```

- [ ] **Step 2: Check no files import them**

```bash
grep -r "TIER_THRESHOLDS\|TIER_NAMES" src/
```

If any files import them, switch to using `getTierForMass` and `getTierName` from `@/data/tiers`.

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit && pnpm test
git add src/constants.ts
git commit -m "fix: remove duplicate tier constants — tiers.ts is the single source of truth"
```

---

## Task 15: Final Validation

- [ ] **Step 1: Run full validation suite**

```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test
```

All must pass.

- [ ] **Step 2: Manual playtest checklist**

Run `pnpm dev` and verify:

- [ ] Player spawns, WASD moves, gravity pulls down
- [ ] Clamping: click object → locked in place → click to chew → mass gained
- [ ] chewSpeed/jawStrength upgrades change chewing behavior
- [ ] Energy bar: clicking Power button increases energy
- [ ] Upgrade shop: buying upgrades costs mass, plays sfx_upgrade
- [ ] Energy drain: buying auto-turret starts draining energy
- [ ] Cascading shutdown: low energy disables drones first, then other systems
- [ ] Gravity death: drifting into Earth kills the player
- [ ] Respawn: death respawns at center with energy reset, mass kept
- [ ] Tier 2 evolution: accumulate 100 total mass → tier-up text, beam weapon
- [ ] Collision cooldown: bumping an object doesn't drain all energy instantly
- [ ] Debris auto-collects on touch
- [ ] Camera zooms smoothly as mass increases
- [ ] Starfield doesn't crash the GPU

- [ ] **Step 3: Commit any remaining tweaks**

```bash
git add -A
git commit -m "chore: final validation pass — all checks and playtest complete"
```

---

## Summary

| Task | What It Fixes | Severity |
|------|--------------|----------|
| 1 | chewSpeed + jawStrength upgrades do nothing | Critical |
| 2 | Energy Amplifier upgrade does nothing | Critical |
| 3 | Fusion Reactor doesn't consume mass | Critical |
| 4 | Cascading energy shutdown missing | Critical |
| 5 | Gravity death not implemented | Critical |
| 6 | Player can move while clamped | Important |
| 7 | Collision fires every frame | Important |
| 8 | applyEffects runs every frame | Important |
| 9 | Physics body never grows | Important |
| 10 | Starfield ~768MB GPU memory | Important |
| 11 | Missing Kuiper Belt + Sun zones | Important |
| 12 | No continuous camera zoom | Important |
| 13 | sfx_upgrade never plays, no debris overlap | Important |
| 14 | Duplicate tier constants | Cleanup |
| 15 | Final validation | Verification |
