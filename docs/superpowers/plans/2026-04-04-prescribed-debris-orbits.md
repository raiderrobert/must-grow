# Fix: Prescribe Debris Orbits — Stop Fighting Physics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Debris inside a planet's SOI orbits via prescribed angle+distance (like planets), not physics simulation. Close debris orbits fast, far debris orbits slow. Clean, visible, no drift.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The velocity correction approach (blend toward ideal orbital velocity each frame) doesn't produce visible orbits. Gravity, Euler integration drift, and the correction constantly fight each other. After multiple fix attempts (correction 0.02, then 0.15, debris speed mult 5x), debris still appears to drift alongside the planet rather than orbit it.

Planets orbit perfectly because they use **prescribed motion**: `x = parentX + cos(angle) * distance`. No velocity, no gravity, no drift. Just exact position from angle.

## The Fix

Do the same for debris. Each debris object inside a planet's SOI gets:
- A **fixed orbit radius** (distance from the planet center)
- A **current angle** that increments each frame
- An **angular speed** that scales with `1/sqrt(distance)` (closer = faster, Kepler-ish) multiplied by `DEBRIS_ORBIT_SPEED_MULT`
- Position recalculated each frame as `parentX + cos(angle) * radius, parentY + sin(angle) * radius`

The debris sprite's physics velocity is irrelevant while in prescribed orbit mode — position is set directly. If the debris leaves the SOI (planet destroyed, or knocked out by something), it reverts to physics mode.

---

### Task 1: Add Prescribed Orbit Data to SpaceObject

**Files:**
- Modify: `src/entities/SpaceObject.ts`

- [ ] **Step 1: Add orbit state fields to SpaceObject**

Add fields to the `SpaceObject` class for tracking prescribed orbit:

```typescript
  // Prescribed orbit state (set when orbiting a planet)
  orbitParentName: string | null = null;
  orbitAngle: number = 0;
  orbitRadius: number = 0;
  orbitAngularSpeed: number = 0;
```

These are public so GameScene can read/write them.

- [ ] **Step 2: Commit**

```bash
git add src/entities/SpaceObject.ts
git commit -m "feat: SpaceObject orbit state fields for prescribed orbits"
```

---

### Task 2: Set Orbit State When Spawning Debris Belt

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update `spawnDebrisBelt` to set orbit state**

In `spawnDebrisBelt()`, after creating each `SpaceObject`, set its orbit state instead of relying on velocity:

Find the section where the object is created (around line 421-432). After `this.zones.addFixedObject(obj);`, add:

```typescript
      // Prescribe orbit around this planet
      obj.orbitParentName = bodyName;
      obj.orbitAngle = angle;  // the random angle used to place it
      obj.orbitRadius = dist;  // distance from planet center
      // Angular speed: closer = faster, scaled by DEBRIS_ORBIT_SPEED_MULT
      // Base: sqrt(G * M * scale / r) / r = orbital linear speed / radius = angular speed
      const baseAngularSpeed = Math.sqrt(
        GRAVITY_CONSTANT * bodyMass * GRAVITY_SCALE / dist
      ) / dist;
      obj.orbitAngularSpeed = baseAngularSpeed * DEBRIS_ORBIT_SPEED_MULT;
```

Also remove the velocity from the SpaceObject config since we're prescribing position now:

Change:
```typescript
        velocityX: bodyVx + localVx,
        velocityY: bodyVy + localVy,
```

To:
```typescript
        velocityX: 0,
        velocityY: 0,
```

The velocity doesn't matter — position will be set directly each frame.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: debris belt objects get prescribed orbit state at spawn"
```

---

### Task 3: Update Prescribed Orbits Each Frame

Replace the velocity correction loop with a prescribed position update for objects that have orbit state.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Replace the orbital correction loop**

Find the gravity + orbital correction loop for zone objects in `update()` (the block that starts with `// Gravity + orbital correction on all zone objects`). Replace the ENTIRE loop with:

```typescript
    // Update zone object positions — prescribed orbits or gravity
    for (const obj of this.zones.getObjects()) {
      if (!obj.sprite.active || !obj.sprite.body) continue;

      if (obj.orbitParentName) {
        // ── Prescribed orbit mode ──
        // Find the parent body's current position
        const parent = this.trackedBodies.find(tb => tb.name === obj.orbitParentName);
        if (!parent) {
          // Parent destroyed — clear orbit state, object reverts to physics
          obj.orbitParentName = null;
          continue;
        }

        // Advance angle
        obj.orbitAngle += obj.orbitAngularSpeed * (delta / 1000);
        if (obj.orbitAngle > Math.PI * 2) obj.orbitAngle -= Math.PI * 2;

        // Set position directly from parent + angle + radius
        const newX = parent.gravityBody.x + Math.cos(obj.orbitAngle) * obj.orbitRadius;
        const newY = parent.gravityBody.y + Math.sin(obj.orbitAngle) * obj.orbitRadius;
        obj.sprite.setPosition(newX, newY);

        // Zero out physics velocity so it doesn't fight the position
        obj.sprite.body!.velocity.x = 0;
        obj.sprite.body!.velocity.y = 0;
      } else {
        // ── Physics mode — gravity only (no prescribed orbit) ──
        const objPull = this.gravity.calculateDominantPull(obj.sprite.x, obj.sprite.y);
        const objBody = obj.sprite.body as Phaser.Physics.Arcade.Body;
        objBody.velocity.x += objPull.x * (delta / 1000) * GRAVITY_SCALE;
        objBody.velocity.y += objPull.y * (delta / 1000) * GRAVITY_SCALE;
      }

      // Keep damage overlay pinned to the moving sprite
      obj.syncOverlay();
    }
```

This completely replaces the old gravity + correction loop. Objects with `orbitParentName` set are positioned exactly. Objects without it (spawned by zones, or whose parent was destroyed) use normal gravity.

- [ ] **Step 2: Remove the old orbital correction constants**

Delete the `DEBRIS_ORBIT_SPEED_MULT` usage in the old correction `idealSpeed` calculation if it still exists. The mult is now used only in `spawnDebrisBelt` when setting `orbitAngularSpeed`. The import can stay.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: prescribed debris orbits — exact position from angle, no physics drift"
```

---

### Task 4: Handle Asteroid Ring Objects Too

The `spawnAsteroidRing` spawns objects orbiting the Sun. These should also use prescribed orbits.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Set orbit state in `spawnAsteroidRing`**

In `spawnAsteroidRing()`, after creating each object and adding it as a fixed object, set the orbit state:

```typescript
      obj.orbitParentName = "Sun";
      obj.orbitAngle = angle;
      obj.orbitRadius = dist;
      const baseAngularSpeed = Math.sqrt(
        GRAVITY_CONSTANT * sunMass * GRAVITY_SCALE / dist
      ) / dist;
      obj.orbitAngularSpeed = baseAngularSpeed * DEBRIS_ORBIT_SPEED_MULT;
```

Also zero out the velocity in the SpaceObject config:

```typescript
        velocityX: 0,
        velocityY: 0,
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: asteroid ring uses prescribed orbits around Sun"
```

---

### Task 5: Verify Orbits

**Files:** None — visual verification.

- [ ] **Step 1: Run the game**

Run: `pnpm dev`

Check:
- [ ] Debris close to Earth orbits FAST — visibly circling the planet
- [ ] Debris far from Earth orbits SLOW — drifting gently
- [ ] All debris stays locked to Earth as Earth orbits the Sun — no drifting away
- [ ] When a planet is destroyed, its debris stops orbiting and drifts off on physics (gravity from Sun takes over)
- [ ] Asteroid belt objects orbit the Sun visibly

- [ ] **Step 2: Tune `DEBRIS_ORBIT_SPEED_MULT` if needed**

If close debris orbits too fast (hard to shoot), reduce from 5 to 3.
If far debris is still too slow to see, increase to 8.

- [ ] **Step 3: Commit any tuning**

```bash
git add -A
git commit -m "chore: tune debris orbit speed"
```
