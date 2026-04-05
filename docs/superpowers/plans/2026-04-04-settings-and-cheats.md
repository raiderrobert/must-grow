# Feature: Settings Menu with Cheats

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pause menu accessible via ESC/Start button with a settings panel and a cheats section. Cheats let the player set tier, toggle god mode, teleport to planets, and more.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Create Settings Menu UI

A full-screen pause overlay with a panel of clickable/keyboard-navigable options. Opens with ESC (keyboard) or Start button (gamepad, button 9). Closes with the same button or a "Resume" option.

**Files:**
- Create: `src/ui/SettingsMenu.ts`
- Modify: `src/systems/InputManager.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add menu toggle to InputManager**

In `src/systems/InputManager.ts`, add a one-shot flag for menu toggle (same pattern as `consumeAttack`):

```typescript
  private _menuJustPressed: boolean = false;
```

Add a key in the constructor:

```typescript
    this.menuKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
```

Add the field declaration:

```typescript
  private menuKey: Phaser.Input.Keyboard.Key;
```

In `update()`, check for menu key:

```typescript
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this._menuJustPressed = true;
    }
```

Add gamepad Start button (button 9) in the existing gamepad `"down"` handler:

```typescript
          if (button.index === 9) this._menuJustPressed = true;
```

Add the consume method:

```typescript
  consumeMenuToggle(): boolean {
    const pressed = this._menuJustPressed;
    this._menuJustPressed = false;
    return pressed;
  }
```

- [ ] **Step 2: Create `src/ui/SettingsMenu.ts`**

```typescript
import Phaser from "phaser";

export interface CheatCallbacks {
  setTier: (tier: number) => void;
  toggleGodMode: () => boolean;        // returns new state
  toggleInfiniteEnergy: () => boolean;  // returns new state
  teleportToPlanet: (name: string) => void;
  killAllDebris: () => void;
  setSpeedMultiplier: (mult: number) => void;
  spawnDebrisHere: () => void;
  destroyPlanet: (name: string) => void;
  getPlanetNames: () => string[];       // returns names of surviving planets
}

export class SettingsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private cheats: CheatCallbacks;
  private mainCam: Phaser.Cameras.Scene2D.Camera | null = null;

  // Cheat state
  private godMode: boolean = false;
  private infiniteEnergy: boolean = false;
  private currentSpeedMult: number = 1;

  constructor(scene: Phaser.Scene, cheats: CheatCallbacks) {
    this.scene = scene;
    this.cheats = cheats;
  }

  setMainCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCam = cam;
  }

  get visible(): boolean { return this.isVisible; }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.build();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.container?.destroy();
    this.container = null;
  }

  private build(): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Dark overlay
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setScrollFactor(0)
      .setDepth(700)
      .setInteractive(); // block clicks through to game
    objects.push(overlay);

    // Panel background
    const panelW = 400;
    const panelH = 500;
    const panelX = width / 2;
    const panelY = height / 2;
    objects.push(
      this.scene.add
        .rectangle(panelX, panelY, panelW, panelH, 0x111133, 0.95)
        .setStrokeStyle(2, 0x6c63ff, 0.6)
        .setScrollFactor(0)
        .setDepth(701)
    );

    // Title
    objects.push(
      this.scene.add.text(panelX, panelY - panelH / 2 + 20, "SETTINGS", {
        fontFamily: "monospace", fontSize: "22px", color: "#fff",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(702)
    );

    // Resume button
    objects.push(this.makeButton(panelX, panelY - panelH / 2 + 60, "Resume [ESC]", () => this.hide()));

    // ── Cheats section ──
    objects.push(
      this.scene.add.text(panelX, panelY - panelH / 2 + 100, "── CHEATS ──", {
        fontFamily: "monospace", fontSize: "12px", color: "#ffd93d",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(702)
    );

    let y = panelY - panelH / 2 + 130;
    const spacing = 32;

    // Set Tier
    for (let t = 1; t <= 5; t++) {
      objects.push(this.makeButton(
        panelX - 100 + (t - 1) * 50, y, `T${t}`,
        () => { this.cheats.setTier(t); this.rebuild(); }
      ));
    }
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Set Tier:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    y += spacing;

    // God Mode toggle
    objects.push(this.makeButton(panelX, y,
      `God Mode: ${this.godMode ? "ON" : "OFF"}`,
      () => { this.godMode = this.cheats.toggleGodMode(); this.rebuild(); }
    ));
    y += spacing;

    // Infinite Energy toggle
    objects.push(this.makeButton(panelX, y,
      `Infinite Energy: ${this.infiniteEnergy ? "ON" : "OFF"}`,
      () => { this.infiniteEnergy = this.cheats.toggleInfiniteEnergy(); this.rebuild(); }
    ));
    y += spacing;

    // Teleport to planet
    const planets = this.cheats.getPlanetNames();
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Teleport:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    const teleportPerRow = 3;
    for (let i = 0; i < planets.length; i++) {
      const col = i % teleportPerRow;
      const row = Math.floor(i / teleportPerRow);
      objects.push(this.makeButton(
        panelX - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.teleportToPlanet(planets[i]); this.hide(); },
        "10px"
      ));
    }
    y += Math.ceil(planets.length / teleportPerRow) * 24 + 10;

    // Kill all debris
    objects.push(this.makeButton(panelX, y, "Kill All Debris", () => {
      this.cheats.killAllDebris();
    }));
    y += spacing;

    // Speed multiplier
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Game Speed:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (const mult of [1, 2, 5, 10]) {
      objects.push(this.makeButton(
        panelX - 80 + [1, 2, 5, 10].indexOf(mult) * 55, y,
        `${mult}x${mult === this.currentSpeedMult ? " ●" : ""}`,
        () => { this.currentSpeedMult = mult; this.cheats.setSpeedMultiplier(mult); this.rebuild(); },
        "10px"
      ));
    }
    y += spacing;

    // Spawn debris here
    objects.push(this.makeButton(panelX, y, "Spawn 100 Debris Here", () => {
      this.cheats.spawnDebrisHere();
    }));
    y += spacing;

    // Destroy planet
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Destroy:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (let i = 0; i < planets.length; i++) {
      const col = i % teleportPerRow;
      const row = Math.floor(i / teleportPerRow);
      objects.push(this.makeButton(
        panelX - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.destroyPlanet(planets[i]); this.rebuild(); },
        "10px"
      ));
    }

    this.container = this.scene.add.container(0, 0, objects).setDepth(700);
    if (this.mainCam) {
      this.mainCam.ignore(this.container);
    }
  }

  private rebuild(): void {
    this.container?.destroy();
    this.container = null;
    this.build();
  }

  private makeButton(
    x: number, y: number, label: string,
    onClick: () => void, fontSize: string = "12px"
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize,
        color: "#4ecdc4",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(703)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#fff"));
    btn.on("pointerout", () => btn.setColor("#4ecdc4"));
    btn.on("pointerdown", onClick);

    return btn;
  }
}
```

- [ ] **Step 3: Wire SettingsMenu into GameScene**

In `src/scenes/GameScene.ts`, add import:

```typescript
import { SettingsMenu, type CheatCallbacks } from "@/ui/SettingsMenu";
```

Add field:

```typescript
  settingsMenu!: SettingsMenu;
  private godMode: boolean = false;
  private infiniteEnergy: boolean = false;
  private gameSpeedMult: number = 1;
```

In `create()`, after creating the HUD and other UI, create the settings menu with cheat callbacks:

```typescript
    this.settingsMenu = new SettingsMenu(this, {
      setTier: (tier: number) => {
        this.currentTier = tier;
        this.player.tier = tier;
        this.triggerEvolution(tier);
      },
      toggleGodMode: () => {
        this.godMode = !this.godMode;
        return this.godMode;
      },
      toggleInfiniteEnergy: () => {
        this.infiniteEnergy = !this.infiniteEnergy;
        return this.infiniteEnergy;
      },
      teleportToPlanet: (name: string) => {
        const body = this.trackedBodies.find(tb => tb.name === name);
        if (!body) return;
        const killR = body.gravityBody.killRadius ?? 0;
        this.player.body.setPosition(body.gravityBody.x, body.gravityBody.y - killR - 2000);
        // Match the body's velocity so we don't get left behind
        const vel = this.getBodyVelocity(name);
        this.player.body.setVelocity(vel.vx, vel.vy);
      },
      killAllDebris: () => {
        for (const obj of this.zones.getObjects()) {
          if (!obj.sprite.getData("fixed")) {
            this.zones.removeObject(obj);
          }
        }
      },
      setSpeedMultiplier: (mult: number) => {
        this.gameSpeedMult = mult;
      },
      spawnDebrisHere: () => {
        this.spawnDebrisBelt("Earth", 100, 500, 5_000);
        // Actually spawn around the player's current position instead
        // Use a quick inline spawn
        for (let i = 0; i < 100; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 200 + Math.random() * 2000;
          const x = this.player.x + Math.cos(angle) * dist;
          const y = this.player.y + Math.sin(angle) * dist;
          const size = 20 + Math.random() * 50;
          const colors = [0x888888, 0x666666, 0x8b7355, 0xa0926b];
          const obj = new SpaceObject(this, {
            x, y, size,
            health: 10 + size,
            massYield: Math.floor(size * 0.3),
            energyYield: Math.floor(size * 0.1),
            gravityMass: 0,
            color: colors[Math.floor(Math.random() * colors.length)],
            velocityX: this.player.body.body!.velocity.x,
            velocityY: this.player.body.body!.velocity.y,
          });
          this.zones.addFixedObject(obj);
        }
      },
      destroyPlanet: (name: string) => {
        const tracked = this.trackedBodies.find(tb => tb.name === name);
        if (!tracked) return;
        this.combat.createExplosionAt(tracked.spaceObj.sprite.x, tracked.spaceObj.sprite.y, tracked.spaceObj.config.color);
        this.resources.addMass(tracked.spaceObj.config.massYield);
        this.zones.removeObject(tracked.spaceObj);
        this.onBodyDestroyed(tracked);
      },
      getPlanetNames: () => {
        return this.trackedBodies.map(tb => tb.name);
      },
    });
    this.settingsMenu.setMainCamera(this.cameras.main);
```

Note: `createExplosionAt` may not exist as a public method on `CombatSystem`. If not, the implementing agent should either make `createExplosion` public or inline the explosion particles.

- [ ] **Step 4: Toggle menu in update loop**

In `update()`, right after `this.inputManager.update()`, add:

```typescript
    if (this.inputManager.consumeMenuToggle()) {
      this.settingsMenu.toggle();
      if (this.settingsMenu.visible) {
        this.isPaused = true;
        this.physics.world.pause();
      } else {
        this.isPaused = false;
        this.physics.world.resume();
      }
      return;
    }
```

- [ ] **Step 5: Apply god mode and infinite energy in update loop**

In `update()`, after the gravity death check:

```typescript
    // Cheat: god mode — skip death
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      if (!this.godMode) {
        this.handleDeath();
      }
    }
```

Replace the existing death check with the above (wrap it in the `!this.godMode` guard).

After the energy regen section:

```typescript
    // Cheat: infinite energy
    if (this.infiniteEnergy) {
      this.resources.energy = this.resources.batteryCapacity;
    }
```

- [ ] **Step 6: Apply game speed multiplier**

At the top of `update()`, scale delta:

```typescript
    delta *= this.gameSpeedMult;
```

This makes everything run faster — orbits, gravity, spawning, cooldowns.

- [ ] **Step 7: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: May need to make `createExplosion` public on `CombatSystem`, or add a public `createExplosionAt(x, y, color)` wrapper. Fix as needed.

- [ ] **Step 8: Commit**

```bash
git add src/ui/SettingsMenu.ts src/systems/InputManager.ts src/scenes/GameScene.ts
git commit -m "feat: settings menu with cheats — set tier, god mode, teleport, speed, destroy planet"
```
