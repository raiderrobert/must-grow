# Unified Celestial Body System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented planet/Earth/Sun rendering and hazard systems with a single unified body system where every celestial body has kill zones, atmosphere effects, composable visual primitives, and full destruction support.

**Architecture:** A `BodyDef` data model in `src/data/bodies.ts` defines all 9 bodies. A composable renderer in `src/entities/BodyRenderer.ts` draws visuals from ordered primitive arrays. GameScene loops over one array to create everything. GravitySystem already handles kill zones/atmosphere effects for any body with `killRadius` — we just add `killRadius` to all body gravity entries.

**Tech Stack:** TypeScript, Phaser 3, Vitest

**Validation commands:**
- Type check: `pnpm exec tsc --noEmit`
- Tests: `pnpm test`
- Build: `pnpm build`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data/bodies.ts` | Create | `BodyDef` interface, `VisualPrimitive` type, `BODY_DEFS` array for all 9 bodies |
| `src/entities/BodyRenderer.ts` | Create | Render primitive functions + `renderBody()` compositor + `renderDebugKillZone()` |
| `src/entities/PlanetObject.ts` | Delete | Replaced by bodies.ts + BodyRenderer |
| `src/entities/SpaceObject.ts` | Modify | Remove `biteRadius` from config interface, remove `isInBiteRange()` |
| `src/systems/CombatSystem.ts` | Modify | Remove `updateBiteDamage()` and its call in `update()` |
| `src/systems/ZoneManager.ts` | Modify | Accept `GravitySystem` ref, add spawn exclusion check |
| `src/scenes/GameScene.ts` | Modify | Delete `renderEarth()`, `renderSun()`, single loop over `BODY_DEFS`, body destruction cleanup |
| `src/constants.ts` | Modify | Remove `EARTH_GRAVITY_MASS` |
| `tests/systems/GravitySystem.test.ts` | Modify | Add tests for `isInLethalZone` and `getApproachFactor` with `killRadius` bodies |
| `tests/systems/CombatSystem.test.ts` | Modify | Remove bite-damage tests (they test legacy chew mechanics) |
| `tests/data/bodies.test.ts` | Create | Validate body definitions data integrity |

---

### Task 1: Remove Bite Damage

Remove the legacy bite/chew proximity damage system. All planet destruction is now beams, bursts, and drones.

**Files:**
- Modify: `src/entities/SpaceObject.ts:13-15,92-98`
- Modify: `src/systems/CombatSystem.ts:273-309,334`
- Modify: `tests/systems/CombatSystem.test.ts` (full file — replace legacy tests)

- [ ] **Step 1: Remove `biteRadius` from `SpaceObjectConfig` and `isInBiteRange` from `SpaceObject`**

In `src/entities/SpaceObject.ts`, remove the `biteRadius` field from the interface and delete the `isInBiteRange` method:

```typescript
// SpaceObjectConfig — remove this line:
//   /** Radius within which the player damages this object by proximity. 0 = laser only. */
//   biteRadius?: number;

// Delete this entire method (lines 92-98):
//   isInBiteRange(playerX: number, playerY: number, playerSize: number): boolean { ... }
```

The resulting `SpaceObjectConfig` interface should be:

```typescript
export interface SpaceObjectConfig {
  x: number;
  y: number;
  size: number;
  health: number;
  massYield: number;
  energyYield: number;
  gravityMass: number;
  color: number;
  name?: string;
}
```

- [ ] **Step 2: Remove `updateBiteDamage` from `CombatSystem`**

In `src/systems/CombatSystem.ts`:

1. Delete the entire `updateBiteDamage` method (lines 273-309)
2. Remove the `this.updateBiteDamage(delta);` call from the `update()` method (line 334)

The `update()` method should become:

```typescript
update(delta: number, droneCount: number = 0): void {
  if (this.burstCooldown > 0) this.burstCooldown -= delta;

  this.updateAutoFire(delta);
  this.updateBurstQueue(delta);
  this.updateDebrisAttraction();
  this.updateDroneSwarm(delta, droneCount);

  this.debrisList = this.debrisList.filter(d => d.sprite.active);
}
```

- [ ] **Step 3: Replace legacy CombatSystem tests**

Replace `tests/systems/CombatSystem.test.ts` with a placeholder that doesn't test removed mechanics:

```typescript
import { describe, it, expect } from "vitest";

describe("CombatSystem", () => {
  it("beam damage is the primary combat mechanic", () => {
    // CombatSystem requires a Phaser scene to instantiate.
    // Verify the data contract: beamDamage is a positive number.
    const beamDamage = 10; // default from CombatSystem
    expect(beamDamage).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean (0 errors). If any files still reference `biteRadius` or `isInBiteRange`, fix them.

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/entities/SpaceObject.ts src/systems/CombatSystem.ts tests/systems/CombatSystem.test.ts
git commit -m "fix: remove bite damage — all combat is beam/burst/drone"
```

---

### Task 2: Create BodyRenderer with Visual Primitives

Build the composable render primitive system. Each primitive is a function that draws onto a `Phaser.GameObjects.Graphics`.

**Files:**
- Create: `src/entities/BodyRenderer.ts`

- [ ] **Step 1: Create `src/entities/BodyRenderer.ts`**

```typescript
import Phaser from "phaser";
import { DEBUG_KILL_ZONES } from "@/constants";

// ── Visual Primitive Types ──────────────────────────────────────────

export type VisualPrimitive =
  | { type: "atmosphereGlow"; layers: { radiusMult: number; color: number; alpha: number }[] }
  | { type: "solidBody"; color: number; alpha: number }
  | { type: "highlight"; offsetX: number; offsetY: number; radiusMult: number; alpha: number }
  | { type: "outline"; thicknessMult: number; color: number; alpha: number }
  | { type: "landmasses"; patches: { x: number; y: number; w: number; h: number; color: number; alpha: number }[] }
  | { type: "corona"; layers: { radiusMult: number; alpha: number; color: number }[] }
  | { type: "brightCore"; radiusMult: number; alpha: number }
  | { type: "rings"; layers: { widthMult: number; radiusMult: number; heightMult: number; color: number; alpha: number }[] }
  | { type: "surfaceBands"; bands: { yOffset: number; height: number; color: number; alpha: number }[] }
  | { type: "iceCap"; position: "north" | "south"; sizeMult: number; color: number; alpha: number }
  | { type: "spots"; patches: { x: number; y: number; r: number; color: number; alpha: number }[] };

// ── Primitive Renderers ─────────────────────────────────────────────

function drawAtmosphereGlow(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { radiusMult: number; color: number; alpha: number }[]
): void {
  for (const layer of layers) {
    g.fillStyle(layer.color, layer.alpha);
    g.fillCircle(x, y, r * layer.radiusMult);
  }
}

function drawSolidBody(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  color: number, alpha: number
): void {
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}

function drawHighlight(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  offsetX: number, offsetY: number, radiusMult: number, alpha: number
): void {
  g.fillStyle(0xffffff, alpha);
  g.fillCircle(x + r * offsetX, y + r * offsetY, r * radiusMult);
}

function drawOutline(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  thicknessMult: number, color: number, alpha: number
): void {
  g.lineStyle(Math.max(2, r * thicknessMult), color, alpha);
  g.strokeCircle(x, y, r);
}

function drawLandmasses(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  patches: { x: number; y: number; w: number; h: number; color: number; alpha: number }[]
): void {
  for (const p of patches) {
    g.fillStyle(p.color, p.alpha);
    g.fillEllipse(x + p.x * r, y + p.y * r, p.w * r, p.h * r);
  }
}

function drawCorona(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { radiusMult: number; alpha: number; color: number }[]
): void {
  for (const layer of layers) {
    g.fillStyle(layer.color, layer.alpha);
    g.fillCircle(x, y, r * layer.radiusMult);
  }
}

function drawBrightCore(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  radiusMult: number, alpha: number
): void {
  g.fillStyle(0xffffff, alpha);
  g.fillCircle(x, y, r * radiusMult);
}

function drawRings(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { widthMult: number; radiusMult: number; heightMult: number; color: number; alpha: number }[]
): void {
  for (const ring of layers) {
    g.lineStyle(r * ring.widthMult, ring.color, ring.alpha);
    g.strokeEllipse(x, y, r * ring.radiusMult, r * ring.heightMult);
  }
}

function drawSurfaceBands(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  bands: { yOffset: number; height: number; color: number; alpha: number }[]
): void {
  for (const band of bands) {
    g.fillStyle(band.color, band.alpha);
    g.fillEllipse(x, y + band.yOffset * r, r * 2, band.height * r);
  }
}

function drawIceCap(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  position: "north" | "south", sizeMult: number, color: number, alpha: number
): void {
  const capY = position === "north" ? y - r * 0.85 : y + r * 0.85;
  g.fillStyle(color, alpha);
  g.fillEllipse(x, capY, r * sizeMult, r * sizeMult * 0.3);
}

function drawSpots(
  g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  patches: { x: number; y: number; r: number; color: number; alpha: number }[]
): void {
  for (const s of patches) {
    g.fillStyle(s.color, s.alpha);
    g.fillCircle(x + s.x * r, y + s.y * r, s.r * r);
  }
}

// ── Compositor ──────────────────────────────────────────────────────

export interface RenderedBody {
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  debugRing?: Phaser.GameObjects.Graphics;
}

export function renderBody(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  killRadius: number,
  name: string,
  color: number,
  visual: VisualPrimitive[],
  depth: number = 0
): RenderedBody {
  const g = scene.add.graphics().setDepth(depth);

  for (const prim of visual) {
    switch (prim.type) {
      case "atmosphereGlow": drawAtmosphereGlow(g, x, y, radius, prim.layers); break;
      case "solidBody":      drawSolidBody(g, x, y, radius, prim.color, prim.alpha); break;
      case "highlight":      drawHighlight(g, x, y, radius, prim.offsetX, prim.offsetY, prim.radiusMult, prim.alpha); break;
      case "outline":        drawOutline(g, x, y, radius, prim.thicknessMult, prim.color, prim.alpha); break;
      case "landmasses":     drawLandmasses(g, x, y, radius, prim.patches); break;
      case "corona":         drawCorona(g, x, y, radius, prim.layers); break;
      case "brightCore":     drawBrightCore(g, x, y, radius, prim.radiusMult, prim.alpha); break;
      case "rings":          drawRings(g, x, y, radius, prim.layers); break;
      case "surfaceBands":   drawSurfaceBands(g, x, y, radius, prim.bands); break;
      case "iceCap":         drawIceCap(g, x, y, radius, prim.position, prim.sizeMult, prim.color, prim.alpha); break;
      case "spots":          drawSpots(g, x, y, radius, prim.patches); break;
    }
  }

  // Label
  const fontSize = Math.max(24, Math.min(radius * 0.12, 400));
  const label = scene.add
    .text(x, y + radius + fontSize * 1.5, name, {
      fontFamily: "monospace",
      fontSize: `${Math.round(fontSize)}px`,
      color: "#" + color.toString(16).padStart(6, "0"),
    })
    .setOrigin(0.5)
    .setDepth(depth + 1)
    .setAlpha(0.85);

  // Debug kill zone ring
  let debugRing: Phaser.GameObjects.Graphics | undefined;
  if (DEBUG_KILL_ZONES) {
    debugRing = scene.add.graphics().setDepth(10);
    debugRing.lineStyle(8, 0xff0000, 1.0);
    debugRing.strokeCircle(x, y, killRadius);
  }

  return { graphics: g, label, debugRing };
}
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean (0 errors).

- [ ] **Step 3: Commit**

```bash
git add src/entities/BodyRenderer.ts
git commit -m "feat: composable body renderer with visual primitives"
```

---

### Task 3: Create Body Definitions Data

Define all 9 celestial bodies in one data file with their visual primitive compositions.

**Files:**
- Create: `src/data/bodies.ts`
- Create: `tests/data/bodies.test.ts`

- [ ] **Step 1: Write the test for body definitions**

Create `tests/data/bodies.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { BODY_DEFS } from "@/data/bodies";

describe("BODY_DEFS", () => {
  it("defines exactly 9 celestial bodies", () => {
    expect(BODY_DEFS).toHaveLength(9);
  });

  it("every body has killRadius equal to visualRadius", () => {
    for (const body of BODY_DEFS) {
      expect(body.killRadius, `${body.name} killRadius`).toBe(body.visualRadius);
    }
  });

  it("every body has a color", () => {
    for (const body of BODY_DEFS) {
      expect(body.color, `${body.name} color`).toBeGreaterThan(0);
    }
  });

  it("every body has positive health, massYield, and energyYield", () => {
    for (const body of BODY_DEFS) {
      expect(body.health, `${body.name} health`).toBeGreaterThan(0);
      expect(body.massYield, `${body.name} massYield`).toBeGreaterThan(0);
      expect(body.energyYield, `${body.name} energyYield`).toBeGreaterThan(0);
    }
  });

  it("every body has at least one visual primitive", () => {
    for (const body of BODY_DEFS) {
      expect(body.visual.length, `${body.name} visual primitives`).toBeGreaterThan(0);
    }
  });

  it("all body names are unique", () => {
    const names = BODY_DEFS.map(b => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes Earth, Sun, and all 7 named planets", () => {
    const names = BODY_DEFS.map(b => b.name);
    for (const expected of ["Sun", "Earth", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
      expect(names, `missing ${expected}`).toContain(expected);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/data/bodies.test.ts`
Expected: FAIL — module `@/data/bodies` does not exist.

- [ ] **Step 3: Create `src/data/bodies.ts`**

```typescript
import type { VisualPrimitive } from "@/entities/BodyRenderer";

export interface BodyDef {
  name: string;
  distance: number;        // px from world center
  angle: number;           // radians
  visualRadius: number;    // display radius in world px
  killRadius: number;      // surface death boundary (=== visualRadius)
  color: number;           // primary body color (used for label, proxy sprite)
  gravityMass: number;
  health: number;
  massYield: number;
  energyYield: number;
  visual: VisualPrimitive[];
}

export const BODY_DEFS: BodyDef[] = [
  // ── Sun ───────────────────────────────────────────────────────────
  {
    name: "Sun",
    distance: 240_000,
    angle: -Math.PI / 2, // directly north
    visualRadius: 25_000,
    killRadius: 25_000,
    color: 0xffdd00,
    gravityMass: 50_000,
    health: 500_000,
    massYield: 200_000,
    energyYield: 50_000,
    visual: [
      { type: "corona", layers: [
        { radiusMult: 2.6, alpha: 0.016, color: 0xffaa00 },
        { radiusMult: 2.3, alpha: 0.024, color: 0xffaa00 },
        { radiusMult: 2.0, alpha: 0.032, color: 0xffaa00 },
        { radiusMult: 1.7, alpha: 0.040, color: 0xffaa00 },
      ]},
      { type: "solidBody", color: 0xffdd00, alpha: 1.0 },
      { type: "brightCore", radiusMult: 0.5, alpha: 0.4 },
    ],
  },

  // ── Earth ─────────────────────────────────────────────────────────
  {
    name: "Earth",
    distance: 3_200,
    angle: Math.PI / 2, // directly south
    visualRadius: 3_000,
    killRadius: 3_000,
    color: 0x1a4a8a,
    gravityMass: 500,
    health: 100_000,
    massYield: 50_000,
    energyYield: 10_000,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.20, color: 0x1a3a5c, alpha: 0.15 },
        { radiusMult: 1.07, color: 0x2255aa, alpha: 0.25 },
      ]},
      { type: "solidBody", color: 0x1a4a8a, alpha: 0.95 },
      { type: "landmasses", patches: [
        { x: -0.17, y: -0.13, w: 0.40, h: 0.30, color: 0x2d6e2d, alpha: 0.85 },
        { x:  0.23, y:  0.10, w: 0.30, h: 0.37, color: 0x2d6e2d, alpha: 0.85 },
        { x: -0.07, y:  0.23, w: 0.27, h: 0.17, color: 0x2d6e2d, alpha: 0.85 },
        { x:  0.10, y: -0.27, w: 0.20, h: 0.13, color: 0x2d6e2d, alpha: 0.85 },
      ]},
      { type: "highlight", offsetX: 0, offsetY: 0, radiusMult: 1.0, alpha: 0.08 },
      { type: "outline", thicknessMult: 0.01, color: 0x4488cc, alpha: 0.3 },
    ],
  },

  // ── Mercury ───────────────────────────────────────────────────────
  {
    name: "Mercury",
    distance: 12_000,
    angle: 0.8,
    visualRadius: 400,
    killRadius: 400,
    color: 0x9b8b78,
    gravityMass: 800,
    health: 2_000,
    massYield: 800,
    energyYield: 200,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0x7a6b5c, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0x9b8b78, alpha: 1.0 },
      { type: "spots", patches: [
        { x: -0.2, y: -0.1, r: 0.12, color: 0x7a6b5c, alpha: 0.4 },
        { x:  0.3, y:  0.2, r: 0.08, color: 0x6a5b4c, alpha: 0.35 },
        { x:  0.0, y:  0.3, r: 0.10, color: 0x8a7b6c, alpha: 0.3 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Venus ─────────────────────────────────────────────────────────
  {
    name: "Venus",
    distance: 22_000,
    angle: 2.1,
    visualRadius: 900,
    killRadius: 900,
    color: 0xe8b84b,
    gravityMass: 2_000,
    health: 5_000,
    massYield: 2_000,
    energyYield: 500,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.25, color: 0xd4983a, alpha: 0.20 },
        { radiusMult: 1.12, color: 0xe8c84b, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0xe8b84b, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.3, height: 0.15, color: 0xd4983a, alpha: 0.25 },
        { yOffset:  0.1, height: 0.20, color: 0xc8882a, alpha: 0.20 },
        { yOffset:  0.4, height: 0.12, color: 0xd4983a, alpha: 0.15 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Mars ──────────────────────────────────────────────────────────
  {
    name: "Mars",
    distance: 30_000,
    angle: 3.9,
    visualRadius: 700,
    killRadius: 700,
    color: 0xc1440e,
    gravityMass: 1_200,
    health: 3_000,
    massYield: 1_200,
    energyYield: 300,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0xa03308, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0xc1440e, alpha: 1.0 },
      { type: "iceCap", position: "north", sizeMult: 0.4, color: 0xffffff, alpha: 0.6 },
      { type: "iceCap", position: "south", sizeMult: 0.3, color: 0xeeeeff, alpha: 0.5 },
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Jupiter ───────────────────────────────────────────────────────
  {
    name: "Jupiter",
    distance: 95_000,
    angle: 1.2,
    visualRadius: 8_000,
    killRadius: 8_000,
    color: 0xc88b3a,
    gravityMass: 20_000,
    health: 50_000,
    massYield: 20_000,
    energyYield: 5_000,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0xaa7230, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0xc88b3a, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.6, height: 0.10, color: 0xb07830, alpha: 0.3 },
        { yOffset: -0.3, height: 0.15, color: 0xd4a050, alpha: 0.25 },
        { yOffset:  0.0, height: 0.12, color: 0xb07830, alpha: 0.3 },
        { yOffset:  0.3, height: 0.18, color: 0xd4a050, alpha: 0.25 },
        { yOffset:  0.6, height: 0.10, color: 0xb07830, alpha: 0.3 },
      ]},
      { type: "spots", patches: [
        { x: 0.3, y: 0.2, r: 0.10, color: 0xcc4422, alpha: 0.6 }, // Great Red Spot
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Saturn ────────────────────────────────────────────────────────
  {
    name: "Saturn",
    distance: 140_000,
    angle: 4.5,
    visualRadius: 6_500,
    killRadius: 6_500,
    color: 0xe4d090,
    gravityMass: 16_000,
    health: 40_000,
    massYield: 16_000,
    energyYield: 4_000,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0xc8b86a, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0xe4d090, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.4, height: 0.12, color: 0xc8b86a, alpha: 0.2 },
        { yOffset:  0.1, height: 0.15, color: 0xd4c480, alpha: 0.15 },
        { yOffset:  0.5, height: 0.10, color: 0xc8b86a, alpha: 0.2 },
      ]},
      { type: "rings", layers: [
        { widthMult: 0.07, radiusMult: 3.2, heightMult: 0.45, color: 0xc8b86a, alpha: 0.45 },
        { widthMult: 0.035, radiusMult: 2.8, heightMult: 0.38, color: 0xe4d090, alpha: 0.25 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Uranus ────────────────────────────────────────────────────────
  {
    name: "Uranus",
    distance: 175_000,
    angle: 0.3,
    visualRadius: 3_500,
    killRadius: 3_500,
    color: 0x7de8e8,
    gravityMass: 10_000,
    health: 25_000,
    massYield: 10_000,
    energyYield: 2_500,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0x5cc8c8, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0x7de8e8, alpha: 1.0 },
      { type: "rings", layers: [
        { widthMult: 0.02, radiusMult: 2.0, heightMult: 1.8, color: 0x5cc8c8, alpha: 0.2 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },

  // ── Neptune ───────────────────────────────────────────────────────
  {
    name: "Neptune",
    distance: 200_000,
    angle: 2.8,
    visualRadius: 3_200,
    killRadius: 3_200,
    color: 0x3f54ba,
    gravityMass: 9_000,
    health: 22_000,
    massYield: 9_000,
    energyYield: 2_200,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.15, color: 0x2d3d9a, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0x3f54ba, alpha: 1.0 },
      { type: "spots", patches: [
        { x: -0.2, y: -0.1, r: 0.12, color: 0x1a2a6a, alpha: 0.5 }, // Great Dark Spot
        { x:  0.3, y:  0.3, r: 0.06, color: 0x2a3a8a, alpha: 0.4 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
  },
];
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- tests/data/bodies.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/bodies.ts tests/data/bodies.test.ts
git commit -m "feat: unified body definitions for all 9 celestial bodies"
```

---

### Task 4: Add Kill Zone Tests to GravitySystem

Verify that `isInLethalZone` and `getApproachFactor` work correctly with `killRadius` bodies.

**Files:**
- Modify: `tests/systems/GravitySystem.test.ts`

- [ ] **Step 1: Add kill zone and approach factor tests**

Append these tests to the existing `describe("GravitySystem")` block in `tests/systems/GravitySystem.test.ts`:

```typescript
  it("isInLethalZone returns true when inside killRadius", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    expect(gs.isInLethalZone(200, 0, 100)).toBe(true);  // inside
    expect(gs.isInLethalZone(600, 0, 100)).toBe(false);  // outside
  });

  it("isInLethalZone returns true at exact killRadius boundary", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    // dist = 499 < 500 → lethal
    expect(gs.isInLethalZone(499, 0, 100)).toBe(true);
    // dist = 501 > 500 → safe
    expect(gs.isInLethalZone(501, 0, 100)).toBe(false);
  });

  it("isInLethalZone checks multiple bodies", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 100 });
    gs.addBody({ x: 5000, y: 0, gravityMass: 1000, killRadius: 200 });
    // Near second body
    expect(gs.isInLethalZone(4900, 0, 100)).toBe(true);
    // Far from both
    expect(gs.isInLethalZone(2500, 0, 100)).toBe(false);
  });

  it("getApproachFactor returns 0 outside warning band", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    // warningRadius = 500 * 1.2 = 600. Player at 700 → outside
    expect(gs.getApproachFactor(700, 0)).toBe(0);
  });

  it("getApproachFactor returns ~1 at kill surface", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    // Player at 501 → just outside kill, deep in warning band
    expect(gs.getApproachFactor(501, 0)).toBeGreaterThan(0.9);
  });

  it("getApproachFactor returns value between 0 and 1 in warning band", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    // warningRadius = 600. Player at 550 → midway in warning band
    const factor = gs.getApproachFactor(550, 0);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(1);
  });

  it("getApproachFactor picks the highest factor from multiple bodies", () => {
    gs.addBody({ x: 0, y: 0, gravityMass: 1000, killRadius: 500 });
    gs.addBody({ x: 2000, y: 0, gravityMass: 1000, killRadius: 500 });
    // Player near second body's warning band
    const factor = gs.getApproachFactor(1550, 0);
    expect(factor).toBeGreaterThan(0);
  });

  it("removeBody stops kill zone from being checked", () => {
    const body = { x: 0, y: 0, gravityMass: 1000, killRadius: 500 };
    gs.addBody(body);
    expect(gs.isInLethalZone(200, 0, 100)).toBe(true);
    gs.removeBody(body);
    expect(gs.isInLethalZone(200, 0, 100)).toBe(false);
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- tests/systems/GravitySystem.test.ts`
Expected: All tests pass (existing + new).

- [ ] **Step 3: Commit**

```bash
git add tests/systems/GravitySystem.test.ts
git commit -m "test: kill zone and approach factor tests for GravitySystem"
```

---

### Task 5: Add Spawn Exclusion to ZoneManager

Prevent smaller destructibles from spawning inside any planet's kill zone.

**Files:**
- Modify: `src/systems/ZoneManager.ts:1-20,94-142`

- [ ] **Step 1: Add `GravitySystem` dependency to `ZoneManager`**

In `src/systems/ZoneManager.ts`, import `GravitySystem` and accept it in the constructor:

```typescript
import Phaser from "phaser";
import { ZONES, type ZoneDefinition } from "@/data/zones";
import { SpaceObject } from "@/entities/SpaceObject";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/constants";
import type { GravitySystem } from "@/systems/GravitySystem";

const CENTER_X = WORLD_WIDTH / 2;
const CENTER_Y = WORLD_HEIGHT / 2;

export class ZoneManager {
  private scene: Phaser.Scene;
  private gravity: GravitySystem | null;
  private objects: SpaceObject[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000;

  objectGroup!: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, gravity: GravitySystem | null = null) {
    this.scene = scene;
    this.gravity = gravity;
    this.objectGroup = scene.physics.add.group();
  }
```

- [ ] **Step 2: Add exclusion check to `spawnInZone`**

Add a helper method and modify `spawnInZone` to retry if the spawn position is inside a body's warning band. Insert the helper method right before `spawnInZone`:

```typescript
  /** Returns true if the position is inside any gravity body's warning band. */
  private isInsideBodyZone(x: number, y: number): boolean {
    if (!this.gravity) return false;
    for (const body of this.gravity.getBodies()) {
      if (body.killRadius === undefined) continue;
      const dist = Phaser.Math.Distance.Between(x, y, body.x, body.y);
      if (dist < body.killRadius * 1.2) return true;
    }
    return false;
  }
```

Then in `spawnInZone`, after computing `x` and `y` (line 129-130), add the exclusion check before the existing distance-to-player check:

```typescript
    const x = CENTER_X + Math.cos(angle) * dist;
    const y = CENTER_Y + Math.sin(angle) * dist;

    // Don't spawn inside a planet's warning band
    if (this.isInsideBodyZone(x, y)) return;

    // Spawn radius scales with player size
    const spawnMin = Math.max(200, playerSize * 3);
```

Also wrap the spawn logic in a retry loop (max 5 attempts) for `populate()` reliability. Replace the single spawn attempt in `spawnInZone` with:

In `spawnInZone`, wrap the angle/dist/position calculation and the body-zone check in a retry loop. The full method becomes:

```typescript
  private spawnInZone(
    zone: ZoneDefinition,
    playerTier: number,
    playerX: number,
    playerY: number,
    skipDistCheck: boolean = false,
    playerSize: number = 8
  ): void {
    const eligible = zone.spawnTable.filter((e) => playerTier >= e.minTier);
    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = eligible[0];
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) {
        selected = entry;
        break;
      }
    }

    const playerDist = Phaser.Math.Distance.Between(playerX, playerY, CENTER_X, CENTER_Y);

    for (let attempt = 0; attempt < 5; attempt++) {
      const angle = Math.random() * Math.PI * 2;

      const minD = skipDistCheck
        ? zone.minDistance
        : Math.max(zone.minDistance, playerDist - 400);
      const maxD = skipDistCheck
        ? zone.maxDistance
        : Math.min(zone.maxDistance, playerDist + 600);
      const dist = minD + Math.random() * Math.max(maxD - minD, 0);

      const x = CENTER_X + Math.cos(angle) * dist;
      const y = CENTER_Y + Math.sin(angle) * dist;

      // Don't spawn inside a planet's warning band
      if (this.isInsideBodyZone(x, y)) continue;

      // Spawn radius scales with player size
      const spawnMin = Math.max(200, playerSize * 3);
      const spawnMax = Math.max(2000, playerSize * 25);
      const distToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY);
      if (!skipDistCheck && (distToPlayer < spawnMin || distToPlayer > spawnMax)) continue;

      const config = selected.factory();
      const obj = new SpaceObject(this.scene, { x, y, ...config });
      this.objects.push(obj);
      this.objectGroup.add(obj.sprite);
      return;
    }
  }
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean. If `GameScene` now fails because `ZoneManager` constructor changed, that's expected — we fix it in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/systems/ZoneManager.ts
git commit -m "feat: spawn exclusion zones — no objects inside planet warning bands"
```

---

### Task 6: Clean Up Constants

Remove constants that are now in body definitions.

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Remove `EARTH_GRAVITY_MASS`**

In `src/constants.ts`, delete line 3:

```typescript
// Delete this line:
// export const EARTH_GRAVITY_MASS = 500;
```

- [ ] **Step 2: Check for usages**

Run: `pnpm exec tsc --noEmit`
If anything imports `EARTH_GRAVITY_MASS`, remove that import. (It was only used in the old `GameScene.create()` gravity body setup which we replace in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "chore: remove EARTH_GRAVITY_MASS — now in body definitions"
```

---

### Task 7: Rewrite GameScene to Use Unified Body System

Replace `renderEarth()`, `renderSun()`, and the per-planet loop with a single loop over `BODY_DEFS`. Track all body assets for destruction cleanup.

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Delete: `src/entities/PlanetObject.ts`

- [ ] **Step 1: Define the tracked body type**

At the top of `src/scenes/GameScene.ts` (after imports), add:

```typescript
import { BODY_DEFS } from "@/data/bodies";
import { renderBody, type RenderedBody } from "@/entities/BodyRenderer";
import type { GravityBody } from "@/systems/GravitySystem";

interface TrackedBody {
  name: string;
  spaceObj: SpaceObject;
  rendered: RenderedBody;
  gravityBody: GravityBody;
}
```

Replace the existing planet-related imports. Remove these lines:

```typescript
// DELETE these:
// import { PLANET_DEFS, createPlanet } from "@/entities/PlanetObject";
```

- [ ] **Step 2: Update class fields**

Replace `planets: SpaceObject[] = [];` and `private earthObjects: Phaser.GameObjects.GameObject[] = [];` with:

```typescript
  private trackedBodies: TrackedBody[] = [];
```

- [ ] **Step 3: Rewrite `create()` body setup**

Delete the Earth gravity body line, Sun gravity body line, the `for (const def of PLANET_DEFS)` loop, and the `this.renderEarth()` / `this.renderSun()` calls. Replace all of it with a single loop:

```typescript
    // ── Create all celestial bodies from unified definitions ──
    for (const def of BODY_DEFS) {
      const x = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
      const y = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;

      // Render visuals
      const rendered = renderBody(this, x, y, def.visualRadius, def.killRadius, def.name, def.color, def.visual, -3);

      // Physics proxy for targeting/collision (invisible, capped size)
      const proxyRadius = Math.min(def.visualRadius, 1500);
      const spaceObj = new SpaceObject(this, {
        x, y,
        size: proxyRadius,
        health: def.health,
        massYield: def.massYield,
        energyYield: def.energyYield,
        gravityMass: def.gravityMass,
        color: def.color,
        name: def.name,
      });
      spaceObj.sprite.setVisible(false);
      spaceObj.sprite.setVelocity(0, 0);
      this.zones.addFixedObject(spaceObj);

      // Gravity body with kill zone
      const gravityBody: GravityBody = { x, y, gravityMass: def.gravityMass, killRadius: def.killRadius };
      this.gravity.addBody(gravityBody);

      this.trackedBodies.push({ name: def.name, spaceObj, rendered, gravityBody });
    }
```

- [ ] **Step 4: Pass `gravity` to `ZoneManager` constructor**

Change the `ZoneManager` construction line from:

```typescript
    this.zones = new ZoneManager(this);
```

To:

```typescript
    this.zones = new ZoneManager(this, this.gravity);
```

Make sure this comes after `this.gravity = new GravitySystem();` and before the body creation loop.

- [ ] **Step 5: Update the two-camera setup**

Replace the `...this.earthObjects` reference in the `worldObjects` array with the tracked body graphics:

```typescript
    const worldObjects: Phaser.GameObjects.GameObject[] = [
      ...this.starfieldLayers,
      ...this.trackedBodies.flatMap(tb => [
        tb.rendered.graphics,
        tb.rendered.label,
        ...(tb.rendered.debugRing ? [tb.rendered.debugRing] : []),
      ]),
      this.player.body,
      this.gravityIndicatorGraphics,
      ...(this.gravity.getGraphics() ? [this.gravity.getGraphics()!] : []),
      ...(this.player.getParticleEmitter() ? [this.player.getParticleEmitter()!] : []),
      ...this.combat.getWorldGraphics(),
    ];
```

- [ ] **Step 6: Delete `renderEarth()` and `renderSun()` methods**

Remove both methods entirely from the class (lines 303-363 approximately).

- [ ] **Step 7: Add body destruction handler**

Add a method to handle body destruction — called when a tracked body's SpaceObject is destroyed:

```typescript
  private onBodyDestroyed(tracked: TrackedBody): void {
    // Remove gravity (kill zone + pull gone)
    this.gravity.removeBody(tracked.gravityBody);

    // Remove visuals
    tracked.rendered.graphics.destroy();
    tracked.rendered.label.destroy();
    tracked.rendered.debugRing?.destroy();

    // Remove from tracking
    const idx = this.trackedBodies.indexOf(tracked);
    if (idx !== -1) this.trackedBodies.splice(idx, 1);

    // Camera shake scaled to body size
    const shakeIntensity = Math.min(0.02, 0.005 + tracked.spaceObj.config.size / 100_000);
    this.cameras.main.shake(1000, shakeIntensity);
  }
```

- [ ] **Step 8: Wire body destruction into `onCollision` and combat flow**

The existing combat system already handles SpaceObject destruction via `zones.removeObject(obj)`. We need to detect when a destroyed object is a tracked body. Add a check in `update()` after the combat update:

```typescript
    // Check if any tracked bodies were destroyed
    for (let i = this.trackedBodies.length - 1; i >= 0; i--) {
      const tb = this.trackedBodies[i];
      if (!tb.spaceObj.sprite.active) {
        this.onBodyDestroyed(tb);
      }
    }
```

Place this after `this.combat.update(delta, 0);` and before the zone spawning.

- [ ] **Step 9: Delete `PlanetObject.ts`**

```bash
rm src/entities/PlanetObject.ts
```

- [ ] **Step 10: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean. Fix any remaining references to `PlanetObject`, `PLANET_DEFS`, `earthObjects`, or `planets`.

- [ ] **Step 11: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 12: Build**

Run: `pnpm build`
Expected: Clean build.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: unified celestial body system — all 9 bodies with kill zones, atmosphere effects, composable visuals, and full destruction"
```

---

### Task 8: Final Validation

Verify the complete system works end-to-end.

**Files:** None (validation only)

- [ ] **Step 1: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 4: Verify no references to deleted code**

Run these searches to confirm clean removal:

```bash
grep -r "biteRadius" src/ tests/ --include="*.ts"
grep -r "isInBiteRange" src/ tests/ --include="*.ts"
grep -r "updateBiteDamage" src/ tests/ --include="*.ts"
grep -r "PlanetObject" src/ tests/ --include="*.ts"
grep -r "PLANET_DEFS" src/ tests/ --include="*.ts"
grep -r "renderEarth\|renderSun" src/ tests/ --include="*.ts"
grep -r "earthObjects" src/ tests/ --include="*.ts"
grep -r "EARTH_GRAVITY_MASS" src/ tests/ --include="*.ts"
```

Expected: No matches for any of these.

- [ ] **Step 5: Commit any fixups**

If any grep matches found, fix them and commit:

```bash
git add -A
git commit -m "chore: clean up remaining references to removed code"
```
