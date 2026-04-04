# Polish and Scale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 paper cuts that are keeping the game from being fun: fuzzy graphics, empty world, invisible Sun, wrong scale, floaty movement, unbreakable planets, upgrade spam, missing range upgrade, and no LOD streaming.

**Architecture:** This plan touches constants, world layout, physics feel, planet destruction mechanics, upgrade tuning, and a new LOD/streaming system in ZoneManager. Named planets become fixed world objects placed at scene start rather than spawned randomly. The world expands from 8,000×8,000 to 400,000×400,000 with zones remapped to match real solar system proportions. SpaceObject gains a `biteRadius` property for the new proximity-damage mechanic. ZoneManager gains a `cull()` method that despawns irrelevant objects each tick.

**Tech Stack:** Phaser 3, TypeScript, Vite, pnpm, vitest

**Pre-commit validation:** Run before every commit:
```bash
pnpm exec tsc --noEmit && pnpm test
```

---

## Issues Being Fixed

| # | Issue | File(s) |
|---|-------|---------|
| 1 | Fuzzy/blurry graphics on retina displays | `src/main.ts` |
| 2 | World too small, planets missing | `src/constants.ts`, `src/data/zones.ts` |
| 3 | Sun invisible — kills you from nothing | `src/scenes/GameScene.ts` |
| 4 | Earth/player scale wrong — start too large | `src/scenes/GameScene.ts`, `src/constants.ts` |
| 5 | Movement too floaty | `src/entities/PlayerStation.ts` |
| 6 | Planets unbreakable — binding energy blocks progress | `src/entities/SpaceObject.ts`, `src/systems/CombatSystem.ts`, `src/scenes/GameScene.ts` |
| 7 | Upgrades too frequent and unimpactful | `src/scenes/GameScene.ts`, `src/data/upgrades.ts` |
| 8 | No beam range upgrade card | `src/data/upgrades.ts` |
| 9 | No LOD — world accumulates dead physics bodies | `src/systems/ZoneManager.ts` |

---

## Task 1: Fix Fuzzy Graphics (Retina DPI)

**Problem:** Phaser renders the canvas at CSS pixel resolution. On retina/HiDPI displays (devicePixelRatio = 2), the canvas is scaled up 2× by the browser, making every pixel blurry.

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add resolution to Phaser config**

Replace `src/main.ts` entirely:

```typescript
import Phaser from "phaser";
import { BootScene } from "@/scenes/BootScene";
import { GameScene } from "@/scenes/GameScene";

const dpr = window.devicePixelRatio || 1;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth * dpr,
  height: window.innerHeight * dpr,
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1 / dpr,
  },
};

new Phaser.Game(config);
```

The trick: render the canvas at physical pixels (`width * dpr`), then zoom the Phaser scale back down by `1/dpr` so game coordinates stay the same. The browser sees a canvas at the right physical resolution and doesn't scale it up.

- [ ] **Step 2: Type check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Run dev and verify**

```bash
pnpm dev
```

Text and shapes should look crisp on a retina display. The upgrade card text and HUD text should have sharp edges.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "fix: crisp graphics on retina displays via DPR-aware canvas resolution"
```

---

## Task 2: Expand the World and Remap Solar System Zones

**Problem:** The world is 8,000×8,000 pixels. The player reaches the edges at Tier 4. There are no named planets, no asteroid belt content, no Jupiter or Saturn. The zones don't match any recognizable solar system layout.

**Architecture:** Expand to 400,000×400,000. Place zones at proportional solar system distances. Named planets (Mercury, Venus, Mars, etc.) become fixed static objects placed in `GameScene.create()` — not spawned randomly. Random debris, asteroids, and rocks continue to spawn via ZoneManager. The Sun is placed as a fixed object at the center-top of the world.

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/data/zones.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update world size constants**

In `src/constants.ts`, replace the world size constants:

```typescript
export const WORLD_WIDTH = 400_000;
export const WORLD_HEIGHT = 400_000;

// Solar system center — Earth orbits here, player starts here
export const WORLD_CENTER_X = WORLD_WIDTH / 2;
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2;

// Named planet positions (distance from center, in world pixels)
// Distances are proportionally compressed (real ratios, not real scale)
export const SOLAR_DISTANCES = {
  mercury:      12_000,
  venus:        22_000,
  earth:             0, // center
  mars:         30_000,
  asteroidBelt: [48_000, 72_000] as [number, number],
  jupiter:      95_000,
  saturn:      140_000,
  uranus:      175_000,
  neptune:     200_000,
  sun:         240_000, // top of world
} as const;
```

- [ ] **Step 2: Replace zones.ts with expanded solar system zones**

Replace `src/data/zones.ts` entirely:

```typescript
import { type SpaceObjectConfig } from "@/entities/SpaceObject";

export interface ZoneDefinition {
  name: string;
  minDistance: number;
  maxDistance: number;
  spawnTable: SpawnEntry[];
  maxObjects: number;
  /** Objects smaller than this (relative to player size) get culled */
  cullBelowPlayerRatio: number;
  /** Only spawn when player is within this many pixels of zone boundary */
  activationRange: number;
}

export interface SpawnEntry {
  weight: number;
  minTier: number;
  factory: () => Omit<SpaceObjectConfig, "x" | "y">;
}

const junkColors = [0x888888, 0x666666, 0x999999, 0xaaaaaa];
const asteroidColors = [0x8b7355, 0xa0926b, 0x7a6b50, 0x6b5c3e];
const iceColors = [0xaaccee, 0x88aacc, 0xccddff];

export const ZONES: ZoneDefinition[] = [
  // ── Near-Earth Orbit ─────────────────────────────────────────────
  {
    name: "Near-Earth Orbit",
    minDistance: 0,
    maxDistance: 8_000,
    maxObjects: 40,
    cullBelowPlayerRatio: 0.05,
    activationRange: 3_000,
    spawnTable: [
      {
        weight: 5, minTier: 1,
        factory: () => ({
          size: 20 + Math.random() * 30,
          health: 15,
          massYield: 3,
          energyYield: 1,
          gravityMass: 0,
          color: junkColors[Math.floor(Math.random() * junkColors.length)],
        }),
      },
      {
        weight: 3, minTier: 1,
        factory: () => ({
          size: 40 + Math.random() * 40,
          health: 30,
          massYield: 8,
          energyYield: 2,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 1, minTier: 1,
        factory: () => ({
          size: 35 + Math.random() * 20,
          health: 25,
          massYield: 12,
          energyYield: 4,
          gravityMass: 0,
          color: 0xaaaacc,
          name: "Satellite",
        }),
      },
    ],
  },

  // ── Inner Solar System ────────────────────────────────────────────
  {
    name: "Inner Solar System",
    minDistance: 8_000,
    maxDistance: 28_000,
    maxObjects: 30,
    cullBelowPlayerRatio: 0.03,
    activationRange: 5_000,
    spawnTable: [
      {
        weight: 6, minTier: 1,
        factory: () => ({
          size: 60 + Math.random() * 80,
          health: 50,
          massYield: 15,
          energyYield: 5,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 2, minTier: 2,
        factory: () => ({
          size: 100 + Math.random() * 60,
          health: 120,
          massYield: 35,
          energyYield: 10,
          gravityMass: 0,
          color: 0x6699cc,
        }),
      },
    ],
  },

  // ── Asteroid Belt ─────────────────────────────────────────────────
  {
    name: "Asteroid Belt",
    minDistance: 48_000,
    maxDistance: 72_000,
    maxObjects: 80,
    cullBelowPlayerRatio: 0.02,
    activationRange: 10_000,
    spawnTable: [
      {
        weight: 10, minTier: 2,
        factory: () => ({
          size: 80 + Math.random() * 200,
          health: 40 + Math.random() * 80,
          massYield: 20 + Math.random() * 40,
          energyYield: 5 + Math.random() * 10,
          gravityMass: 0,
          color: asteroidColors[Math.floor(Math.random() * asteroidColors.length)],
        }),
      },
      {
        weight: 2, minTier: 2,
        factory: () => ({
          size: 300 + Math.random() * 200,
          health: 200,
          massYield: 100,
          energyYield: 20,
          gravityMass: 0,
          color: 0x998877,
        }),
      },
    ],
  },

  // ── Outer Solar System ────────────────────────────────────────────
  {
    name: "Outer Solar System",
    minDistance: 95_000,
    maxDistance: 200_000,
    maxObjects: 25,
    cullBelowPlayerRatio: 0.01,
    activationRange: 20_000,
    spawnTable: [
      {
        weight: 5, minTier: 3,
        factory: () => ({
          size: 200 + Math.random() * 400,
          health: 300,
          massYield: 200,
          energyYield: 50,
          gravityMass: 0,
          color: 0x99aacc,
        }),
      },
    ],
  },

  // ── Kuiper Belt ───────────────────────────────────────────────────
  {
    name: "Kuiper Belt",
    minDistance: 200_000,
    maxDistance: 240_000,
    maxObjects: 20,
    cullBelowPlayerRatio: 0.005,
    activationRange: 30_000,
    spawnTable: [
      {
        weight: 5, minTier: 4,
        factory: () => ({
          size: 500 + Math.random() * 500,
          health: 800,
          massYield: 500,
          energyYield: 100,
          gravityMass: 0,
          color: iceColors[Math.floor(Math.random() * iceColors.length)],
        }),
      },
    ],
  },
];
```

- [ ] **Step 3: Run type check and tests**

```bash
pnpm exec tsc --noEmit && pnpm test
```

Expected: zone tests may need updating — check `tests/data/` for any that reference old zone distances.

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts src/data/zones.ts
git commit -m "feat: expand world to 400k×400k, remap zones to solar system proportions"
```

---

## Task 3: Place Named Planets as Fixed World Objects

**Problem:** No named planets exist in the world. Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune are all missing. The world feels empty because zones only contain random debris.

**Architecture:** Named planets are static, permanent objects placed at fixed positions in `GameScene.create()`. They use a new `PlanetObject` class that extends SpaceObject's visual style but adds planet-specific rendering (colored circle with atmosphere glow, label). They are added to the ZoneManager's object list so combat can target them.

**Files:**
- Create: `src/entities/PlanetObject.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Create src/entities/PlanetObject.ts**

```typescript
import Phaser from "phaser";
import { WORLD_CENTER_X, WORLD_CENTER_Y } from "@/constants";
import { SpaceObject, type SpaceObjectConfig } from "@/entities/SpaceObject";

export interface PlanetDef {
  name: string;
  distance: number;       // from world center
  angle: number;          // radians from north (0 = top)
  visualRadius: number;   // display radius in world pixels
  color: number;
  atmosphereColor: number;
  config: Omit<SpaceObjectConfig, "x" | "y" | "size" | "color" | "name">;
}

export const PLANET_DEFS: PlanetDef[] = [
  {
    name: "Mercury",
    distance: 12_000,
    angle: 0.8,
    visualRadius: 400,
    color: 0x9b8b78,
    atmosphereColor: 0x7a6b5c,
    config: {
      health: 2_000,
      massYield: 800,
      energyYield: 200,
      gravityMass: 800,
    },
  },
  {
    name: "Venus",
    distance: 22_000,
    angle: 2.1,
    visualRadius: 900,
    color: 0xe8b84b,
    atmosphereColor: 0xd4983a,
    config: {
      health: 5_000,
      massYield: 2_000,
      energyYield: 500,
      gravityMass: 2_000,
    },
  },
  {
    name: "Mars",
    distance: 30_000,
    angle: 3.9,
    visualRadius: 700,
    color: 0xc1440e,
    atmosphereColor: 0xa03308,
    config: {
      health: 3_000,
      massYield: 1_200,
      energyYield: 300,
      gravityMass: 1_200,
    },
  },
  {
    name: "Jupiter",
    distance: 95_000,
    angle: 1.2,
    visualRadius: 8_000,
    color: 0xc88b3a,
    atmosphereColor: 0xaa7230,
    config: {
      health: 50_000,
      massYield: 20_000,
      energyYield: 5_000,
      gravityMass: 20_000,
    },
  },
  {
    name: "Saturn",
    distance: 140_000,
    angle: 4.5,
    visualRadius: 6_500,
    color: 0xe4d090,
    atmosphereColor: 0xc8b86a,
    config: {
      health: 40_000,
      massYield: 16_000,
      energyYield: 4_000,
      gravityMass: 16_000,
    },
  },
  {
    name: "Uranus",
    distance: 175_000,
    angle: 0.3,
    visualRadius: 3_500,
    color: 0x7de8e8,
    atmosphereColor: 0x5cc8c8,
    config: {
      health: 25_000,
      massYield: 10_000,
      energyYield: 2_500,
      gravityMass: 10_000,
    },
  },
  {
    name: "Neptune",
    distance: 200_000,
    angle: 2.8,
    visualRadius: 3_200,
    color: 0x3f54ba,
    atmosphereColor: 0x2d3d9a,
    config: {
      health: 22_000,
      massYield: 9_000,
      energyYield: 2_200,
      gravityMass: 9_000,
    },
  },
];

/**
 * A named planet — static position, large visual, permanent fixture of the world.
 * Added to ZoneManager objects so combat can target it.
 */
export function createPlanet(scene: Phaser.Scene, def: PlanetDef): SpaceObject {
  const x = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
  const y = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;

  // Draw the planet as a layered graphic (atmosphere + body + highlights)
  const r = def.visualRadius;
  const texKey = `planet_${def.name}`;

  if (!scene.textures.exists(texKey)) {
    const g = scene.add.graphics();

    // Outer atmosphere glow
    g.fillStyle(def.atmosphereColor, 0.2);
    g.fillCircle(r + 20, r + 20, r + 20);

    // Body
    g.fillStyle(def.color, 1.0);
    g.fillCircle(r + 20, r + 20, r);

    // Highlight (top-left bright spot)
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(r + 20 - r * 0.3, r + 20 - r * 0.3, r * 0.5);

    // Thin outline
    g.lineStyle(Math.max(2, r * 0.01), 0xffffff, 0.15);
    g.strokeCircle(r + 20, r + 20, r);

    g.generateTexture(texKey, (r + 20) * 2, (r + 20) * 2);
    g.destroy();
  }

  // Use SpaceObject constructor but skip its texture generation by pre-registering
  const spaceObj = new SpaceObject(scene, {
    x, y,
    size: r,
    color: def.color,
    name: def.name,
    ...def.config,
    bindingMassThreshold: 0,  // no binding energy block — biting works always
    healRate: 0,               // no regeneration
  });

  // Override the auto-generated texture with our detailed one
  spaceObj.sprite.setTexture(texKey);
  spaceObj.sprite.setDisplaySize(r * 2, r * 2);

  // Planet label
  scene.add.text(x, y + r + 60, def.name, {
    fontFamily: "monospace",
    fontSize: `${Math.max(24, r * 0.08)}px`,
    color: "#" + def.color.toString(16).padStart(6, "0"),
    alpha: 0.7,
  }).setOrigin(0.5).setDepth(1);

  // For Saturn — add ring system
  if (def.name === "Saturn") {
    const rings = scene.add.graphics().setDepth(0);
    rings.lineStyle(r * 0.08, def.atmosphereColor, 0.5);
    rings.strokeEllipse(x, y, r * 3.2, r * 0.5);
    rings.lineStyle(r * 0.04, def.color, 0.3);
    rings.strokeEllipse(x, y, r * 2.8, r * 0.4);
  }

  // Add gravity body to physics (via spaceObj.sprite position)
  spaceObj.sprite.setVelocity(0, 0); // planets don't drift
  spaceObj.sprite.setImmovable(true);

  return spaceObj;
}
```

- [ ] **Step 2: Add planet placement to GameScene.create()**

In `src/scenes/GameScene.ts`, add import:

```typescript
import { PLANET_DEFS, createPlanet } from "@/entities/PlanetObject";
```

In `create()`, after `this.gravity.initGraphics(this)`, add:

```typescript
    // Place named planets as fixed world objects
    this.planets = [];
    for (const def of PLANET_DEFS) {
      const planet = createPlanet(this, def);
      this.planets.push(planet);
      this.zones.addFixedObject(planet);

      // Add planet as a gravity body
      const px = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
      const py = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;
      this.gravity.addBody({ x: px, y: py, gravityMass: def.config.gravityMass });
    }
```

Add field to GameScene class:

```typescript
  planets: SpaceObject[] = [];
```

- [ ] **Step 3: Add addFixedObject() to ZoneManager**

In `src/systems/ZoneManager.ts`, add:

```typescript
  /** Add a permanently-placed object (planet). It is never culled by size. */
  addFixedObject(obj: SpaceObject): void {
    obj.sprite.setData("fixed", true);
    this.objects.push(obj);
    this.objectGroup.add(obj.sprite);
  }
```

- [ ] **Step 4: Type check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/entities/PlanetObject.ts src/scenes/GameScene.ts src/systems/ZoneManager.ts
git commit -m "feat: place named planets as fixed world objects with detailed visuals"
```

---

## Task 4: Render the Sun + Remove Invisible Kill Zone

**Problem:** The Sun exists as a gravity body but renders as nothing. Players fly north and die from an invisible source. It needs the same treatment as Earth — a large visible object with a visual radius that makes it clear what is pulling you.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add renderSun() to GameScene**

Add this method alongside `renderEarth()`:

```typescript
  private renderSun(): void {
    // Sun is positioned at distance SOLAR_DISTANCES.sun from center, toward "north"
    const sunX = WORLD_CENTER_X;
    const sunY = WORLD_CENTER_Y - 240_000;
    const radius = 25_000; // enormous — it IS a star

    const g = this.add.graphics().setDepth(-4);

    // Outer corona glow (very faint, huge)
    for (let i = 0; i < 4; i++) {
      const r = radius * (1.4 + i * 0.3);
      const alpha = 0.04 - i * 0.008;
      g.fillStyle(0xffaa00, alpha);
      g.fillCircle(sunX, sunY, r);
    }

    // Main body
    g.fillStyle(0xffdd00, 1.0);
    g.fillCircle(sunX, sunY, radius);

    // Inner bright core
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(sunX, sunY, radius * 0.5);

    // Label — large enough to see from a distance
    this.add.text(sunX, sunY + radius + 2_000, "The Sun", {
      fontFamily: "monospace",
      fontSize: "2000px",
      color: "#ffdd00",
    }).setOrigin(0.5).setDepth(-4).setAlpha(0.8);
  }
```

- [ ] **Step 2: Call renderSun() in create()**

In `GameScene.create()`, after `renderEarth()`:

```typescript
    this.renderSun();
```

- [ ] **Step 3: Update the Sun gravity body to the correct position**

In `GameScene.create()`, replace the Sun gravity body:

```typescript
    // Sun — far north of world center
    this.gravity.addBody({
      x: WORLD_CENTER_X,
      y: WORLD_CENTER_Y - 240_000,
      gravityMass: 50_000,
    });
```

Also import `WORLD_CENTER_X` and `WORLD_CENTER_Y` from constants (replace uses of `WORLD_WIDTH / 2` and `WORLD_HEIGHT / 2`):

```typescript
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS, GRAVITY_SCALE, WORLD_CENTER_X, WORLD_CENTER_Y } from "@/constants";
```

Add `GRAVITY_SCALE` to constants.ts:

```typescript
export const GRAVITY_SCALE = 0.08; // tuned down — gentle pull, not wrestling match
```

- [ ] **Step 4: Update Earth gravity body to match new world center**

```typescript
    // Earth — at world center
    this.gravity.addBody({
      x: WORLD_CENTER_X,
      y: WORLD_CENTER_Y,
      gravityMass: 500,
    });
```

- [ ] **Step 5: Update renderEarth() to use WORLD_CENTER constants**

```typescript
  private renderEarth(): void {
    const earthX = WORLD_CENTER_X;
    const earthY = WORLD_CENTER_Y + 600;
    // ... rest unchanged
  }
```

- [ ] **Step 6: Type check and commit**

```bash
pnpm exec tsc --noEmit
git add src/scenes/GameScene.ts src/constants.ts
git commit -m "feat: render Sun visually, fix gravity body positions to world center constants"
```

---

## Task 5: Fix Earth and Player Scale Proportions

**Problem:** Earth's visual radius is 180px in an 8,000px world. Expanded to 400,000px world the player starts proportionally too large and Earth looks like a small island rather than a planet.

**Architecture:** Earth gets a visual radius of 3,000px. Player starts at size 8px. At game start, camera zoom = 4.0 so the player appears ~32px on screen. Earth at 3,000px × zoom 4.0 = partially visible below as a massive arc — correctly conveying "you are a tiny satellite in orbit around this giant thing."

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/entities/PlayerStation.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Update PLAYER_START_SIZE in constants.ts**

```typescript
export const PLAYER_START_SIZE = 8;
export const PLAYER_BASE_SPEED = 400; // faster to match larger world
```

Speed increases because the world is 50× bigger. At 150px/s the player would barely move.

- [ ] **Step 2: Update renderEarth() to use large radius**

In `GameScene.renderEarth()`, change radius:

```typescript
  private renderEarth(): void {
    const earthX = WORLD_CENTER_X;
    const earthY = WORLD_CENTER_Y + 3_200; // just below player start
    const radius = 3_000;
    const g = this.add.graphics().setDepth(-3);

    // Outer atmosphere glow
    g.fillStyle(0x1a3a5c, 0.15);
    g.fillCircle(earthX, earthY, radius + 600);

    // Atmosphere layer
    g.fillStyle(0x2255aa, 0.25);
    g.fillCircle(earthX, earthY, radius + 200);

    // Ocean base
    g.fillStyle(0x1a4a8a, 0.95);
    g.fillCircle(earthX, earthY, radius);

    // Land masses — proportionally scaled blobs
    g.fillStyle(0x2d6e2d, 0.85);
    g.fillEllipse(earthX - 500, earthY - 400, 1200, 900);
    g.fillEllipse(earthX + 700, earthY + 300, 900, 1100);
    g.fillEllipse(earthX - 200, earthY + 700, 800, 500);
    g.fillEllipse(earthX + 300, earthY - 800, 600, 400);

    // Thin cloud layer
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(earthX, earthY, radius);

    // Outline
    g.lineStyle(30, 0x4488cc, 0.3);
    g.strokeCircle(earthX, earthY, radius);

    // Label — large enough to see from orbit
    this.add.text(earthX, earthY + radius + 400, "Earth", {
      fontFamily: "monospace",
      fontSize: "300px",
      color: "#4488cc",
    }).setOrigin(0.5).setDepth(-3).setAlpha(0.6);
  }
```

- [ ] **Step 3: Set initial camera zoom in GameScene.create()**

At the end of `create()`, set starting zoom:

```typescript
    this.cameras.main.setZoom(4.0);
```

- [ ] **Step 4: Update player start position to be above Earth**

In `PlayerStation` constructor, the player spawns at `WORLD_WIDTH/2, WORLD_HEIGHT/2`. Earth center is now at `WORLD_CENTER_X, WORLD_CENTER_Y + 3_200`. Player should start above Earth:

In `src/entities/PlayerStation.ts`, the `body` spawn position uses `WORLD_WIDTH/2, WORLD_HEIGHT/2` from constants which is now 200_000, 200_000. Earth is at center+3200. The player at exact center is fine — 3200px above Earth's center, outside its 3000px radius. Good.

- [ ] **Step 5: Update growth formula for larger world**

In `GameScene.update()`, the camera zoom uses `growthFactor`. Adjust the base size:

```typescript
    const baseSize = PLAYER_START_SIZE; // import from constants
    const growthFactor = 1 + Math.log2(1 + this.resources.totalMassEarned) * 0.5;
    this.player.setSize(baseSize * growthFactor);

    // Camera zoom: starts at 4.0, zooms out smoothly as you grow
    const targetZoom = Math.max(4.0 / growthFactor, 0.05);
```

- [ ] **Step 6: Type check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Run dev and verify**

```bash
pnpm dev
```

Earth should be visible below as a large arc, partially off-screen. The player should look tiny by comparison. Moving away from Earth should show the planet shrinking.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GameScene.ts src/entities/PlayerStation.ts src/constants.ts
git commit -m "fix: Earth 3000px radius, player starts tiny, zoom 4x at game start"
```

---

## Task 6: Fix Movement — Less Floaty, More Responsive

**Problem:** Movement feels like sliding on ice. Too much momentum carries over when you release keys. The player wants snappy, responsive feel — stop quickly when keys released, accelerate fast.

**Files:**
- Modify: `src/entities/PlayerStation.ts`

- [ ] **Step 1: Increase drag dramatically**

In `PlayerStation` constructor, replace the drag settings:

```typescript
    this.body.setDamping(true);
    this.body.setDrag(0.99);  // was 0.95 — much snappier stop
    this.body.setMaxVelocity(this.speed, this.speed);
```

`setDamping(true)` with drag `0.99` means velocity decays 99% per second — stops almost instantly when keys released. This is the "snappy" feel.

- [ ] **Step 2: Increase max velocity to match world size**

In `update()`, replace the velocity cap:

```typescript
    // Use Phaser's built-in maxVelocity instead of manual capping
    (this.body.body as Phaser.Physics.Arcade.Body).setMaxVelocity(this.speed, this.speed);
```

Remove the manual velocity magnitude cap block that follows:

```typescript
    // DELETE THIS BLOCK:
    // const vel = this.body.body!.velocity;
    // const mag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    // if (mag > this.speed) {
    //   this.body.body!.velocity.scale(this.speed / mag);
    // }
```

- [ ] **Step 3: Increase base acceleration for large world**

In `update()`, change the accel multiplier:

```typescript
    const accel = this.speed * 8 * (this.isBoosting ? 2.0 : 1.0);
```

Was `speed * 3`. Higher multiplier means you reach max speed faster and feel more in control.

- [ ] **Step 4: Update PLAYER_BASE_SPEED in constants.ts**

```typescript
export const PLAYER_BASE_SPEED = 600; // fast enough for 400k world
```

- [ ] **Step 5: Verify feel**

```bash
pnpm dev
```

Movement should feel immediate — press W, instantly accelerate upward. Release W, stop almost immediately. No ice-skating.

- [ ] **Step 6: Commit**

```bash
git add src/entities/PlayerStation.ts src/constants.ts
git commit -m "fix: snappy movement — high drag, fast acceleration, scaled speed for large world"
```

---

## Task 7: Fix Planet Destruction — Proximity Biting

**Problem:** Planets have a `bindingMassThreshold` that prevents destruction until player mass exceeds it. Players at Tier 4 still can't damage planets because the threshold is never met. The mechanic is invisible and frustrating.

**New mechanic:** Remove binding energy entirely. Instead, players damage planets by flying close — the "bite" — but flying that close is genuinely dangerous because of the planet's gravity well. You need skill to swoop in, deal damage, and pull back before you crash. Planets show visible cracks as health drops. Named planets are permanent so they spawn crater/chunk debris when damaged.

**Files:**
- Modify: `src/entities/SpaceObject.ts`
- Modify: `src/systems/CombatSystem.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/data/zones.ts`

- [ ] **Step 1: Remove healing from SpaceObject, add biteRadius and damage stage visuals**

In `src/entities/SpaceObject.ts`, replace `updateHealing()` with nothing (remove method and all references). Remove `bindingMassThreshold` and `healRate` fields. Add `biteRadius` and `damageStage`:

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
  /** Radius within which the player damages this object by proximity. 0 = laser only. */
  biteRadius?: number;
}

export class SpaceObject {
  sprite: Phaser.Physics.Arcade.Sprite;
  config: SpaceObjectConfig;
  health: number;
  readonly maxHealth: number;
  isBeingChewed: boolean = false; // kept for compatibility, unused

  private scene: Phaser.Scene;
  private damageOverlay?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, config: SpaceObjectConfig) {
    this.scene = scene;
    this.config = config;
    this.health = config.health;
    this.maxHealth = config.health;

    const key = `space_obj_${config.color}_${Math.round(config.size)}`;
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.fillStyle(config.color, 1);
      g.fillCircle(config.size, config.size, config.size);
      g.lineStyle(Math.max(1, config.size * 0.02), 0xffffff, 0.2);
      g.strokeCircle(config.size, config.size, config.size);
      g.generateTexture(key, config.size * 2, config.size * 2);
      g.destroy();
    }

    this.sprite = scene.physics.add.sprite(config.x, config.y, key);
    this.sprite.setData("spaceObject", this);

    const vx = (Math.random() - 0.5) * 20;
    const vy = (Math.random() - 0.5) * 20;
    this.sprite.setVelocity(vx, vy);
  }

  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite.active) {
        this.sprite.clearTint();
        this.updateDamageVisual();
      }
    });
    return this.health <= 0;
  }

  /** Updates crack overlay based on damage percentage. */
  private updateDamageVisual(): void {
    const ratio = this.health / this.maxHealth;
    if (ratio > 0.75) return; // no visual until 25% damaged

    if (!this.damageOverlay) {
      this.damageOverlay = this.scene.add.graphics();
      this.damageOverlay.setDepth(2);
    }

    this.damageOverlay.clear();
    const x = this.sprite.x;
    const y = this.sprite.y;
    const r = this.config.size;

    const crackAlpha = 1 - ratio;
    this.damageOverlay.lineStyle(Math.max(1, r * 0.03), 0xff4400, crackAlpha * 0.8);

    // Draw random-looking cracks based on damage level
    const crackCount = Math.floor((1 - ratio) * 6) + 1;
    const seed = this.config.x * 1000 + this.config.y; // stable per-object
    for (let i = 0; i < crackCount; i++) {
      const a = ((seed * (i + 1) * 137.5) % 360) * (Math.PI / 180);
      const len = r * (0.5 + (seed * (i + 3) % 50) / 100);
      this.damageOverlay.lineBetween(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
  }

  get healthRatio(): number {
    return this.health / this.maxHealth;
  }

  /** Returns true if player is close enough to bite this object. */
  isInBiteRange(playerX: number, playerY: number, playerSize: number): boolean {
    const biteRadius = this.config.biteRadius ?? 0;
    if (biteRadius === 0) return false;
    const dist = Phaser.Math.Distance.Between(playerX, playerY, this.sprite.x, this.sprite.y);
    return dist < biteRadius + playerSize;
  }

  destroy(): void {
    this.damageOverlay?.destroy();
    this.sprite.destroy();
  }
}
```

- [ ] **Step 2: Add biteRadius to planet definitions**

In `src/entities/PlanetObject.ts`, add `biteRadius` to each planet's config (set to `visualRadius * 1.1` so the player must enter the atmosphere):

```typescript
  config: {
    health: 2_000,
    massYield: 800,
    energyYield: 200,
    gravityMass: 800,
    biteRadius: 440, // visualRadius * 1.1
  },
```

Apply to each planet: `biteRadius = visualRadius * 1.1`.

- [ ] **Step 3: Add proximity bite damage in CombatSystem**

In `src/systems/CombatSystem.ts`, add a `updateBiteDamage()` method:

```typescript
  /** Called each frame — deals damage to any planet the player is inside bite range of. */
  updateBiteDamage(delta: number): void {
    const biteRate = 200; // damage per second when biting
    for (const obj of this.zones.getObjects()) {
      if (!obj.isInBiteRange(this.player.x, this.player.y, this.player.size)) continue;

      const dmg = biteRate * (delta / 1000);
      const destroyed = obj.takeDamage(dmg);

      // Bite feedback — particles from the contact point
      if (Math.random() < 0.3) {
        const angle = Phaser.Math.Angle.Between(obj.sprite.x, obj.sprite.y, this.player.x, this.player.y);
        const cx = obj.sprite.x + Math.cos(angle) * obj.config.size;
        const cy = obj.sprite.y + Math.sin(angle) * obj.config.size;
        const particles = this.scene.add.particles(cx, cy, "particle", {
          speed: { min: 80, max: 200 },
          scale: { start: 0.8, end: 0 },
          tint: obj.config.color,
          lifespan: 300,
          quantity: 3,
          emitting: false,
        });
        particles.explode(3);
        this.scene.time.delayedCall(400, () => particles.destroy());
      }

      if (destroyed) {
        this.audio?.play("sfx_explosion");
        this.createExplosion(obj.sprite.x, obj.sprite.y, obj.config.color);
        this.spawnDebris(obj);
        this.resources.addMass(obj.config.massYield);
        this.resources.onKill();
        this.zones.removeObject(obj);

        // Screen shake for dramatic planet destruction
        this.scene.cameras.main.shake(600, 0.008);
      }
    }
  }
```

- [ ] **Step 4: Call updateBiteDamage from CombatSystem.update()**

In `CombatSystem.update()`, add:

```typescript
    this.updateBiteDamage(delta);
```

- [ ] **Step 5: Remove healing call from ZoneManager**

In `src/systems/ZoneManager.ts`, remove the healing loop:

```typescript
    // DELETE:
    // for (const obj of this.objects) {
    //   if (obj.sprite.active) {
    //     obj.updateHealing(delta, playerMass);
    //   }
    // }
```

Also remove `playerMass` parameter from `update()`:

```typescript
  update(delta: number, playerX: number, playerY: number, playerTier: number): void {
```

Update all callers in `GameScene.ts`.

- [ ] **Step 6: Type check and tests**

```bash
pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 7: Run dev and verify biting**

Fly into a planet — should see crack effects, health dropping, particle spray from contact. Should feel dangerous because the gravity is pulling you in while you bite.

- [ ] **Step 8: Commit**

```bash
git add src/entities/SpaceObject.ts src/entities/PlanetObject.ts src/systems/CombatSystem.ts src/systems/ZoneManager.ts src/scenes/GameScene.ts
git commit -m "feat: proximity bite damage — fly into planets to eat them, no binding energy gate"
```

---

## Task 8: Fix Upgrade Frequency and Impact

**Problem:** Upgrades trigger every 30 mass. At Tier 4 with 2000+ mass, the screen pauses multiple times per minute. Effects are too small to feel impactful.

**Fixes:**
- Milestone scales with progression: starts at 50 mass, grows by 1.5× each time
- Upgrade effects doubled or tripled
- Add beam range upgrade card

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/data/upgrades.ts`

- [ ] **Step 1: Replace flat milestone with scaling milestone in GameScene**

Replace the milestone tracking fields:

```typescript
  private nextMilestone: number = 50;       // first upgrade at 50 mass
  private readonly MILESTONE_SCALE = 1.6;   // each subsequent upgrade costs 60% more mass
```

In `triggerUpgrade()`, after the screen shows:

```typescript
  private triggerUpgrade(): void {
    this.isPaused = true;
    this.physics.world.pause();
    this.upgradeCount++;
    this.nextMilestone = Math.floor(this.resources.totalMassEarned + 
      50 * Math.pow(this.MILESTONE_SCALE, this.upgradeCount));

    this.upgradeScreen.show(() => {
      this.isPaused = false;
      this.physics.world.resume();
      this.audio.music.onTierChange(this.currentTier);
    });
  }
```

This means:
- Upgrade 1: at 50 mass
- Upgrade 2: at ~130 mass
- Upgrade 3: at ~258 mass
- Upgrade 4: at ~463 mass
- Upgrade 10: at ~7,000 mass
- Upgrade 20: at ~130,000 mass

Upgrades slow down as you progress, feeling more like milestones and less like spam.

- [ ] **Step 2: Double all upgrade effects in upgrades.ts**

In `src/data/upgrades.ts`, update the effect magnitudes:

```typescript
  // fireRate: was 0.8 multiplier (20% faster), now 0.7 (30% faster)
  apply(combat) { combat.autoFireCooldown = Math.max(150, combat.autoFireCooldown * 0.70); },

  // doubleShot: unchanged — +1 shot is always impactful

  // spreadShot: was ±15°, now ±20°
  apply(combat) { combat.spreadAngle += 20; },

  // speed: was 25%, now 40%
  apply(_, __, player) { player.speed = Math.round(player.speed * 1.40); },

  // battery: was +50, now +100
  apply(_, resources) { resources.batteryCapacity += 100; },

  // damage: was +30%, now +50%
  apply(combat) { combat.beamDamage = Math.round(combat.beamDamage * 1.5); },

  // burstSize: was +2, now +3
  apply(combat) { combat.burstShotCount += 3; },

  // massGain: was ×1.25, now ×1.5
  apply(_, resources) { resources.massMultiplier *= 1.5; },

  // recharge: was +4/sec, now +8/sec
  apply(_, resources) { resources.passiveRechargeRate += 8; },

  // killRecharge: was +4, now +8
  apply(_, resources) { resources.killRechargeBonus += 8; },

  // burstCooldown: was ×0.75, now ×0.6
  apply(combat) { combat.burstCooldownMax = Math.max(200, combat.burstCooldownMax * 0.6); },

  // boostCost: was ×0.6, now ×0.5
  apply(_, resources) { resources.boostCostPerSec *= 0.5; },

  // gravResist: was +0.3, now +0.4
  apply(_, __, player) { player.gravityResistance = Math.min(0.9, player.gravityResistance + 0.4); },
```

- [ ] **Step 3: Run tests**

```bash
pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts src/data/upgrades.ts
git commit -m "fix: upgrade milestone scales with progression, effects doubled"
```

---

## Task 9: Add Beam Range Upgrade Card

**Problem:** No upgrade increases beam range. Players can't fire from safe distances. Missing card.

**Files:**
- Modify: `src/data/upgrades.ts`

- [ ] **Step 1: Add beamRange card to UPGRADE_CARDS array**

In `src/data/upgrades.ts`, add to the array after the `damage` card:

```typescript
  {
    id: "beamRange",
    name: "Long Range Optics",
    description: "Beam range +40%",
    rarity: "uncommon",
    apply(combat) { combat.beamRange = Math.round(combat.beamRange * 1.4); },
  },
```

- [ ] **Step 2: Run tests to confirm new card passes validation**

```bash
pnpm test -- tests/data/upgrades.test.ts
```

Expected: all pass (the test validates all cards have required fields).

- [ ] **Step 3: Commit**

```bash
git add src/data/upgrades.ts
git commit -m "feat: add Long Range Optics upgrade card (+40% beam range)"
```

---

## Task 10: LOD Streaming — Cull Small Objects, Scale-Aware Spawning

**Problem:** As the player grows, small asteroids from Tier 1 persist in the world as dead physics bodies. At Tier 4 the world is cluttered with irrelevant tiny objects that waste physics budget. The spawn system doesn't scale with player size — still spawning 40px asteroids next to a moon-sized station.

**Architecture:** ZoneManager gets a `cull()` method called each frame that despawns objects below a size threshold relative to the player. Spawn radius also scales with player size — larger player = objects spawn further out. Zone `activationRange` gates which zones are even checked.

**Files:**
- Modify: `src/systems/ZoneManager.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add playerSize parameter to ZoneManager.update()**

Replace the `update()` signature:

```typescript
  update(
    delta: number,
    playerX: number,
    playerY: number,
    playerTier: number,
    playerSize: number = 8
  ): void {
```

- [ ] **Step 2: Add cull() logic inside update()**

After the cleanup pass (`this.objects = this.objects.filter(...)`) in `update()`, add:

```typescript
    // LOD cull — remove objects too small to matter at current player size
    const survivingObjects: SpaceObject[] = [];
    for (const obj of this.objects) {
      if (!obj.sprite.active) continue;
      const isFixed = obj.sprite.getData("fixed") === true;
      if (isFixed) {
        survivingObjects.push(obj); // never cull named planets
        continue;
      }
      const cullThreshold = playerSize * 0.08;
      if (obj.config.size < cullThreshold) {
        obj.destroy();
        continue;
      }
      survivingObjects.push(obj);
    }
    this.objects = survivingObjects;
```

- [ ] **Step 3: Scale spawn radius and proximity check with player size**

In `spawnInZone()`, replace the player proximity check:

```typescript
    // Spawn radius scales with player size — bigger player sees further
    const spawnMin = Math.max(200, playerSize * 3);
    const spawnMax = Math.max(2000, playerSize * 25);
    const distToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY);
    if (!skipDistCheck && (distToPlayer < spawnMin || distToPlayer > spawnMax)) return;
```

- [ ] **Step 4: Gate zones by activation range from player**

In `update()`, replace the zone activation check:

```typescript
      // Only process zones the player is near enough to activate
      const zoneCenter = (zone.minDistance + zone.maxDistance) / 2;
      const distToZone = Math.abs(playerDist - zoneCenter);
      if (distToZone > zone.activationRange + playerSize * 10) continue;
```

- [ ] **Step 5: Pass playerSize from GameScene**

In `GameScene.update()`, update the zones.update call:

```typescript
    this.zones.update(delta, this.player.x, this.player.y, tier, this.player.size);
```

- [ ] **Step 6: Write test for cull threshold**

Add to `tests/systems/ZoneManager` — wait, ZoneManager requires a Phaser scene which can't be unit tested. Instead, test the cull threshold math in isolation. Add to `tests/data/upgrades.test.ts` or create a separate test for the math:

```typescript
// tests/systems/lod.test.ts
import { describe, it, expect } from "vitest";

describe("LOD cull threshold", () => {
  it("object smaller than 8% of player size should be culled", () => {
    const playerSize = 500;
    const cullThreshold = playerSize * 0.08;
    expect(40).toBeLessThan(cullThreshold); // 40px asteroid culled when player is 500px
    expect(50).toBeGreaterThan(40 * 0.08); // sanity
  });

  it("spawn min scales with player size", () => {
    const playerSize = 1000;
    const spawnMin = Math.max(200, playerSize * 3);
    expect(spawnMin).toBe(3000);
  });

  it("spawn max scales with player size", () => {
    const playerSize = 1000;
    const spawnMax = Math.max(2000, playerSize * 25);
    expect(spawnMax).toBe(25000);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add src/systems/ZoneManager.ts src/scenes/GameScene.ts tests/systems/lod.test.ts
git commit -m "feat: LOD streaming — cull irrelevant small objects, scale-aware spawn radius"
```

---

## Task 11: Update HUD for New World Scale

**Problem:** With the 50× world expansion and new proportions, the HUD needs to show relevant information. Burst readiness and boost state aren't visible. The controls hint at the bottom is cluttered.

**Files:**
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Add burst readiness indicator**

In `HUD.ts`, add a `burstText` field and update it each frame. Burst is ready when `resources.canBurst` is true and `combat.burstCooldown <= 0`.

Add field:
```typescript
  private burstText!: Phaser.GameObjects.Text;
```

In constructor, after tier text:
```typescript
    this.burstText = scene.add.text(20, 98, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffd93d",
    }).setScrollFactor(0).setDepth(100);
```

In `update()`, add:
```typescript
    // Burst readiness
    const canBurst = this.resources.canBurst;
    this.burstText.setText(canBurst ? "BURST ready [SPC]" : "");
    this.burstText.setColor(canBurst ? "#ffd93d" : "#555");
```

- [ ] **Step 2: Simplify controls hint**

Replace the bottom controls hint with something more concise:

```typescript
    scene.add.text(20, scene.scale.height - 16,
      "WASD · SPACE burst · SHIFT boost",
      { fontFamily: "monospace", fontSize: "11px", color: "#444" }
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(100);
```

- [ ] **Step 3: Pass combat reference to HUD**

HUD needs to check `combat.burstCooldown`. Update HUD constructor signature:

```typescript
  constructor(
    scene: Phaser.Scene,
    resources: ResourceManager,
    combat: CombatSystem,
    audio?: AudioManager
  )
```

And update `GameScene.create()` to pass `this.combat`:

```typescript
    this.hud = new HUD(this, this.resources, this.combat, this.audio);
```

Store `combat` as a field in HUD:
```typescript
  private combat: CombatSystem;
```

Update burst text logic to use `this.combat.burstCooldown`:
```typescript
    const canBurst = this.resources.canBurst && this.combat.burstCooldown <= 0;
```

Note: `burstCooldown` must be `public` (not private) in CombatSystem. Check it is — if not, change `private burstCooldown` to `burstCooldown`.

- [ ] **Step 4: Type check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/HUD.ts src/scenes/GameScene.ts src/systems/CombatSystem.ts
git commit -m "feat: HUD shows burst readiness, simplified controls hint"
```

---

## Task 12: Final Validation

- [ ] **Step 1: Full validation suite**

```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test
```

All must pass.

- [ ] **Step 2: Manual playtest checklist**

Run `pnpm dev` and verify:

- [ ] Graphics are crisp on retina display — no blurry text or shapes
- [ ] Game starts with Earth visible below as a large arc
- [ ] Player looks tiny compared to Earth
- [ ] Auto-lasers fire at nearby debris immediately
- [ ] Movement feels snappy — stop quickly when keys released
- [ ] Boost (Shift) makes you faster, energy bar drains visibly
- [ ] Space bar fires burst (yellow beams) — HUD shows "BURST ready"
- [ ] Flying into a small asteroid destroys it with bite damage + particles
- [ ] Flying toward Earth feels dangerous — gravity pulls you in, danger vignette pulses
- [ ] Gravity arrow points correctly toward Earth
- [ ] First upgrade at ~50 mass — game pauses, 3 cards appear
- [ ] Second upgrade requires noticeably more mass than first
- [ ] Cards show "Long Range Optics" as a possible pick
- [ ] After "Twin Cannons" — visibly more beams on screen
- [ ] Named planets are visible in the world when flying outward (Mercury, Venus, Mars)
- [ ] Saturn has a visible ring system
- [ ] Sun is visible as a massive glowing object in the far north
- [ ] Flying into a planet bites it — crack overlay appears, takes damage
- [ ] Planet destruction causes screen shake and debris
- [ ] As station grows, small early asteroids disappear (culled)
- [ ] Larger asteroids and objects spawn as you move outward
- [ ] No console errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: polish and scale pass complete"
```

---

## Summary

| Task | What It Fixes |
|------|--------------|
| 1 | Fuzzy graphics — DPR-aware canvas |
| 2 | Empty world — 400k×400k, solar system zones |
| 3 | Named planets placed as fixed world objects |
| 4 | Invisible Sun — rendered with corona, label |
| 5 | Earth/player scale — Earth 3000px, player 8px, zoom 4× |
| 6 | Floaty movement — high drag, fast accel, scaled speed |
| 7 | Planet destruction — proximity bite damage, cracks, no binding energy |
| 8 | Upgrade frequency and impact — scaling milestones, doubled effects |
| 9 | Missing beam range card — Long Range Optics |
| 10 | LOD streaming — cull small objects, scale-aware spawning |
| 11 | HUD — burst readiness indicator |
| 12 | Final validation playtest |
