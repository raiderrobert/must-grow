# Fix: Debris Drifts Away From Orbiting Planets

> **For agentic workers:** Execute all steps in order.

**Goal:** Fix debris belt objects drifting away from the planets they should orbit.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

Planets move via exact circular orbit math each frame:
```
x = parentX + cos(angle) * distance  // exact position, no drift
```

Debris moves via Euler velocity integration:
```
velocity += gravity * dt
position += velocity * dt  // accumulates floating point error
```

These two integration methods diverge over time. Even if debris starts with the perfect velocity, Euler integration introduces drift that compounds each frame. After a few seconds, the debris has shifted enough that it's no longer orbiting the planet — it's on a different trajectory.

This is a fundamental mismatch: **prescribed orbits (planets) vs simulated orbits (debris) don't stay in sync.**

## The Fix

For debris that is within a planet's SOI, apply a gentle correction force that pulls it toward the correct circular orbit. This acts like orbital "stickiness" — debris naturally stays in orbit around its dominant body rather than drifting away. The correction is subtle enough that it doesn't look artificial but strong enough to prevent Euler drift from accumulating.

**Approach: Velocity correction toward circular orbit each frame**

For each object inside a planet's SOI:
1. Calculate what the ideal circular orbital velocity would be at the object's current distance from the dominant body
2. Calculate the object's current velocity relative to the dominant body (subtract the body's velocity)
3. Blend the current relative velocity toward the ideal orbital velocity by a small factor each frame
4. Add the body's velocity back

This continuously nudges debris toward stable circular orbits without snapping them. Objects hit by player beams or explosions deviate temporarily but settle back into orbit.

---

### Task 1: Add Orbital Velocity Correction

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add correction to the zone object gravity loop**

In `GameScene.update()`, find the gravity loop for zone objects (around line 218-225). Replace it with a version that also applies orbital velocity correction:

```typescript
    // Gravity + orbital correction on all zone objects
    for (const obj of this.zones.getObjects()) {
      if (!obj.sprite.active || !obj.sprite.body) continue;
      const ox = obj.sprite.x;
      const oy = obj.sprite.y;

      // Find dominant body
      const dominant = this.gravity.getDominantBody(ox, oy);
      if (!dominant) continue;

      // Apply gravity from dominant body only
      const objPull = this.gravity.calculateDominantPull(ox, oy);
      const objBody = obj.sprite.body as Phaser.Physics.Arcade.Body;
      objBody.velocity.x += objPull.x * (delta / 1000) * GRAVITY_SCALE;
      objBody.velocity.y += objPull.y * (delta / 1000) * GRAVITY_SCALE;

      // Orbital velocity correction — nudge toward stable circular orbit
      const dx = dominant.x - ox;
      const dy = dominant.y - oy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Ideal circular orbit speed at this distance
      const idealSpeed = Math.sqrt(
        GRAVITY_CONSTANT * dominant.gravityMass * GRAVITY_SCALE / dist
      );

      // Tangent direction (perpendicular to body→object line)
      const nx = dx / dist;
      const ny = dy / dist;
      // Pick tangent direction that matches current velocity direction
      const currentRelVx = objBody.velocity.x - (dominant.velocityX ?? 0);
      const currentRelVy = objBody.velocity.y - (dominant.velocityY ?? 0);
      const cross = currentRelVx * ny - currentRelVy * nx;
      const sign = cross >= 0 ? 1 : -1;
      const tangentX = -ny * sign;
      const tangentY = nx * sign;

      // Ideal velocity (tangential at circular orbit speed + body's own velocity)
      const idealVx = tangentX * idealSpeed + (dominant.velocityX ?? 0);
      const idealVy = tangentY * idealSpeed + (dominant.velocityY ?? 0);

      // Blend toward ideal — 2% per frame keeps it subtle but prevents drift
      const correction = 0.02;
      objBody.velocity.x += (idealVx - objBody.velocity.x) * correction;
      objBody.velocity.y += (idealVy - objBody.velocity.y) * correction;
    }
```

The `0.02` correction factor means each frame the velocity moves 2% closer to the ideal orbit. This:
- Prevents Euler drift from accumulating (debris stays in orbit)
- Doesn't snap objects instantly (looks natural)
- Objects knocked by explosions slowly return to orbit over ~2-3 seconds
- Works regardless of which body is dominant (Earth, Jupiter, Sun)

- [ ] **Step 2: Ensure `dominant.velocityX/Y` is populated**

The correction code reads `dominant.velocityX` and `dominant.velocityY`. These should already be set by `updateOrbits()` — verify that `updateOrbits` writes velocity to each tracked body's gravityBody:

Search for where velocityX/Y are set in `updateOrbits`:

```bash
grep -n "velocityX\|velocityY" src/scenes/GameScene.ts
```

If `updateOrbits` does NOT set these, add them. After the position update lines in `updateOrbits`:

```typescript
      // Store body's orbital velocity for other systems
      const linearSpeed = orbit.orbitSpeed * orbit.distance * ORBIT_SPEED_SCALE;
      const perpAngle = orbit.currentAngle + Math.PI / 2;
      tracked.gravityBody.velocityX = Math.cos(perpAngle) * linearSpeed;
      tracked.gravityBody.velocityY = Math.sin(perpAngle) * linearSpeed;
```

Also make sure `GravityBody` interface has `velocityX?: number` and `velocityY?: number` fields. Check `src/systems/GravitySystem.ts`.

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts src/systems/GravitySystem.ts
git commit -m "fix: orbital velocity correction keeps debris in stable orbits around planets"
```

---

### Task 2: Verify Debris Orbits

**Files:** None — gameplay verification.

- [ ] **Step 1: Run the game**

Run: `pnpm dev`

Check:
- [ ] Debris around Earth visibly moves with Earth (doesn't get left behind)
- [ ] Debris appears to orbit Earth (curved paths, not straight lines)
- [ ] After destroying an object and new debris spawns, the energy pickups drift naturally (they have drag from `Debris.ts` so they slow down — this is fine)
- [ ] Objects near Jupiter orbit Jupiter, not drift away

- [ ] **Step 2: Tune correction factor if needed**

If debris still drifts: increase `correction` from `0.02` to `0.05`.
If debris movement looks jerky/unnatural: decrease to `0.01`.

- [ ] **Step 3: Commit any tuning**

```bash
git add -A
git commit -m "chore: tune orbital correction factor"
```
