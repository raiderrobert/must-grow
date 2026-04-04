# Gamepad Input & Visibility Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mouse-based gameplay input with controller-first button mashing, fix starfield visual confusion, render Earth visibly in the world, and add a gravity direction indicator with screen-edge danger warning.

**Architecture:** Three areas of change: (1) input rework — CombatSystem loses its mouse handler, PlayerStation gains attack/power keys and gamepad polling, GameScene.update() orchestrates the new button actions; (2) visual clarity — starfield stars shrunk, Earth rendered as a background circle, gravity arrow drawn on station; (3) danger feedback — screen-edge vignette that pulses red near kill zones. No new files needed — all changes are in existing files.

**Tech Stack:** Phaser 3, TypeScript, pnpm, vitest

**Spec:** `docs/superpowers/specs/2026-04-04-planet-destroyer-design.md` (controller-first input section discussed in chat)

**Pre-commit validation:** Run before every commit:
```bash
pnpm exec tsc --noEmit && pnpm test
```

---

## File Changes Summary

| File | What Changes |
|------|-------------|
| `src/systems/CombatSystem.ts` | Remove `pointerdown` mouse handler from constructor; remove `handleClick()`; add public `attackPressed()` method |
| `src/entities/PlayerStation.ts` | Add `attackKey` (Space), `powerKey` (K), `upgradeKey` (Tab/E); add gamepad polling (left stick, A, B, Start); expose `consumeAttack()` and `consumePower()` |
| `src/scenes/GameScene.ts` | Call `combat.attackPressed()` / `resources.manualGenerate()` from attack/power inputs; add Earth circle rendering; add gravity arrow; add danger vignette |
| `src/entities/Starfield.ts` | Reduce foreground star sizes to max 0.5px, dim all layers |
| `src/ui/GeneratorButton.ts` | Remove interactive click; repurpose as a static HUD hint label showing `[K] POWER` |
| `src/ui/HUD.ts` | Update GeneratorButton usage to pass no-op (button is now display-only) |

---

## Task 1: Fix Starfield — Stars Must Not Look Like Targets

**Problem:** The brightest starfield layer has stars up to 2px radius at 0.8 alpha. Small space objects are 6–10px. The visual overlap causes player confusion.

**Files:**
- Modify: `src/entities/Starfield.ts`

- [ ] **Step 1: Shrink and dim all three starfield layers**

Replace the `layerConfigs` array in `src/entities/Starfield.ts` (currently lines 12–16):

```typescript
  const layerConfigs = [
    { count: 60, size: 0.5, alpha: 0.15, scrollFactor: 0.05 },
    { count: 40, size: 0.5, alpha: 0.25, scrollFactor: 0.15 },
    { count: 25, size: 0.75, alpha: 0.40, scrollFactor: 0.4 },
  ];
```

Key changes:
- Max star size drops from 2px to 0.75px — well below the 6px minimum target size
- Alpha on the brightest layer drops from 0.8 to 0.40 — clearly background, not interactive
- More stars at smaller sizes keeps the field feeling dense

- [ ] **Step 2: Verify type check and tests still pass**

```bash
pnpm exec tsc --noEmit && pnpm test
```

Expected: no errors, all tests pass.

- [ ] **Step 3: Run dev and visually verify**

```bash
pnpm dev
```

Open the game. Stars should look like distant background points, not clickable objects. Space junk (6-10px circles with glow) should be clearly distinct.

- [ ] **Step 4: Commit**

```bash
git add src/entities/Starfield.ts
git commit -m "fix: shrink starfield stars so they don't look like game targets"
```

---

## Task 2: Render Visible Earth in the World

**Problem:** Earth's gravity body exists at `(WORLD_WIDTH/2, WORLD_HEIGHT/2 + 600)` but renders as nothing. Players get pulled toward an invisible object and die with no context.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add a renderEarth() helper method to GameScene**

Add this method to the `GameScene` class in `src/scenes/GameScene.ts`, before the `update()` method:

```typescript
private renderEarth(): void {
  const earthX = WORLD_WIDTH / 2;
  const earthY = WORLD_HEIGHT / 2 + 600;
  const radius = 180;

  const g = this.add.graphics();
  g.setDepth(-3);

  // Outer atmosphere glow
  g.fillStyle(0x1a3a5c, 0.3);
  g.fillCircle(earthX, earthY, radius + 30);

  // Ocean base
  g.fillStyle(0x1a4a8a, 0.9);
  g.fillCircle(earthX, earthY, radius);

  // Land masses (rough approximation — just irregular blobs for feel)
  g.fillStyle(0x2d6e2d, 0.85);
  g.fillEllipse(earthX - 40, earthY - 30, 90, 70);
  g.fillEllipse(earthX + 50, earthY + 20, 70, 80);
  g.fillEllipse(earthX - 20, earthY + 50, 60, 40);

  // Cloud layer
  g.fillStyle(0xffffff, 0.15);
  g.fillCircle(earthX, earthY, radius);

  // Thin outline
  g.lineStyle(2, 0x4488cc, 0.4);
  g.strokeCircle(earthX, earthY, radius);

  // Label
  this.add.text(earthX, earthY + radius + 20, "Earth", {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#4488cc",
    alpha: 0.6,
  }).setOrigin(0.5).setDepth(-3);
}
```

- [ ] **Step 2: Call renderEarth() in create(), after gravity bodies are added**

In `GameScene.create()`, after the line `this.gravity.initGraphics(this);`, add:

```typescript
this.renderEarth();
```

- [ ] **Step 3: Verify type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run dev and verify Earth is visible**

```bash
pnpm dev
```

Earth should be visible below the starting position — a blue-green circle with faint land masses. When gravity pulls the player down they should be able to see what they're being pulled toward.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: render Earth as visible background object at gravity body position"
```

---

## Task 3: Gravity Direction Indicator + Screen-Edge Danger Warning

**Problem:** Players don't know which direction gravity is pulling them until they're already dying. Need: (1) an arrow on the station showing pull direction, (2) screen edge glow that warns before the kill zone.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add gravityIndicatorGraphics field to GameScene**

Add a field to the `GameScene` class:

```typescript
private gravityIndicatorGraphics!: Phaser.GameObjects.Graphics;
private dangerVignette!: Phaser.GameObjects.Graphics;
```

- [ ] **Step 2: Initialize both graphics objects in create()**

Add to the end of `GameScene.create()`:

```typescript
this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);

// Vignette is in screen-space (scrollFactor 0), so use a fixed camera UI graphics
this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);
```

- [ ] **Step 3: Add updateGravityIndicator() method to GameScene**

Add this method to the `GameScene` class:

```typescript
private updateGravityIndicator(): void {
  this.gravityIndicatorGraphics.clear();

  const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
  if (pull.magnitude < 0.1) return;

  // Normalize pull direction
  const nx = pull.x / pull.magnitude;
  const ny = pull.y / pull.magnitude;

  // Danger level drives color
  let color = 0x4488cc; // blue = mild pull
  let alpha = 0.6;
  let arrowLength = 20;

  for (const body of this.gravity.getBodies()) {
    const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
    if (level === "deadly") {
      color = 0xff4444;
      alpha = 1.0;
      arrowLength = 28;
      break;
    } else if (level === "warning") {
      color = 0xffaa44;
      alpha = 0.85;
      arrowLength = 24;
    }
  }

  // Arrow starts at player edge, points in pull direction
  const startDist = this.player.size + 4;
  const sx = this.player.x + nx * startDist;
  const sy = this.player.y + ny * startDist;
  const ex = sx + nx * arrowLength;
  const ey = sy + ny * arrowLength;

  // Arrow shaft
  this.gravityIndicatorGraphics.lineStyle(2, color, alpha);
  this.gravityIndicatorGraphics.lineBetween(sx, sy, ex, ey);

  // Arrow head
  const headSize = 5;
  const angle = Math.atan2(ny, nx);
  const spread = Math.PI * 0.7;
  this.gravityIndicatorGraphics.fillStyle(color, alpha);
  const tip = new Phaser.Geom.Point(ex, ey);
  const left = new Phaser.Geom.Point(
    ex - Math.cos(angle - spread) * headSize,
    ey - Math.sin(angle - spread) * headSize
  );
  const right = new Phaser.Geom.Point(
    ex - Math.cos(angle + spread) * headSize,
    ey - Math.sin(angle + spread) * headSize
  );
  this.gravityIndicatorGraphics.fillTriangle(
    tip.x, tip.y,
    left.x, left.y,
    right.x, right.y
  );
}
```

- [ ] **Step 4: Add updateDangerVignette() method to GameScene**

```typescript
private updateDangerVignette(): void {
  this.dangerVignette.clear();

  // Find worst danger level across all bodies
  let worstLevel: import("@/systems/GravitySystem").DangerLevel = "safe";
  for (const body of this.gravity.getBodies()) {
    const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
    if (level === "deadly") { worstLevel = "deadly"; break; }
    if (level === "warning") worstLevel = "warning";
  }

  if (worstLevel === "safe") return;

  const w = this.scale.width;
  const h = this.scale.height;
  const pulse = (Math.sin(this.time.now / (worstLevel === "deadly" ? 150 : 400)) + 1) / 2;
  const baseAlpha = worstLevel === "deadly" ? 0.25 : 0.10;
  const alpha = baseAlpha + pulse * (worstLevel === "deadly" ? 0.15 : 0.06);
  const color = worstLevel === "deadly" ? 0xff2222 : 0xff8800;

  // Draw four edge rectangles to simulate vignette
  const edgeSize = Math.floor(Math.min(w, h) * 0.12);
  this.dangerVignette.fillStyle(color, alpha);
  this.dangerVignette.fillRect(0, 0, w, edgeSize);            // top
  this.dangerVignette.fillRect(0, h - edgeSize, w, edgeSize); // bottom
  this.dangerVignette.fillRect(0, 0, edgeSize, h);            // left
  this.dangerVignette.fillRect(w - edgeSize, 0, edgeSize, h); // right
}
```

- [ ] **Step 5: Call both updaters in GameScene.update()**

At the end of `GameScene.update()`, after `this.gravity.renderDangerZones(...)`, add:

```typescript
this.updateGravityIndicator();
this.updateDangerVignette();
```

- [ ] **Step 6: Verify type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run dev and verify visually**

```bash
pnpm dev
```

- An arrow should appear just outside the station pointing toward Earth (downward at start)
- Arrow turns orange then red as you drift closer
- Screen edges pulse orange/red when you enter the warning/deadly zone

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: add gravity direction arrow and screen-edge danger vignette"
```

---

## Task 4: Remove Mouse-Based Gameplay Input

**Problem:** Clicking to attack requires mouse precision on small targets. Power generation requires clicking a specific HUD button. Both feel wrong for a controller-first arcade game.

**Files:**
- Modify: `src/systems/CombatSystem.ts`
- Modify: `src/ui/GeneratorButton.ts`

- [ ] **Step 1: Remove the pointerdown listener from CombatSystem constructor**

In `src/systems/CombatSystem.ts`, remove these lines from the constructor (currently around lines 71–73):

```typescript
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleClick(pointer);
    });
```

- [ ] **Step 2: Remove the handleClick() method from CombatSystem**

Delete the entire `handleClick()` method (currently lines 84–155). It will be replaced by `attackPressed()` in the next task.

- [ ] **Step 3: Add public attackPressed() method to CombatSystem**

Add this method to `CombatSystem`, after the `releaseClamp()` method:

```typescript
/** Called when the player presses the attack button. */
attackPressed(): void {
  if (this.clampedTarget) {
    // Already clamped — chew
    this.chew();
    return;
  }

  if (this.player.tier === 1) {
    // Tier 1: find nearest object in clamp range and clamp it
    const objects = this.zones.getObjects();
    let nearest: SpaceObject | null = null;
    let nearestDist = this.clampRange;

    for (const obj of objects) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        obj.sprite.x, obj.sprite.y
      );
      if (dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    if (nearest) {
      this.clampedTarget = nearest;
      nearest.isBeingChewed = true;
      const reducedClicks = Math.max(
        Math.ceil(nearest.chewClicksRemaining / this.chewSpeedMultiplier),
        1
      );
      nearest.chewClicksRemaining = reducedClicks;
      this.chew();
    }
  } else {
    // Tier 2+: fire beam at nearest object in range
    if (this.beamCooldown > 0) return;

    const objects = this.zones.getObjects();
    let nearest: SpaceObject | null = null;
    let nearestDist = this.beamRange;

    for (const obj of objects) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        obj.sprite.x, obj.sprite.y
      );
      if (dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    if (nearest) {
      this.fireBeam(nearest);
    }
  }
}
```

- [ ] **Step 4: Make GeneratorButton non-interactive (display-only)**

Replace the entire contents of `src/ui/GeneratorButton.ts` with a display-only version that shows the key hint but has no click interaction:

```typescript
import Phaser from "phaser";
import { COLORS } from "@/constants";

/** Displays a hint showing the power key — no longer interactive (use K or gamepad B). */
export class GeneratorButton {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    const bg = scene.add
      .rectangle(0, 0, 130, 40, COLORS.energy, 0.15)
      .setStrokeStyle(1, COLORS.energy, 0.4);

    const label = scene.add
      .text(0, 0, "⚡ [K] POWER", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd93d",
        alpha: 0.7,
      })
      .setOrigin(0.5);

    const container = scene.add.container(x, y, [bg, label]);
    container.setScrollFactor(0);
    container.setDepth(100);
  }

  // No-op — kept so HUD constructor doesn't need changing
  setAudio(_audio: unknown): void {}
}
```

- [ ] **Step 5: Verify type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/systems/CombatSystem.ts src/ui/GeneratorButton.ts
git commit -m "feat: remove mouse attack/power input — replace with attackPressed() API"
```

---

## Task 5: Add Attack and Power Keys + Gamepad Support to PlayerStation

**Problem:** There's no attack or power key yet. PlayerStation needs Space/J for attack, K for power, and gamepad support for all movement + buttons.

**Files:**
- Modify: `src/entities/PlayerStation.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add input fields to PlayerStation**

In `src/entities/PlayerStation.ts`, add new fields after the `wasd` block:

```typescript
private attackKeys: Phaser.Input.Keyboard.Key[];
private powerKey: Phaser.Input.Keyboard.Key;
private upgradeKey: Phaser.Input.Keyboard.Key;
private pad: Phaser.Input.Gamepad.Gamepad | null = null;

// One-shot flags consumed by GameScene each frame
private _attackConsumed: boolean = false;
private _powerConsumed: boolean = false;
private _upgradeConsumed: boolean = false;
```

- [ ] **Step 2: Register keys in the PlayerStation constructor**

In the `constructor`, after the `wasd` block (after line 59 in original), add:

```typescript
    this.attackKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
    ];
    this.powerKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.upgradeKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Enable gamepad support if available
    if (scene.input.gamepad) {
      scene.input.gamepad.once("connected", (pad: Phaser.Input.Gamepad.Gamepad) => {
        this.pad = pad;
      });
    }
```

- [ ] **Step 3: Add gamepad movement to update()**

At the start of the `update()` method in `PlayerStation`, before the `isLocked` guard, add gamepad stick reading:

```typescript
  update(_delta: number): void {
    // Refresh gamepad reference each frame (it may connect after scene start)
    if (!this.pad && this.scene.input.gamepad?.total > 0) {
      this.pad = this.scene.input.gamepad.getPad(0);
    }
```

Then, in the horizontal/vertical movement section, extend each branch to include gamepad stick:

Replace the horizontal movement block:
```typescript
    // Horizontal — keyboard or left stick
    const stickX = this.pad?.axes[0]?.getValue() ?? 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown || stickX < -0.2) {
      this.body.setAccelerationX(-accel * Math.max(Math.abs(stickX), 1));
    } else if (this.cursors.right.isDown || this.wasd.D.isDown || stickX > 0.2) {
      this.body.setAccelerationX(accel * Math.max(Math.abs(stickX), 1));
    } else {
      this.body.setAccelerationX(0);
    }
```

Replace the vertical movement block:
```typescript
    // Vertical — keyboard or left stick
    const stickY = this.pad?.axes[1]?.getValue() ?? 0;
    if (this.cursors.up.isDown || this.wasd.W.isDown || stickY < -0.2) {
      this.body.setAccelerationY(-accel * Math.max(Math.abs(stickY), 1));
    } else if (this.cursors.down.isDown || this.wasd.S.isDown || stickY > 0.2) {
      this.body.setAccelerationY(accel * Math.max(Math.abs(stickY), 1));
    } else {
      this.body.setAccelerationY(0);
    }
```

Replace the thrust particle check to include sticks:
```typescript
    const isThrusting =
      this.cursors.up.isDown || this.wasd.W.isDown ||
      this.cursors.down.isDown || this.wasd.S.isDown ||
      this.cursors.left.isDown || this.wasd.A.isDown ||
      this.cursors.right.isDown || this.wasd.D.isDown ||
      Math.abs(this.pad?.axes[0]?.getValue() ?? 0) > 0.2 ||
      Math.abs(this.pad?.axes[1]?.getValue() ?? 0) > 0.2;
```

- [ ] **Step 4: Add consumeAttack(), consumePower(), consumeUpgrade() to PlayerStation**

Add these methods after the `update()` method:

```typescript
  /** Returns true if attack was pressed this frame (keyboard or gamepad A). Clears the flag. */
  consumeAttack(): boolean {
    const keyJustDown = this.attackKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
    // Gamepad button 0 = A (Xbox) / Cross (PS)
    const padJustDown = this.pad != null && this.pad.buttons[0] != null &&
      this.pad.buttons[0].justDown === true;
    return keyJustDown || padJustDown;
  }

  /** Returns true if power key was pressed this frame (keyboard K or gamepad B). Clears the flag. */
  consumePower(): boolean {
    const keyJustDown = Phaser.Input.Keyboard.JustDown(this.powerKey);
    // Gamepad button 1 = B (Xbox) / Circle (PS)
    const padJustDown = this.pad != null && this.pad.buttons[1] != null &&
      this.pad.buttons[1].justDown === true;
    return keyJustDown || padJustDown;
  }

  /** Returns true if upgrade menu key was pressed this frame (E or gamepad Start). */
  consumeUpgradeToggle(): boolean {
    const keyJustDown = Phaser.Input.Keyboard.JustDown(this.upgradeKey);
    // Gamepad button 9 = Start (Xbox) / Options (PS)
    const padJustDown = this.pad != null && this.pad.buttons[9] != null &&
      this.pad.buttons[9].justDown === true;
    return keyJustDown || padJustDown;
  }
```

- [ ] **Step 5: Wire consumeAttack() and consumePower() in GameScene.update()**

In `GameScene.update()`, after the player movement step (after `this.player.update(delta)`), add:

```typescript
    // Attack button — clamp/chew (Tier 1) or fire beam (Tier 2+)
    if (this.player.consumeAttack()) {
      this.combat.attackPressed();
    }

    // Power button — manual energy generation
    if (this.player.consumePower()) {
      this.resources.manualGenerate();
      this.audio.play("sfx_power_up");
    }

    // Upgrade menu toggle
    if (this.player.consumeUpgradeToggle()) {
      this.shop.toggle();
    }
```

- [ ] **Step 6: Add toggle() method to UpgradeShop**

In `src/ui/UpgradeShop.ts`, add a public `toggle()` method:

```typescript
  toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.setVisible(this.isOpen);
    if (this.isOpen) this.rebuild();
  }
```

- [ ] **Step 7: Update HUD constructor — GeneratorButton no longer takes audio**

In `src/ui/HUD.ts`, the `GeneratorButton` constructor no longer takes `resources` as a parameter. Update the instantiation in the `HUD` constructor:

Find this block (around line 31–36):
```typescript
    this.generatorButton = new GeneratorButton(
      scene,
      80,
      scene.scale.height - 40,
      resources
    );
```

Replace with:
```typescript
    this.generatorButton = new GeneratorButton(
      scene,
      80,
      scene.scale.height - 40,
    );
```

Also remove the `setAudio` call on `generatorButton` since it's now a no-op anyway — but leaving it is also fine since the method signature accepts `unknown`.

- [ ] **Step 8: Verify type check and tests**

```bash
pnpm exec tsc --noEmit && pnpm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 9: Run dev and test the full input rework**

```bash
pnpm dev
```

Verify:
- WASD moves the player as before
- Space or J key: finds nearest object in range and clamps/chews (Tier 1) or fires beam (Tier 2+)
- K key: generates power (energy bar increases), plays `sfx_power_up`
- E key: toggles upgrade panel open/close
- If a gamepad is connected: left stick moves, A button attacks, B button powers, Start opens upgrades
- No mouse clicking is needed for any gameplay action (upgrade shop mouse-click still works for browsing)

- [ ] **Step 10: Commit**

```bash
git add src/entities/PlayerStation.ts src/scenes/GameScene.ts src/ui/UpgradeShop.ts src/ui/HUD.ts
git commit -m "feat: controller-first input — Space/J attack, K power, E upgrades, gamepad support"
```

---

## Task 6: Add Controls Hint to HUD

**Problem:** New players won't know the key bindings. A small controls legend in the corner prevents confusion.

**Files:**
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Add a controls hint text to the HUD constructor**

At the end of the `HUD` constructor, after the mute button block, add:

```typescript
    scene.add.text(scene.scale.width / 2, scene.scale.height - 16,
      "WASD move  ·  SPACE/J attack  ·  K power  ·  E upgrades",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#666",
        alpha: 0.7,
      }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
```

- [ ] **Step 2: Verify type check**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/HUD.ts
git commit -m "feat: add controls hint bar at bottom of HUD"
```

---

## Final Validation

- [ ] **Run full validation suite**

```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test
```

All must pass.

- [ ] **Manual playtest checklist**

Run `pnpm dev` and verify:

- [ ] Stars are clearly background — tiny, dim, no confusion with game objects
- [ ] Earth is visible below starting position — blue-green circle with label
- [ ] Gravity arrow appears on the station pointing toward Earth at game start
- [ ] Arrow turns orange then red as you drift toward Earth
- [ ] Screen edges pulse orange/red when near Earth
- [ ] Space or J attacks the nearest object — no mouse precision needed
- [ ] K generates power — energy bar increases, sound plays
- [ ] E toggles the upgrade shop
- [ ] Gamepad left stick moves the player (if controller available)
- [ ] Gamepad A attacks, B powers, Start opens upgrades (if controller available)
- [ ] Mashing Space/J while clamped chews the target
- [ ] HUD shows controls hint at the bottom
