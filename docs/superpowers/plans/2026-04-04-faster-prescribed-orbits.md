# Fix: Prescribed Debris Orbits Still Too Slow

> **For agentic workers:** Execute all steps in order.

**Goal:** Crank debris orbit speed so close debris visibly zips around and the speed difference between close and far debris is obvious.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Math

Current: `DEBRIS_ORBIT_SPEED_MULT = 5`. Angular speed = `sqrt(G * M * scale / r) / r * 5`.

At Earth (gravityMass 50,000), debris at 3,500px from center (close):
```
angularSpeed = sqrt(250 * 50000 * 0.5 / 3500) / 3500 * 5 = 37.8 / 3500 * 5 = 0.054 rad/s
Full orbit = 2π / 0.054 = 116 seconds ≈ 2 minutes
```

At 8,000px from center (far):
```
angularSpeed = sqrt(250 * 50000 * 0.5 / 8000) / 8000 * 5 = 28.0 / 8000 * 5 = 0.0175 rad/s
Full orbit = 2π / 0.0175 = 359 seconds ≈ 6 minutes
```

2 minutes for close debris is barely visible. Need close debris to orbit in ~10-15 seconds and far debris in ~60 seconds.

Target for close debris (3,500px): full orbit in 12 seconds → angular speed = 2π/12 = 0.524 rad/s.
Currently 0.054 rad/s → need 0.524/0.054 = ~10x more. So `DEBRIS_ORBIT_SPEED_MULT = 50`.

At 50x, far debris (8,000px): `0.0175 * 10 = 0.175 rad/s` → full orbit in 36 seconds. Visible and clearly slower than close debris.

---

### Task 1: Increase Debris Orbit Speed Multiplier

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Update the constant**

In `src/constants.ts`, find:

```typescript
export const DEBRIS_ORBIT_SPEED_MULT = 5;
```

Change to:

```typescript
export const DEBRIS_ORBIT_SPEED_MULT = 50;
```

Expected result:
| Distance from Earth center | Full orbit time | Feel |
|---------------------------|----------------|------|
| 3,500px (close) | ~12 seconds | Zipping around |
| 5,000px (mid) | ~22 seconds | Moderate drift |
| 8,000px (far) | ~36 seconds | Gentle orbit |

Close debris clearly moves faster than far debris. The Kepler-ish `1/sqrt(r)` scaling in the angular speed formula handles the distance variation automatically.

- [ ] **Step 2: Verify**

Run: `pnpm dev`

Check:
- [ ] Close-in debris visibly orbits Earth — completes a quarter-orbit in ~3 seconds
- [ ] Far debris moves noticeably slower
- [ ] The speed difference between close and far is obvious at a glance
- [ ] Debris is still shootable (not spinning so fast you can't target it)

If too fast to shoot, reduce to `30`.
If still too slow to notice, increase to `80`.

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "feat: debris orbits 50x faster — close debris zips, far debris drifts"
```
