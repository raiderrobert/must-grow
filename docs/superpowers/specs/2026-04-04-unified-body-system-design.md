# Unified Celestial Body System

**Date:** 2026-04-04
**Status:** Draft

## Problem

Earth has a complete hazard system (kill zone, atmosphere energy drain, vignette strobe, debug ring) built through iterative development. The 7 named planets (Mercury–Neptune) and the Sun lack all of these. Earth and Sun are also special-cased with hardcoded render functions in GameScene, while planets use a separate PlanetObject system. Bite damage is a legacy mechanic that should be removed in favor of beam/laser combat.

## Goals

1. Every celestial body uses the same data structure and code path
2. Every body has a kill zone at its visual surface, atmosphere warning band, energy drain, and vignette strobe
3. Visual rendering is composed from reusable primitives, not monolithic per-body functions
4. Bite damage is removed — all combat is beam/burst/drone
5. Destroyed planets fully disappear (gravity, visuals, kill zone all removed)
6. Smaller destructibles never spawn inside a planet's kill zone

## Design

### 1. Unified data model — `src/data/bodies.ts`

A single `BODY_DEFS: BodyDef[]` array defines all 9 celestial bodies (Sun, Earth, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune).

```typescript
interface BodyDef {
  name: string;
  distance: number;          // px from world center
  angle: number;             // radians
  visualRadius: number;      // display radius
  killRadius: number;        // always === visualRadius
  gravityMass: number;
  health: number;
  massYield: number;
  energyYield: number;
  visual: VisualPrimitive[];  // ordered list of render steps
}
```

`killRadius` equals `visualRadius` for all bodies. Having it explicit in the data means it can be tuned independently per body if needed later.

Earth and Sun are entries in this array — no special-casing in GameScene. Earth uses `distance: 3_200, angle: Math.PI / 2` (directly south of world center) matching its current position at `WORLD_CENTER_Y + 3_200`. Sun uses `distance: 240_000, angle: -Math.PI / 2` (directly north).

### 2. Render primitives — `src/entities/BodyRenderer.ts`

A set of composable functions that each draw onto a `Phaser.GameObjects.Graphics` at a given world position and radius. A single `renderBody(scene, def)` function iterates the `visual` array and calls each primitive in order.

```typescript
type VisualPrimitive =
  | { type: "atmosphereGlow"; layers: { radiusMult: number; color: number; alpha: number }[] }
  | { type: "solidBody"; color: number; alpha: number }
  | { type: "highlight"; offsetX: number; offsetY: number; radiusMult: number; alpha: number }
  | { type: "outline"; thicknessMult: number; color: number; alpha: number }
  | { type: "landmasses"; patches: { x: number; y: number; w: number; h: number; color: number; alpha: number }[] }
  | { type: "corona"; layers: { radiusMult: number; alpha: number }[] }
  | { type: "brightCore"; radiusMult: number; alpha: number }
  | { type: "rings"; layers: { widthMult: number; radiusMult: number; heightMult: number; color: number; alpha: number }[] }
  | { type: "surfaceBands"; bands: { yOffset: number; height: number; color: number; alpha: number }[] }
  | { type: "iceCap"; position: "north" | "south"; sizeMult: number; color: number; alpha: number }
  | { type: "spots"; patches: { x: number; y: number; r: number; color: number; alpha: number }[] };
```

Coordinates in patches/bands/spots are normalized (-1 to 1) relative to the body center and radius, so the same definition works at any scale.

### 3. Remove bite damage

Delete from codebase:
- `biteRadius` from `SpaceObjectConfig` interface and all planet config data
- `isInBiteRange()` from `SpaceObject`
- `updateBiteDamage()` from `CombatSystem`
- The `updateBiteDamage()` call in `CombatSystem.update()`

All planet destruction is now via beams (auto-fire), burst fire, and drones.

### 4. Kill zones + atmosphere effects on all bodies

No changes needed to `GravitySystem`. The existing code already:
- `isInLethalZone()` — loops all bodies with `killRadius`, instant death on contact
- `getApproachFactor()` — returns 0→1 proximity to nearest body with `killRadius`
- GameScene uses `getApproachFactor()` for energy drain (quadratic, up to 40/sec) and vignette strobe

Adding `killRadius` to each body's gravity entry is the only change needed. All 9 bodies automatically get atmosphere warnings, energy drain, and vignette effects.

### 5. Debug kill zone rings — generalized

Replace the Earth-specific debug ring code in `renderEarth()` with a loop in the body renderer (or GameScene) that draws a thin red ring at `killRadius` for every body when `DEBUG_KILL_ZONES` is true.

### 6. Destruction removes everything

When a body's SpaceObject health reaches 0:
- Call `gravity.removeBody()` to remove its gravity entry (kill zone + pull gone)
- Destroy the `Phaser.GameObjects.Graphics` holding its visual primitives
- Destroy the label text
- Remove SpaceObject from ZoneManager
- Standard explosion + debris spawn + mass/energy award
- Camera shake scaled to body size

After destruction, the space where the planet was is completely clear — safe to fly through, no residual gravity or hazard.

### 7. GameScene cleanup

Delete `renderEarth()` and `renderSun()` methods. Replace with a single loop in `create()`:

```typescript
for (const def of BODY_DEFS) {
  const { graphics, label } = renderBody(this, def);
  const spaceObj = createBodySpaceObject(this, def);
  const gravityBody = this.gravity.addBody({
    x, y, gravityMass: def.gravityMass, killRadius: def.killRadius
  });
  // Track graphics/label/gravityBody for cleanup on destruction
}
```

One code path for all 9 bodies.

### 8. Spawn exclusion zones

`ZoneManager.spawnInZone()` checks candidate spawn positions against all gravity bodies with `killRadius`. If the position falls inside any body's warning band (`killRadius * 1.2`), reject and retry. Cap at 5 retries per spawn attempt to avoid infinite loops when a large planet (Jupiter) fills most of a zone's area.

The `GravitySystem` (or its bodies list) is passed to `ZoneManager` at construction so it has access to the body positions and kill radii.

## Files changed

| File | Change |
|------|--------|
| `src/data/bodies.ts` | **New** — `BodyDef` interface, `BODY_DEFS` array for all 9 bodies |
| `src/entities/BodyRenderer.ts` | **New** — render primitive functions + `renderBody()` compositor |
| `src/entities/PlanetObject.ts` | **Delete** — replaced by bodies.ts + BodyRenderer |
| `src/entities/SpaceObject.ts` | Remove `biteRadius` from config, remove `isInBiteRange()` |
| `src/systems/CombatSystem.ts` | Remove `updateBiteDamage()` and its call in `update()` |
| `src/systems/ZoneManager.ts` | Add spawn exclusion check against gravity bodies |
| `src/scenes/GameScene.ts` | Delete `renderEarth()`, `renderSun()`. Single loop over `BODY_DEFS`. Track graphics/gravityBody per body for destruction cleanup. |
| `src/constants.ts` | Remove `EARTH_GRAVITY_MASS` (now in body def) |

## Out of scope

- Progression balancing (beam range/damage per tier vs planet health) — tune after implementation
- Planet-specific destruction animations beyond standard explosion + debris
- Planet health bars or damage indicators visible from range
