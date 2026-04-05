# Feature: Start Screen with How to Play

> **For agentic workers:** Execute all steps in order.

**Goal:** Show a title screen when the game loads with the game name, a brief "how to play" section, and a start button. The game doesn't begin until the player presses start.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Create Start Screen

The start screen is shown before gameplay begins. `GameScene.create()` sets `isPaused = true` and shows the overlay. Pressing any button, clicking, or pressing Enter/Space/A dismisses it and starts the game.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add `showStartScreen` method**

Add this method to `GameScene`:

```typescript
  private showStartScreen(): void {
    this.isPaused = true;
    this.physics.world.pause();

    const { width, height } = this.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Dark overlay
    objects.push(
      this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
        .setScrollFactor(0)
        .setDepth(800)
    );

    // Title
    objects.push(
      this.add
        .text(width / 2, height * 0.2, "PLANET\nDESTROYER", {
          fontFamily: "monospace",
          fontSize: "56px",
          color: "#ffd93d",
          stroke: "#000",
          strokeThickness: 6,
          align: "center",
          lineSpacing: 8,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801)
    );

    // How to play
    const instructions = [
      "You are a tiny station orbiting Earth.",
      "Destroy debris to collect mass and grow.",
      "Earn upgrades as you consume more mass.",
      "Each tier makes you exponentially stronger.",
      "Escape orbit and devour every planet.",
      "Destroy the Sun to win.",
    ];

    objects.push(
      this.add
        .text(width / 2, height * 0.42, "HOW TO PLAY", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#6c63ff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801)
    );

    for (let i = 0; i < instructions.length; i++) {
      objects.push(
        this.add
          .text(width / 2, height * 0.42 + 30 + i * 22, instructions[i], {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#aaa",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(801)
      );
    }

    // Controls
    objects.push(
      this.add
        .text(width / 2, height * 0.72, "CONTROLS", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#6c63ff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801)
    );

    const controls = [
      "WASD / Left Stick ···· Move",
      "SPACE / A ············ Burst Fire",
      "SHIFT / RT ··········· Boost",
      "ESC / Start ·········· Settings",
    ];

    for (let i = 0; i < controls.length; i++) {
      objects.push(
        this.add
          .text(width / 2, height * 0.72 + 28 + i * 20, controls[i], {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#888",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(801)
      );
    }

    // Start prompt — pulses
    const startText = this.add
      .text(width / 2, height * 0.9, "Press any key or button to start", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#4ecdc4",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801);
    objects.push(startText);

    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Container for easy cleanup
    const container = this.add.container(0, 0, objects).setDepth(800);
    if (this.cameras.list.length > 1) {
      this.cameras.main.ignore(container);
    }

    // Dismiss on any input
    const dismiss = () => {
      container.destroy(true);
      this.isPaused = false;
      this.physics.world.resume();
      // Start music on first interaction (browser autoplay policy)
      this.audio.music.play("ambient");
    };

    // Keyboard — any key
    this.input.keyboard!.once("keydown", dismiss);

    // Mouse/touch
    this.input.once("pointerdown", dismiss);

    // Gamepad — any button
    if (this.input.gamepad) {
      this.input.gamepad.once("down", dismiss);
    }
  }
```

- [ ] **Step 2: Call `showStartScreen` at the end of `create()`**

At the very end of `create()`, after all setup is complete (after `this.cameras.main.setZoom(ZOOM_START)`), add:

```typescript
    this.showStartScreen();
```

- [ ] **Step 3: Remove the old `pointerdown` music trigger**

Find and delete this line in `create()` since the start screen now handles the first interaction:

```typescript
    // DELETE this line:
    this.input.once("pointerdown", () => this.audio.music.play("ambient"));
```

- [ ] **Step 4: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: start screen with title, how to play, controls, press any key to begin"
```
