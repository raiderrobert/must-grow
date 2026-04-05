# Fix: Debris Still Not Visibly Orbiting — Correction Too Weak

> **For agentic workers:** Execute all steps in order.

**Goal:** Increase the orbital velocity correction factor so debris visibly orbits planets instead of just drifting along with them.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The orbital correction loop blends debris velocity toward the ideal at 2% per frame:

```typescript
const correction = 0.02;
objBody.velocity.x += (idealVx - objBody.velocity.x) * correction;
objBody.velocity.y += (idealVy - objBody.velocity.y) * correction;
```

This is too gentle. Gravity continuously adds radial velocity toward the planet center, and the 2% tangential correction can't keep up. The debris barely moves relative to the planet — it looks like it's being dragged along rather than orbiting.

## The Fix

Increase correction to 0.15 (15% per frame). At 60fps this reaches 99% of target in ~28 frames (~0.5 seconds). Debris snaps into orbit almost immediately and stays there firmly. Any perturbation (explosion knockback, gravity from passing near another body) corrects within half a second.

This is arcade physics — we WANT debris locked into visible orbits, not fighting realistic perturbations.

---

### Task 1: Increase Correction Factor

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Find and update the correction constant**

In `GameScene.ts`, find the orbital correction section in `update()` (around line 328-343). Find:

```typescript
      const correction = 0.02;
```

Change to:

```typescript
      const correction = 0.15;
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Verify**

Run: `pnpm dev`

Check:
- [ ] Debris around Earth is visibly moving in curved paths relative to Earth's surface
- [ ] Debris doesn't just drift alongside Earth — it clearly orbits (objects on different sides of Earth move in different directions)
- [ ] When you destroy an object and debris scatters, the pieces settle back into orbit within ~1 second

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: orbital correction 0.02→0.15 — debris visibly orbits planets"
```
