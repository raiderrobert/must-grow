# Fix: Player Grows Too Slowly + Weapon Range Jumps Too Dramatically

> **For agentic workers:** Execute all steps in order.

**Goal:** Make the player visibly larger at high tiers and smooth out the weapon range scaling so it doesn't jump 10x per tier.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Steeper Size Growth

**Problem:** The tier size multipliers are `[1, 3, 6, 10, 15]` with `PLAYER_START_SIZE = 8`. At tier 5 max, the player is `8 * 15 * 1.5 = 180px`. In a world where planets are 3,000-25,000px radius, 180px is still a speck. The "Planet Eater" should look like a threat next to a planet.

**Fix:** Increase the size multipliers dramatically. The player should be visibly imposing by tier 4 and enormous by tier 5.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update tier size multipliers**

Find the `tierSizeMultipliers` array in `update()`:

```typescript
    const tierSizeMultipliers = [1, 3, 6, 10, 15];
```

Replace with:

```typescript
    const tierSizeMultipliers = [1, 5, 20, 80, 300];
```

This gives (with `PLAYER_START_SIZE = 8` and up to 1.5x within-tier growth):

| Tier | Base Size | Max Size (within tier) | Feel |
|------|-----------|----------------------|------|
| 1 | 8px | 12px | Tiny satellite |
| 2 | 40px | 60px | Visible station |
| 3 | 160px | 240px | Large — bigger than Mercury (400px radius) on screen |
| 4 | 640px | 960px | Massive — comparable to Mars (700px) |
| 5 | 2,400px | 3,600px | Enormous — bigger than Earth (3,000px radius) |

By tier 5 the player is literally bigger than Earth. That's what "Star Killer" should feel like.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: steeper size growth — tier 5 player is bigger than Earth"
```

---

### Task 2: Smoother Weapon Range Scaling

**Problem:** Weapon range uses `Math.pow(10, tier - 1)` — that's 1x, 10x, 100x, 1,000x, 10,000x. The jump from tier 1 (300px) to tier 2 (3,000px) is jarring, and by tier 4 (300,000px) you can shoot across the entire solar system which feels broken.

**Fix:** Use a gentler multiplier. 3x per tier instead of 10x. This gives meaningful progression without making range absurd.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update the tier multiplier in `triggerEvolution`**

Find the tier power spike section in `triggerEvolution()`:

```typescript
    const tierMultiplier = Math.pow(10, newTier - 1);
```

Replace with a 3x-per-tier curve:

```typescript
    const tierMultiplier = Math.pow(3, newTier - 1); // T1=1, T2=3, T3=9, T4=27, T5=81
```

This gives:

| Tier | Range | Damage | Feel |
|------|-------|--------|------|
| 1 | 300px | 10 | Short range, chip damage |
| 2 | 900px | 30 | Can hit things nearby |
| 3 | 2,700px | 90 | Meaningful reach |
| 4 | 8,100px | 270 | Can engage planets from orbit |
| 5 | 24,300px | 810 | Long range bombardment |

At tier 4 with 8,100px range and 270 damage, Earth (100,000 health) takes ~370 hits = ~5.5 minutes of sustained fire at 900ms cooldown. Feels like a real battle, not an instant kill.

At tier 5 with 24,300px range and 810 damage, the Sun (500,000 health) takes ~617 hits = ~9 minutes. Epic final boss fight.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: weapon range 3x per tier instead of 10x — progression without absurdity"
```
