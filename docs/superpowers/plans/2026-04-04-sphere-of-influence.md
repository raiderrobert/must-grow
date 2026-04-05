# Fix: Sphere of Influence — Only Dominant Body's Gravity Applies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace N-body gravity (every object pulled by every body simultaneously) with sphere-of-influence gravity (each object only pulled by its single dominant body). This is how Kerbal Space Program handles gravity — it's what makes local orbits stable and predictable.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

Currently `GravitySystem.calculateTotalPull()` sums gravity from ALL bodies. A debris object near Earth feels:
- Earth pulling it one direction (~30px/s²)
- The Sun pulling it another direction (~25px/s²) because the Sun is 10x more massive

These competing forces rip debris out of Earth's orbit. No amount of mass tuning fixes this — the Sun always dominates at solar system distances.

Real space games solve this with **sphere of influence (SOI)**. Each body has a radius within which it's the dominant gravity source. Inside Earth's SOI, only Earth's gravity matters. Leave it, and you switch to the Sun's gravity. Simple, predictable, and makes local orbits stable.

## The Fix

### Sphere of Influence Radius

Each body gets an SOI radius. The classic formula is:

```
SOI = distance_to_parent * (body_mass / parent_mass) ^ 0.4
```

But since this is arcade, we can simplify: **SOI = killRadius * K** where K is a tunable multiplier. Larger K = bigger sphere of influence = harder to escape orbit. Start with `K = 5` — Earth's SOI would be `3,000 * 5 = 15,000px` (the debris belt extends to 8,000px altitude = 11,000px from center, well within SOI).

The Sun's SOI is infinite — it's the default when you're not inside any planet's SOI.

### Gravity Lookup Change

Instead of `calculateTotalPull()` (sum of all bodies), add `calculateDominantPull()` — finds the body whose SOI you're inside (smallest SOI wins if overlapping), and returns only that body's gravity.

---

### Task 1: Add SOI to GravitySystem

**Files:**
- Modify: `src/systems/GravitySystem.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Add SOI multiplier constant**

In `src/constants.ts`, add:

```typescript
export const SOI_MULTIPLIER = 5; // sphere of influence = killRadius * this
```

- [ ] **Step 2: Add `calculateDominantPull` to GravitySystem**

In `src/systems/GravitySystem.ts`, add the import for the constant:

```typescript
import { GRAVITY_CONSTANT, SOI_MULTIPLIER } from "@/constants";
```

Add this method to the `GravitySystem` class:

```typescript
  /**
   * Find the dominant gravity body for a position and return only its pull.
   * Uses sphere of influence — each body's SOI is killRadius * SOI_MULTIPLIER.
   * If inside multiple SOIs, the smallest (most local) one wins.
   * If inside no planet SOI, the Sun (largest mass body without killRadius, or
   * the body with the largest SOI) acts as default.
   */
  calculateDominantPull(px: number, py: number): GravityPull {
    let dominantBody: GravityBody | null = null;
    let smallestSOI = Infinity;
    let fallbackBody: GravityBody | null = null;
    let fallbackMass = 0;

    for (const body of this.bodies) {
      if (body.killRadius !== undefined && body.killRadius > 0) {
        const soi = body.killRadius * SOI_MULTIPLIER;
        const dx = body.x - px;
        const dy = body.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < soi && soi < smallestSOI) {
          dominantBody = body;
          smallestSOI = soi;
        }
      }

      // Track the most massive body as fallback (the Sun)
      if (body.gravityMass > fallbackMass) {
        fallbackMass = body.gravityMass;
        fallbackBody = body;
      }
    }

    const activeBody = dominantBody ?? fallbackBody;
    if (!activeBody) return { x: 0, y: 0, magnitude: 0 };

    return this.calculatePull(activeBody, px, py);
  }

  /**
   * Returns the dominant body for a position (for external use like trajectory prediction).
   */
  getDominantBody(px: number, py: number): GravityBody | null {
    let dominantBody: GravityBody | null = null;
    let smallestSOI = Infinity;
    let fallbackBody: GravityBody | null = null;
    let fallbackMass = 0;

    for (const body of this.bodies) {
      if (body.killRadius !== undefined && body.killRadius > 0) {
        const soi = body.killRadius * SOI_MULTIPLIER;
        const dx = body.x - px;
        const dy = body.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < soi && soi < smallestSOI) {
          dominantBody = body;
          smallestSOI = soi;
        }
      }

      if (body.gravityMass > fallbackMass) {
        fallbackMass = body.gravityMass;
        fallbackBody = body;
      }
    }

    return dominantBody ?? fallbackBody;
  }
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/systems/GravitySystem.ts src/constants.ts
git commit -m "feat: sphere of influence — calculateDominantPull returns only the local body's gravity"
```

---

### Task 2: Add SOI Tests

**Files:**
- Modify: `tests/systems/GravitySystem.test.ts`

- [ ] **Step 1: Add SOI tests**

Append to the existing `describe("GravitySystem")` block in `tests/systems/GravitySystem.test.ts`:

```typescript
  describe("calculateDominantPull", () => {
    it("returns planet gravity when inside its SOI", () => {
      // Planet at origin with killRadius 100 → SOI = 500
      gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 100 });
      // Sun far away but massive
      gs.addBody({ x: 100_000, y: 0, gravityMass: 500_000 });

      // Player at (200, 0) — inside planet SOI (dist 200 < 500)
      const pull = gs.calculateDominantPull(200, 0);
      // Should pull toward planet (negative x), not toward Sun (positive x)
      expect(pull.x).toBeLessThan(0);
    });

    it("returns Sun gravity when outside all planet SOIs", () => {
      gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 100 }); // SOI = 500
      gs.addBody({ x: 100_000, y: 0, gravityMass: 500_000 }); // Sun (no killRadius = fallback)

      // Player at (5000, 0) — outside planet SOI (dist 5000 > 500)
      const pull = gs.calculateDominantPull(5000, 0);
      // Should pull toward Sun (positive x)
      expect(pull.x).toBeGreaterThan(0);
    });

    it("picks smallest SOI when inside multiple", () => {
      // Small planet with small SOI
      gs.addBody({ x: 0, y: 0, gravityMass: 500, killRadius: 100 }); // SOI = 500
      // Large planet with large SOI that also covers origin
      gs.addBody({ x: 0, y: 300, gravityMass: 5000, killRadius: 200 }); // SOI = 1000

      // Player at (0, 100) — inside both SOIs. Small planet SOI (500) wins.
      const pull = gs.calculateDominantPull(0, 100);
      // Should pull toward small planet at (0,0), so negative y
      expect(pull.y).toBeLessThan(0);
    });

    it("falls back to most massive body when no SOIs contain position", () => {
      gs.addBody({ x: 0, y: 0, gravityMass: 100, killRadius: 50 }); // SOI = 250
      gs.addBody({ x: 50_000, y: 0, gravityMass: 999_999 }); // massive, no killRadius

      // Player far from everything
      const pull = gs.calculateDominantPull(25_000, 0);
      // Should pull toward massive body (positive x direction)
      expect(pull.x).toBeGreaterThan(0);
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- tests/systems/GravitySystem.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/systems/GravitySystem.test.ts
git commit -m "test: sphere of influence gravity tests"
```

---

### Task 3: Switch GameScene to Use Dominant Pull

Replace all `calculateTotalPull` calls with `calculateDominantPull`.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Switch player gravity to dominant pull**

In `GameScene.update()`, find the player gravity section:

```typescript
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
```

Change to:

```typescript
    const pull = this.gravity.calculateDominantPull(this.player.x, this.player.y);
```

- [ ] **Step 2: Switch zone object gravity to dominant pull**

Find the loop that applies gravity to zone objects:

```typescript
    for (const obj of this.zones.getObjects()) {
      if (!obj.sprite.active || !obj.sprite.body) continue;
      const objPull = this.gravity.calculateTotalPull(obj.sprite.x, obj.sprite.y);
```

Change `calculateTotalPull` to `calculateDominantPull`:

```typescript
      const objPull = this.gravity.calculateDominantPull(obj.sprite.x, obj.sprite.y);
```

- [ ] **Step 3: Switch debris gravity to dominant pull**

Find the loop that applies gravity to debris:

```typescript
    for (const sprite of this.combat.debrisGroup.getChildren()) {
      const s = sprite as Phaser.Physics.Arcade.Sprite;
      if (!s.active || !s.body) continue;
      const debrisPull = this.gravity.calculateTotalPull(s.x, s.y);
```

Change `calculateTotalPull` to `calculateDominantPull`:

```typescript
      const debrisPull = this.gravity.calculateDominantPull(s.x, s.y);
```

- [ ] **Step 4: Update gravity indicator to use dominant body**

Find `updateGravityIndicator()`. It currently loops all bodies to find danger level. Update it to show the dominant body's danger level:

```typescript
  private updateGravityIndicator(): void {
    this.gravityIndicatorGraphics.clear();
    const pull = this.gravity.calculateDominantPull(this.player.x, this.player.y);
    if (pull.magnitude < 0.1) return;

    const nx = pull.x / pull.magnitude;
    const ny = pull.y / pull.magnitude;

    const dominant = this.gravity.getDominantBody(this.player.x, this.player.y);
    let color = 0x4488cc;
    let alpha = 0.6;
    let arrowLength = 20;

    if (dominant) {
      const level = this.gravity.getDangerLevel(dominant, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { color = 0xff4444; alpha = 1.0; arrowLength = 28; }
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
```

- [ ] **Step 5: Update trajectory predictor to use dominant pull**

In `src/ui/TrajectoryPredictor.ts`, the `predictTrajectory` function currently loops all bodies for gravity. Change it to find the dominant body at each step and only apply that body's gravity:

In the `predictTrajectory` function, replace the inner gravity loop:

```typescript
    // OLD: apply gravity from ALL bodies
    for (const body of bodies) {
      ...
    }
```

With dominant-body-only logic:

```typescript
    // Find dominant body at this position (smallest SOI containing it, or most massive)
    let dominantBody: typeof bodies[number] | null = null;
    let smallestSOI = Infinity;
    let fallbackBody: typeof bodies[number] | null = null;
    let fallbackMass = 0;

    for (const body of bodies) {
      if ('killRadius' in body && body.killRadius !== undefined && body.killRadius > 0) {
        const soi = body.killRadius * 5; // SOI_MULTIPLIER
        const bdx = body.x - x;
        const bdy = body.y - y;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bdist < soi && soi < smallestSOI) {
          dominantBody = body;
          smallestSOI = soi;
        }
      }
      if (body.gravityMass > fallbackMass) {
        fallbackMass = body.gravityMass;
        fallbackBody = body;
      }
    }

    const activeBody = dominantBody ?? fallbackBody;
    if (activeBody) {
      const dx = activeBody.x - x;
      const dy = activeBody.y - y;
      const distSq = dx * dx + dy * dy;
      const minDist = 20;
      if (distSq >= minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const force = (GRAVITY_CONSTANT * activeBody.gravityMass) / distSq;
        velX += (dx / dist) * force * dt * gravityScale;
        velY += (dy / dist) * force * dt * gravityScale;
      }
    }
```

Also update the `predictTrajectory` function signature to accept bodies with `killRadius`:

```typescript
export function predictTrajectory(
  px: number, py: number,
  vx: number, vy: number,
  bodies: readonly { x: number; y: number; gravityMass: number; killRadius?: number }[],
  steps: number,
  durationSec: number,
  gravityScale: number
): TrajectoryPoint[] {
```

- [ ] **Step 6: Type check and test**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: All clean. Trajectory predictor tests may need updating since the function signature changed — `killRadius` is now optional on bodies, existing tests pass `{}` bodies without it which is fine (they fall back to most massive).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.ts src/ui/TrajectoryPredictor.ts
git commit -m "feat: switch all gravity to sphere of influence — only dominant body pulls"
```

---

### Task 4: Verify Orbits Work

**Files:** None — gameplay verification.

- [ ] **Step 1: Run the game**

Run: `pnpm dev`

Check:
- [ ] Debris around Earth orbits visibly — moves in curved paths, stays near Earth
- [ ] Player with no input orbits Earth — visible circular/elliptical path
- [ ] Flying away from Earth: at some point gravity switches from Earth to Sun — trajectory prediction line should change direction
- [ ] Approaching Jupiter: gravity switches to Jupiter when entering its SOI — trajectory curves toward Jupiter
- [ ] Debris near Jupiter orbits Jupiter, not the Sun

- [ ] **Step 2: Tune SOI_MULTIPLIER if needed**

If SOI is too small (debris escapes too easily), increase `SOI_MULTIPLIER` from 5 to 8 or 10.
If SOI is too large (hard to leave a planet's influence), decrease to 3.

- [ ] **Step 3: Commit any tuning**

```bash
git add -A
git commit -m "chore: tune SOI multiplier after playtesting"
```
