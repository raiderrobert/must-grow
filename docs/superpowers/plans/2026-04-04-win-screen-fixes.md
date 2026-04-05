# Fix: Win Screen — No Upgrade Overlay, Add Restart Button and Fanfare

> **For agentic workers:** Execute all steps in order.

**Goal:** When the player wins: dismiss any open upgrade screen, show a clean win screen with fanfare effects, and a restart button. No upgrade cards showing behind.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The win screen shows on top of an open upgrade screen (screenshot shows upgrade cards behind the "YOU WIN" text). The upgrade triggered at the same milestone that destroyed the last planet. The win screen needs to dismiss the upgrade screen first, and include a restart button.

---

### Task 1: Dismiss Upgrade Screen on Win

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Close upgrade screen before showing win screen**

In `showWinScreen()`, at the very top before any win screen UI is created, dismiss the upgrade screen if it's open:

```typescript
  private showWinScreen(): void {
    // Dismiss upgrade screen if it was showing
    if (this.upgradeScreen) {
      this.upgradeScreen.forceClose();
    }

    this.isPaused = true;
    this.physics.world.pause();
```

- [ ] **Step 2: Add `forceClose` to UpgradeScreen**

In `src/ui/UpgradeScreen.ts`, add a method that closes without picking a card:

```typescript
  forceClose(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    for (const key of this.keyObjects) key.removeAllListeners();
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.cardBackgrounds = [];
    this.currentCards = [];
    this.keyObjects = [];
    this.container?.destroy();
    this.container = null;
    // Don't call onClose — the win screen handles the unpause
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts src/ui/UpgradeScreen.ts
git commit -m "fix: dismiss upgrade screen before showing win screen"
```

---

### Task 2: Add Restart Button and Fanfare to Win Screen

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Rewrite `showWinScreen` with fanfare and restart**

Replace the existing `showWinScreen()` method:

```typescript
  private showWinScreen(): void {
    // Dismiss upgrade screen if open
    if (this.upgradeScreen) {
      this.upgradeScreen.forceClose();
    }

    this.isPaused = true;
    this.physics.world.pause();

    const { width, height } = this.scale;

    // ── Fanfare ──
    // Screen flash
    this.cameras.main.flash(1000, 255, 215, 0); // gold flash

    // Big camera shake
    this.cameras.main.shake(2000, 0.015);

    // Play tier-up sound (best we have for celebration)
    this.audio.play("sfx_tier_up");

    // Explosion particles across the screen
    for (let i = 0; i < 8; i++) {
      const px = width * 0.2 + Math.random() * width * 0.6;
      const py = height * 0.2 + Math.random() * height * 0.6;
      const colors = [0xffd93d, 0xff6b6b, 0x6c63ff, 0x4ecdc4, 0xffaa00];
      const particles = this.add.particles(px, py, "particle", {
        speed: { min: 100, max: 300 },
        scale: { start: 1.0, end: 0 },
        tint: colors[i % colors.length],
        lifespan: 2000,
        quantity: 20,
        emitting: false,
      }).setScrollFactor(0).setDepth(610);
      this.time.delayedCall(i * 200, () => particles.explode(20));
      this.time.delayedCall(3000, () => particles.destroy());
    }

    // ── Win screen UI (delayed slightly so fanfare plays first) ──
    this.time.delayedCall(500, () => {
      // Dark overlay
      const overlay = this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
        .setScrollFactor(0)
        .setDepth(600);

      // Format elapsed time
      const totalSeconds = Math.floor(this.elapsedTime / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timeStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

      // Title — animates in
      const title = this.add
        .text(width / 2, height * 0.3, "YOU WIN", {
          fontFamily: "monospace",
          fontSize: "72px",
          color: "#ffd93d",
          stroke: "#000",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601)
        .setAlpha(0)
        .setScale(0.5);

      this.tweens.add({
        targets: title,
        alpha: 1,
        scale: 1,
        duration: 800,
        ease: "Back.easeOut",
      });

      // Subtitle
      const subtitle = this.add
        .text(width / 2, height * 0.3 + 80, "The solar system has been destroyed.", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#aaa",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601)
        .setAlpha(0);

      this.tweens.add({
        targets: subtitle,
        alpha: 1,
        duration: 600,
        delay: 600,
      });

      // Time
      this.add
        .text(width / 2, height * 0.5, `Time: ${timeStr}`, {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#4ecdc4",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);

      // Stats
      this.add
        .text(width / 2, height * 0.5 + 50, `Total mass consumed: ${Math.floor(this.resources.totalMassEarned).toLocaleString()}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#888",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);

      // Restart button
      const restartBtn = this.add
        .text(width / 2, height * 0.7, "[ PLAY AGAIN ]", {
          fontFamily: "monospace",
          fontSize: "24px",
          color: "#4ecdc4",
          backgroundColor: "#1a1a2e",
          padding: { x: 24, y: 12 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(602)
        .setInteractive({ useHandCursor: true });

      restartBtn.on("pointerover", () => restartBtn.setColor("#fff"));
      restartBtn.on("pointerout", () => restartBtn.setColor("#4ecdc4"));
      restartBtn.on("pointerdown", () => {
        this.scene.restart();
      });

      // Also allow keyboard/gamepad restart
      const restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      restartKey.once("down", () => this.scene.restart());
      const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.once("down", () => this.scene.restart());

      // Gamepad A button restart
      if (this.input.gamepad) {
        this.input.gamepad.once("down", () => this.scene.restart());
      }

      // Ignore from main camera
      this.cameras.main.ignore([overlay]);
    });
  }
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: win screen — fanfare explosions, animated title, restart button"
```
