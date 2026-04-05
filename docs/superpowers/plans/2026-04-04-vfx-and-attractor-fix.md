# Fix: Damage Effects Don't Follow Objects + Debris Attractor Too Slow

> **For agentic workers:** Execute all steps in order.

**Goal:** Two fixes: (1) damage crack overlay follows the moving object instead of staying at the hit position, (2) debris pickup range tighter and pull speed faster to match orbital velocities.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Fix Damage Overlay Following Moving Objects

**Problem:** `SpaceObject.updateDamageVisual()` creates a standalone `Graphics` object and draws crack lines at absolute world coordinates (`this.sprite.x, this.sprite.y`). The graphics object sits at world origin. When the object orbits and moves, the cracks stay where they were drawn — the red streaks slide off the object.

**Fix:** Instead of drawing at absolute coordinates, position the `damageOverlay` graphics on top of the sprite each frame. Draw cracks relative to (0,0) and set the graphics position to match the sprite.

**Files:**
- Modify: `src/entities/SpaceObject.ts:64-86`

- [ ] **Step 1: Rewrite `updateDamageVisual` to draw relative to origin**

Replace the `updateDamageVisual` method:

```typescript
  private updateDamageVisual(): void {
    const ratio = this.health / this.maxHealth;
    if (ratio > 0.75) {
      if (this.damageOverlay) {
        this.damageOverlay.clear();
      }
      return;
    }

    if (!this.damageOverlay) {
      this.damageOverlay = this.scene.add.graphics().setDepth(2);
    }
    this.damageOverlay.clear();

    // Position the graphics object on the sprite — cracks drawn relative to (0,0)
    this.damageOverlay.setPosition(this.sprite.x, this.sprite.y);

    const r = this.config.size;
    const crackAlpha = 1 - ratio;
    this.damageOverlay.lineStyle(Math.max(1, r * 0.03), 0xff4400, crackAlpha * 0.8);

    const crackCount = Math.floor((1 - ratio) * 6) + 1;
    const seed = this.config.x * 1000 + this.config.y;
    for (let i = 0; i < crackCount; i++) {
      const a = ((seed * (i + 1) * 137.5) % 360) * (Math.PI / 180);
      const len = r * (0.5 + ((seed * (i + 3)) % 50) / 100);
      // Draw from center (0,0) outward — graphics position handles world coords
      this.damageOverlay.lineBetween(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    }
  }
```

The key change: cracks are drawn relative to `(0, 0)` and `this.damageOverlay.setPosition()` moves the whole graphics to the sprite's current position. Each time `updateDamageVisual` is called (after every hit), it redraws at the sprite's current location.

- [ ] **Step 2: Also update overlay position for objects that move between hits**

The damage overlay only updates on hit (`takeDamage` → `updateDamageVisual`). Between hits, if the object moves (orbiting), the overlay stays at the last hit position. Add a position sync to the `update` path.

SpaceObject doesn't have an `update` method called each frame. The simplest fix: in `updateDamageVisual`, also store a reference and sync position in `takeDamage`:

Actually, the cleaner fix — set the overlay to follow the sprite using Phaser's built-in mechanism. After creating the damageOverlay, make it track the sprite:

Replace the `if (!this.damageOverlay)` block:

```typescript
    if (!this.damageOverlay) {
      this.damageOverlay = this.scene.add.graphics().setDepth(2);
    }
```

This is fine as-is since we call `setPosition` every time `updateDamageVisual` runs. But between hits, the object moves and the overlay stays. 

The real fix: since `takeDamage` is called frequently during combat (auto-fire every 900ms), the overlay position updates often enough. But for extra safety, we can update overlay position in `takeDamage` even when health > 75%:

In `takeDamage`, after the tint flash, always update overlay position:

```typescript
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite.active) {
        this.sprite.clearTint();
        this.updateDamageVisual();
      }
    });
    // Keep overlay position in sync even if we don't redraw
    if (this.damageOverlay) {
      this.damageOverlay.setPosition(this.sprite.x, this.sprite.y);
    }
    return this.health <= 0;
  }
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/entities/SpaceObject.ts
git commit -m "fix: damage crack overlay follows moving objects"
```

---

### Task 2: Tighten Debris Attractor — Closer Range, Faster Pull

**Problem:** `debrisPickupRange: 150` with pull speed 200-600 px/s. With debris now orbiting at 200+ px/s, the attractor can barely keep up. Debris that enters the 150px range is moving fast enough to fly through before the pull catches it. The leash distance also feels too loose — debris hovers at the edge of range instead of snapping to the player.

**Fix:** Reduce pickup range (so collection feels snappy, not floaty) and increase pull speed dramatically so debris that enters range gets vacuumed in immediately.

**Files:**
- Modify: `src/systems/CombatSystem.ts:45,273-289`

- [ ] **Step 1: Update attractor values**

In `src/systems/CombatSystem.ts`, change the pickup range:

```typescript
  debrisPickupRange: number = 80; // was 150 — tighter, snappier collection
```

- [ ] **Step 2: Increase pull speed in `updateDebrisAttraction`**

Replace the `updateDebrisAttraction` method:

```typescript
  private updateDebrisAttraction(): void {
    for (const d of this.debrisList) {
      if (!d.sprite.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, d.sprite.x, d.sprite.y
      );
      if (dist < this.debrisPickupRange) {
        const angle = Phaser.Math.Angle.Between(
          d.sprite.x, d.sprite.y, this.player.x, this.player.y
        );
        // Much faster pull — snap debris in quickly
        const pullSpeed = 600 + (1 - dist / this.debrisPickupRange) * 1200;
        d.sprite.body!.velocity.x = Math.cos(angle) * pullSpeed;
        d.sprite.body!.velocity.y = Math.sin(angle) * pullSpeed;
      }
    }
  }
```

Changes:
- Base pull speed: 200 → 600 px/s
- Max pull speed (at closest): 600 → 1800 px/s
- Combined with range 150 → 80: debris enters the zone and gets vacuumed in within 1-2 frames

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/systems/CombatSystem.ts
git commit -m "fix: debris attractor — tighter range (80px), faster pull (600-1800px/s)"
```
