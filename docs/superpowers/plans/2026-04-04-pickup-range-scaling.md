# Fix: Energy Pickup Range Doesn't Scale With Player

> **For agentic workers:** Execute all steps in order.

**Goal:** The debris attractor pickup range should scale with player size so that as you grow, you vacuum up energy from further away.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

`debrisPickupRange` is set to `80px` and only changes via the tier spike in `triggerEvolution()`:

```typescript
this.combat.debrisPickupRange = 80 * (1 + (newTier - 1) * 2);
```

This gives: T1=80, T2=240, T3=400, T4=560, T5=720.

But the player at tier 5 is 2,400-3,600px in size. A 720px pickup range means energy debris spawns outside your own body and you can't collect it. The range should be at least as large as the player so you passively absorb anything you fly over.

## The Fix

Instead of a fixed range, make it always at least `player.size + base range`. This way the pickup zone grows automatically as the player grows — no manual tuning needed.

---

### Task 1: Scale Pickup Range With Player Size

**Files:**
- Modify: `src/systems/CombatSystem.ts`

- [ ] **Step 1: Update `updateDebrisAttraction` to use player size**

In `CombatSystem.ts`, find the `updateDebrisAttraction` method. Replace the fixed `this.debrisPickupRange` check with a dynamic range based on player size:

```typescript
  private updateDebrisAttraction(): void {
    // Pickup range scales with player size — always collect things you fly over
    const effectiveRange = this.debrisPickupRange + this.player.size;

    for (const d of this.debrisList) {
      if (!d.sprite.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, d.sprite.x, d.sprite.y
      );
      if (dist < effectiveRange) {
        const angle = Phaser.Math.Angle.Between(
          d.sprite.x, d.sprite.y, this.player.x, this.player.y
        );
        const pullSpeed = 600 + (1 - dist / effectiveRange) * 1200;
        d.sprite.body!.velocity.x = Math.cos(angle) * pullSpeed;
        d.sprite.body!.velocity.y = Math.sin(angle) * pullSpeed;
      }
    }
  }
```

The only change is adding `+ this.player.size` to the range. At tier 1 (size 8): effective range = 88px. At tier 5 (size 2400): effective range = 3,120px. The player hoovers up everything they fly near.

- [ ] **Step 2: Also scale the pull speed with size**

At large sizes, 600-1800 px/s pull is slow relative to the body. Scale pull speed too:

```typescript
        const sizeBoost = Math.max(1, this.player.size / 50); // 1x at size 50, 48x at size 2400
        const pullSpeed = (600 + (1 - dist / effectiveRange) * 1200) * sizeBoost;
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/systems/CombatSystem.ts
git commit -m "fix: energy pickup range scales with player size — big player big vacuum"
```
