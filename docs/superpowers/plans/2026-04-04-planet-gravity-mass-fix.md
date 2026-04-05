# Fix: Planet Gravity Mass Too Low — Debris Doesn't Orbit

> **For agentic workers:** Execute all steps in order.

**Goal:** Increase planet gravity masses so their local gravity is strong enough to create visible orbits for nearby debris. Currently Earth's `gravityMass: 500` produces ~4px/s orbital velocity — objects appear stationary.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

Earth's `gravityMass` is 500. At a debris altitude of 3,500px from Earth's center:

```
orbitalSpeed = sqrt(GRAVITY_CONSTANT * gravityMass * GRAVITY_SCALE / dist)
             = sqrt(250 * 500 * 0.5 / 3500)
             = sqrt(17.86)
             ≈ 4.2 px/s
```

4.2 pixels per second is invisible. At 60fps that's 0.07 pixels per frame. The debris appears frozen in place.

For comparison, the Sun at `gravityMass: 50_000` creates meaningful orbital velocities at 105,000px:

```
sqrt(250 * 50000 * 0.5 / 105000) ≈ 7.7 px/s
```

Even the Sun is slow. But the real issue is that Earth's gravity is 100x weaker than the Sun's, so anything near Earth is primarily influenced by the Sun — Earth can't hold onto its debris.

## The Fix

Planet gravity masses need to be high enough that:
1. Debris orbiting a planet moves at a visible speed (at least 30-50 px/s)
2. The planet's gravity dominates over the Sun's at the debris altitude

For visible orbits at ~40px/s at 4,000px from Earth:
```
40 = sqrt(250 * mass * 0.5 / 4000)
1600 = 250 * mass * 0.5 / 4000
mass = 1600 * 4000 / (250 * 0.5) = 51,200
```

So Earth needs `gravityMass` around **50,000** — comparable to the Sun. This is arcade physics, not realistic — the goal is that each planet feels like a meaningful gravity well.

---

### Task 1: Increase Planet Gravity Masses

**Files:**
- Modify: `src/data/bodies.ts`

- [ ] **Step 1: Update all gravity masses**

In `src/data/bodies.ts`, update the `gravityMass` field for each body. Scale them so inner planets have enough gravity for visible debris orbits, and outer gas giants are proportionally stronger:

```typescript
// Sun — remains dominant
{ name: "Sun", gravityMass: 500_000, ... }      // was 50_000

// Inner rocky planets — strong enough for local debris orbits
{ name: "Mercury", gravityMass: 20_000, ... }    // was 800
{ name: "Venus", gravityMass: 40_000, ... }      // was 2_000
{ name: "Earth", gravityMass: 50_000, ... }      // was 500
{ name: "Mars", gravityMass: 30_000, ... }       // was 1_200

// Gas giants — massive gravity wells
{ name: "Jupiter", gravityMass: 200_000, ... }   // was 20_000
{ name: "Saturn", gravityMass: 150_000, ... }    // was 16_000
{ name: "Uranus", gravityMass: 80_000, ... }     // was 10_000
{ name: "Neptune", gravityMass: 70_000, ... }    // was 9_000
```

Only change `gravityMass`. Leave all other fields (health, massYield, energyYield, visual, etc.) unchanged.

- [ ] **Step 2: Verify the orbital speeds make sense**

Earth at gravityMass 50,000, debris at 4,000px altitude (dist = 3,000 + 4,000 = 7,000 from center):

```
orbitalSpeed = sqrt(250 * 50_000 * 0.5 / 7000) = sqrt(892) ≈ 30 px/s
```

30px/s — a full orbit of Earth (circumference ~44,000px) takes ~24 minutes. Visible movement, not frantic. At closer altitude (3,500px from center): ~34px/s.

Mercury at gravityMass 20,000, debris at 600px (dist = 400 + 600 = 1,000):

```
sqrt(250 * 20_000 * 0.5 / 1000) = sqrt(2500) = 50 px/s
```

Good — faster orbits on smaller planets.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
If any test hardcodes gravity mass values (e.g., GravitySystem tests), they use their own test bodies and won't be affected. The bodies.test.ts just checks `> 0`.

- [ ] **Step 4: Commit**

```bash
git add src/data/bodies.ts
git commit -m "fix: planet gravity masses increased 100x — debris visibly orbits"
```

---

### Task 2: Increase Sun Gravity Mass to Stay Dominant

**Problem:** If Earth is now 50,000 and the Sun stays at 50,000, the Sun can't hold the solar system together — planets would fly off their orbits or behave erratically when passing each other.

The Sun's mass was already increased to 500,000 in Task 1. Verify that planet orbital velocities are still reasonable at their distances.

**Files:** None — verification only.

- [ ] **Step 1: Check planet orbit speeds**

Earth at 105,000px from Sun with Sun mass 500,000:

```
orbitalSpeed = sqrt(250 * 500_000 * 0.5 / 105_000) = sqrt(595) ≈ 24 px/s
```

24 px/s at 105k radius = circumference ~660k px. Full orbit takes ~27,500 seconds ≈ 7.6 hours. Very slow but visible over minutes of play — planets drift.

Mercury at 75,000px:

```
sqrt(250 * 500_000 * 0.5 / 75_000) = sqrt(833) ≈ 29 px/s
```

These are reasonable — planets move visibly but slowly. The orbit speed formula (`computeOrbitSpeed` in OrbitSystem.ts) uses angular speed from `distance^1.5`, which is independent of gravityMass — so changing masses doesn't affect prescribed orbital paths. The masses only matter for N-body gravity effects on the player and debris.

- [ ] **Step 2: Run the game and verify**

Run: `pnpm dev`

Check:
- [ ] Debris around Earth visibly drifts in curved paths (not stationary)
- [ ] Player can orbit Earth — releasing thrust results in a visible curve, not a straight line
- [ ] Planets don't fly apart or crash into each other
- [ ] Approaching Jupiter feels like entering a much stronger gravity well than Earth

- [ ] **Step 3: Commit any tuning**

```bash
git add -A
git commit -m "chore: verify gravity mass tuning"
```
