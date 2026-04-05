# Fix: Endgame Energy + Range Scaling — Can't Reach the Sun

> **For agentic workers:** Execute all steps in order.

**Goal:** At tier 5 "Star Killer", the player needs enough beam range to hit the Sun from a safe distance, enough energy regen to sustain continuous fire, and enough battery to support the fight.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

At tier 5 with `3^4 = 81x` multiplier:
- Beam range: `300 * 81 = 24,300px`
- Sun's kill radius: `25,000px`
- Sun's SOI: `25,000 * 5 = 125,000px`

The player can't get within 24,300px of the Sun without being inside the kill zone (25,000px). They literally can't shoot it — the beam is shorter than the danger zone.

Also, sustained fire at tier 5 damage drains energy fast, but regen is still the base rate plus a few upgrade card picks. The battery runs dry mid-fight.

## The Fix

Scale energy regen and battery capacity with tier alongside range and damage. Also ensure beam range at tier 5 exceeds the Sun's kill zone radius.

---

### Task 1: Scale Energy Stats With Tier

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add energy scaling to `triggerEvolution`**

In `triggerEvolution()`, after the existing tier power spike section (where `beamRange`, `beamDamage`, etc. are set), add energy scaling:

```typescript
    // Energy scales with tier — sustain longer fights at higher tiers
    const energyMultiplier = Math.pow(3, newTier - 1); // same curve as weapons
    this.resources.batteryCapacity = 100 * energyMultiplier;
    this.resources.energy = this.resources.batteryCapacity; // full refill on tier up
    this.resources.passiveRechargeRate = 8 * energyMultiplier;
```

This gives:

| Tier | Battery | Regen/sec | Duration at max fire rate |
|------|---------|-----------|--------------------------|
| 1 | 100 | 8 | Base gameplay |
| 2 | 300 | 24 | Comfortable |
| 3 | 900 | 72 | Extended fights |
| 4 | 2,700 | 216 | Planet-length battles |
| 5 | 8,100 | 648 | Sun fight sustainable |

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: battery capacity and energy regen scale with tier"
```

---

### Task 2: Ensure Beam Range Exceeds Sun Kill Zone at Tier 5

**Problem:** `beamRange = 300 * 81 = 24,300px` but Sun's `killRadius = 25,000px`. The beam can't reach the Sun from outside the death zone.

**Fix:** Two options — increase the base range multiplier, or use a steeper curve for range specifically. The simplest: use `4^(tier-1)` for range instead of `3^(tier-1)`.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Use steeper range scaling**

In `triggerEvolution()`, find where `beamRange` is set:

```typescript
    this.combat.beamRange = 300 * tierMultiplier;
```

Replace with a range-specific multiplier:

```typescript
    const rangeMultiplier = Math.pow(4, newTier - 1); // T1=1, T2=4, T3=16, T4=64, T5=256
    this.combat.beamRange = 300 * rangeMultiplier;
```

This gives:

| Tier | Range | Can hit from... |
|------|-------|-----------------|
| 1 | 300px | Close combat |
| 2 | 1,200px | Nearby |
| 3 | 4,800px | Across orbit |
| 4 | 19,200px | Planet bombardment from far orbit |
| 5 | 76,800px | Well outside Sun's 25,000px kill zone |

At tier 5 with 76,800px range, the player can park 50,000px from the Sun and comfortably bombard it. The Sun's atmosphere warning band starts at `25,000 * 1.2 = 30,000px` — the player doesn't even enter the warning zone.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: beam range uses 4x per tier — can reach Sun from safe distance at tier 5"
```
