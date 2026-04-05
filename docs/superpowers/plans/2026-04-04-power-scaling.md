# Fix: Steeper Power Scaling — Each Tier Should Feel Like a Transformation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each tier upgrade makes the player visibly larger and applies a 10x multiplier to weapon range and damage. By tier 4 the player should be a massive station that can reasonably attack planets.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

Three compounding issues make the player feel weak:

1. **Growth is logarithmic** — `growthFactor = 1 + log2(1 + mass) * 0.5`. At tier 4 (2,000 mass) the player is only 6.5x starting size (52px). Barely visible next to planets.

2. **No tier-based power spike** — `triggerEvolution()` shows a text banner but doesn't actually boost anything. All power comes from individual upgrade card picks which are additive/small.

3. **Upgrade cards are too incremental** — beam range +40%, damage +30%. After many picks you might reach 3x. Against planet health pools of 50,000-500,000, this is nothing.

## The Fix

When the player reaches a new tier, apply a massive power multiplier automatically:

| Tier | Size Mult | Range Mult | Damage Mult | Cumulative Range | Cumulative Damage |
|------|-----------|------------|-------------|------------------|-------------------|
| 1 | 1x | 1x | 1x | 300px | 10 |
| 2 | 3x | 10x | 10x | 3,000px | 100 |
| 3 | 6x | 100x | 100x | 30,000px | 1,000 |
| 4 | 10x | 1,000x | 1,000x | 300,000px | 10,000 |
| 5 | 15x | 10,000x | 10,000x | 3,000,000px | 100,000 |

These are BASE multipliers from tier. Upgrade cards multiply on top of these — so a +40% range card at tier 3 gives 30,000 * 1.4 = 42,000px range.

The growth formula also changes from logarithmic to tier-based stepping so size jumps are dramatic and visible.

---

### Task 1: Add Tier Power Multipliers to `triggerEvolution`

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Apply tier multipliers in `triggerEvolution`**

Find the `triggerEvolution` method in `GameScene.ts`. After the existing zoom and text banner code, add stat multipliers:

```typescript
  private triggerEvolution(newTier: number): void {
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut");

    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `TIER ${newTier}: ${getTierName(newTier).toUpperCase()}`,
        { fontFamily: "monospace", fontSize: "32px", color: "#6c63ff", stroke: "#000", strokeThickness: 4 }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300);

    this.audio.play("sfx_tier_up");
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40, duration: 3000, ease: "Power2",
      onComplete: () => text.destroy(),
    });
    this.audio.music.onTierChange(newTier);

    // ── Tier power spike ──────────────────────────────────────────
    // Each tier is 10x more powerful than the last
    const tierMultiplier = Math.pow(10, newTier - 1); // T1=1, T2=10, T3=100, T4=1000, T5=10000

    this.combat.beamRange = 300 * tierMultiplier;
    this.combat.beamDamage = 10 * tierMultiplier;
    this.combat.autoFireCooldown = Math.max(100, 900 / (1 + (newTier - 1) * 0.5)); // gets faster but capped

    // Burst also scales
    this.combat.burstShotCount = 3 + (newTier - 1) * 2;

    // Debris pickup range scales with size
    this.combat.debrisPickupRange = 80 * (1 + (newTier - 1) * 2);

    // Camera shake for dramatic effect
    this.cameras.main.shake(500, 0.01 * newTier);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: tier evolution applies 10x power multiplier — range, damage, burst"
```

---

### Task 2: Steeper Size Growth

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Replace logarithmic growth with tier-based stepping**

Find the growth section in `update()`:

```typescript
    const growthFactor = 1 + Math.log2(1 + this.resources.totalMassEarned) * 0.5;
    this.player.setSize(PLAYER_START_SIZE * growthFactor);
```

Replace with tier-based growth that jumps dramatically at each tier boundary, with smooth interpolation within tiers:

```typescript
    // Size grows dramatically with tier — visible jumps at each evolution
    const tierSizeMultipliers = [1, 3, 6, 10, 15]; // T1 through T5
    const tierIdx = Math.min(this.currentTier - 1, tierSizeMultipliers.length - 1);
    const baseMult = tierSizeMultipliers[tierIdx];

    // Smooth growth within current tier (up to 50% larger before next tier)
    const currentThreshold = this.currentTier <= 1 ? 0 :
      [0, 0, 100, 500, 2000, 10000][this.currentTier] ?? 0;
    const nextThreshold = [0, 100, 500, 2000, 10000, 50000][this.currentTier] ?? 50000;
    const tierProgress = Math.min(1,
      (this.resources.totalMassEarned - currentThreshold) / (nextThreshold - currentThreshold)
    );
    const withinTierGrowth = 1 + tierProgress * 0.5; // up to 1.5x within a tier

    const growthFactor = baseMult * withinTierGrowth;
    this.player.setSize(PLAYER_START_SIZE * growthFactor);
```

At tier 1: 8px → up to 12px.
At tier 2: 24px → up to 36px. Visibly bigger.
At tier 3: 48px → up to 72px. Substantial.
At tier 4: 80px → up to 120px. Clearly a large station.
At tier 5: 120px → up to 180px. Dominant.

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: tier-based size growth — dramatic visible jumps at each evolution"
```

---

### Task 3: Verify Power Fantasy

**Files:** None — gameplay verification.

- [ ] **Step 1: Run the game**

Run: `pnpm dev`

Check at each tier:
- [ ] **Tier 1 → 2** (100 mass): Player visibly grows. Beam range jumps from 300px to 3,000px — can hit targets far away. Damage goes from 10 to 100 — one-shots early debris.
- [ ] **Tier 2 → 3** (500 mass): Another visible size jump. Range 30,000px — can shoot across a significant chunk of orbit. Damage 1,000 — chews through asteroids.
- [ ] **Tier 3 → 4** (2,000 mass): Large station. Range 300,000px — can hit planets from far away. Damage 10,000 — can actually damage planets (Earth has 100,000 health = ~10 seconds of sustained fire).
- [ ] **Tier 4 → 5** (10,000 mass): Massive. Range and damage make destroying planets and eventually the Sun feasible.

- [ ] **Step 2: Tune if too strong/weak**

If planets die too fast: reduce the multiplier base from 10 to 5 (`Math.pow(5, newTier - 1)`).
If still too weak at tier 4: increase planet vulnerability or reduce planet health pools.

The goal: by tier 4 "Planet Eater" you can actually eat planets. By tier 5 "Star Killer" you can take on the Sun.

- [ ] **Step 3: Commit any tuning**

```bash
git add -A
git commit -m "chore: tune tier power scaling"
```
