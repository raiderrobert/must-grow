# Fix: Debris Orbits Too Slow — Not Visibly Moving Relative to Planet

> **For agentic workers:** Execute all steps in order.

**Goal:** Make debris orbit planets at a visually interesting speed. Currently ~40px/s relative to Earth — a full orbit takes 10 minutes. Need ~200px/s so orbits are visible within seconds.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The circular orbit speed formula `sqrt(G * M * scale / dist)` gives physically consistent speeds, but they're too slow to see. Debris appears to just get dragged along with Earth rather than orbiting it. The player can't tell it's orbiting — it looks stationary relative to the planet.

## The Fix

Add a `DEBRIS_ORBIT_SPEED_MULT` constant that multiplies the local orbital velocity for debris only. This makes debris orbit faster than physics dictates — purely for visual appeal. The orbital velocity correction loop must also use this multiplier, otherwise it will drag debris back to the "real" (slow) speed.

This does NOT change gravity or planet masses. It only changes the target speed that the correction loop blends toward, and the initial spawn velocity.

---

### Task 1: Add Debris Orbit Speed Multiplier

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add constant**

In `src/constants.ts`, add:

```typescript
export const DEBRIS_ORBIT_SPEED_MULT = 5; // debris orbits planets 5x faster than physics for visual appeal
```

- [ ] **Step 2: Import in GameScene**

Add `DEBRIS_ORBIT_SPEED_MULT` to the imports from `@/constants` in `src/scenes/GameScene.ts`.

- [ ] **Step 3: Apply multiplier in `spawnDebrisBelt`**

In `spawnDebrisBelt()`, find the orbital speed calculation:

```typescript
      const orbitalSpeed = Math.sqrt(
        GRAVITY_CONSTANT * bodyMass * GRAVITY_SCALE / dist
      );
```

Multiply by the constant:

```typescript
      const orbitalSpeed = Math.sqrt(
        GRAVITY_CONSTANT * bodyMass * GRAVITY_SCALE / dist
      ) * DEBRIS_ORBIT_SPEED_MULT;
```

- [ ] **Step 4: Apply multiplier in the orbital correction loop**

In the zone object gravity loop in `update()`, find where the ideal circular orbit speed is calculated:

```typescript
      const idealSpeed = Math.sqrt(
        GRAVITY_CONSTANT * dominant.gravityMass * GRAVITY_SCALE / dist
      );
```

Multiply by the same constant:

```typescript
      const idealSpeed = Math.sqrt(
        GRAVITY_CONSTANT * dominant.gravityMass * GRAVITY_SCALE / dist
      ) * DEBRIS_ORBIT_SPEED_MULT;
```

This is critical — without this, the correction loop would continuously slow the debris back down to the "real" speed, undoing the spawn velocity boost.

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/scenes/GameScene.ts
git commit -m "feat: debris orbits 5x faster than physics — visually alive"
```

---

### Task 2: Verify

- [ ] **Step 1: Run the game**

Run: `pnpm dev`

Check:
- [ ] Debris around Earth visibly orbits — you can see objects moving relative to Earth's surface
- [ ] The orbits look like orbits (curved paths), not just fast straight-line drift
- [ ] Player can still orbit Earth comfortably (player is NOT affected by the multiplier)
- [ ] Debris around other planets also orbits visibly

- [ ] **Step 2: Tune if needed**

If still too slow: increase `DEBRIS_ORBIT_SPEED_MULT` to `8` or `10`.
If too fast (chaotic, hard to shoot): decrease to `3`.

The sweet spot is where you can clearly see debris circling the planet but it's not so fast that auto-fire can't track targets.

- [ ] **Step 3: Commit any tuning**

```bash
git add src/constants.ts
git commit -m "chore: tune debris orbit speed multiplier"
```
