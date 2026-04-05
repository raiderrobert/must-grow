# Fix: Tier Cheat Override + High-Tier Steering + Zoom on Evolution

> **For agentic workers:** Execute all steps in order.

**Goal:** Three fixes: (1) cheat tier set gets overridden by the natural tier check on unpause, (2) player is unsteerable at high tiers due to momentum, (3) tier-up zoom out is too dramatic.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Fix Tier Cheat Getting Overridden

**Problem:** The cheat sets `this.currentTier = tier` and calls `triggerEvolution(tier)`. But on the very next `update()` frame after unpausing, this code runs:

```typescript
const newTier = getTierForMass(this.resources.totalMassEarned);
if (newTier > this.currentTier) {
  this.triggerEvolution(newTier);
}
this.currentTier = newTier;
```

`getTierForMass` returns the tier based on actual mass earned — which is still low. So `newTier` is 1 or 2 regardless of what the cheat set. `this.currentTier` gets overwritten back to the real tier.

**Fix:** The cheat's `setTier` callback needs to also give the player enough mass to sustain the chosen tier. Set `totalMassEarned` to the tier's threshold so the natural tier check agrees.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update the `setTier` cheat callback**

Find the `setTier` callback in the `SettingsMenu` construction. It currently does:

```typescript
setTier: (tier: number) => {
  this.currentTier = tier;
  this.player.tier = tier;
  this.triggerEvolution(tier);
},
```

Replace with:

```typescript
setTier: (tier: number) => {
  // Give enough mass so the natural tier check doesn't override
  const thresholds = [0, 0, 100, 500, 2000, 10000];
  const requiredMass = thresholds[tier] ?? 10000;
  if (this.resources.totalMassEarned < requiredMass) {
    this.resources.totalMassEarned = requiredMass;
    this.resources.mass = requiredMass;
  }
  this.currentTier = tier;
  this.player.tier = tier;
  this.triggerEvolution(tier);
},
```

- [ ] **Step 2: Check that `totalMassEarned` is writable**

In `src/systems/ResourceManager.ts`, verify `totalMassEarned` is a public field (not a getter-only property). If it is, this just works. If it's readonly, add a setter or make it writable.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: tier cheat sets mass to threshold so natural check doesn't override"
```

---

### Task 2: Scale Thrust With Player Size

**Problem:** At tier 5, the player is 2,400px and moving at high orbital velocity. Thrust is still the same 600 * 8 = 4,800 px/s². But the player's momentum is enormous — at high speeds, 4,800 px/s² takes many seconds to change direction. The player feels like steering a cruise ship.

**Fix:** Scale thrust with tier so the player stays maneuverable as they grow. Higher tiers get proportionally stronger thrust to compensate for higher orbital velocities and larger scales.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add thrust scaling to `triggerEvolution`**

In `triggerEvolution()`, after the existing tier power spike section, add thrust scaling:

```typescript
    // Thrust scales with tier so the player stays maneuverable
    const thrustMultipliers = [1, 2, 5, 15, 40]; // T1 through T5
    const thrustIdx = Math.min(newTier - 1, thrustMultipliers.length - 1);
    this.player.speed = PLAYER_THRUST_POWER * thrustMultipliers[thrustIdx];
```

Make sure `PLAYER_THRUST_POWER` is imported from `@/constants`.

This gives:
| Tier | Thrust | Feel |
|------|--------|------|
| 1 | 600 | Base — nimble satellite |
| 2 | 1,200 | Snappier — matches faster orbit |
| 3 | 3,000 | Powerful — can maneuver near large planets |
| 4 | 9,000 | Strong — steering a planet eater |
| 5 | 24,000 | Massive thrust — needs it at 2,400px size |

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: thrust scales with tier — player stays maneuverable at high tiers"
```

---

### Task 3: Reduce Tier Evolution Zoom Out

**Problem:** `triggerEvolution` does `this.cameras.main.zoomTo(currentZoom * 0.7, ...)` — a 30% zoom out on every tier up. After 4 tier-ups that's `0.7^4 = 0.24x` of the original zoom. Way too much.

**Fix:** Reduce to 20% zoom out: `currentZoom * 0.8`.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update zoom multiplier in `triggerEvolution`**

Find:

```typescript
    this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut");
```

Change to:

```typescript
    this.cameras.main.zoomTo(currentZoom * 0.8, 1000, "Cubic.easeInOut");
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: tier evolution zoom out reduced from 30% to 20%"
```
