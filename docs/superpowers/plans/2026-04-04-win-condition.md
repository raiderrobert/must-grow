# Feature: Planet Kill Tracker + Win Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At tier 4+ ("Planet Eater"), show a tracker across the top of the screen listing all 9 bodies (8 planets + Sun) with checkmarks as they're destroyed. When all are destroyed, show a "YOU WIN" splash screen with elapsed time.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Add Planet Kill Tracker to HUD

Shows a horizontal row of body names across the top-center of the screen. Each starts as dim text. When destroyed, it gets a strikethrough and checkmark. Only visible at tier 4+.

**Files:**
- Modify: `src/ui/HUD.ts`
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add tracker fields and state to HUD**

Add fields to `HUD`:

```typescript
  private killTrackerTexts: Phaser.GameObjects.Text[] = [];
  private killTrackerVisible: boolean = false;
  private destroyedBodies: Set<string> = new Set();
```

- [ ] **Step 2: Add a method to create the kill tracker**

The tracker is a row of 9 body names across the top-center. Created once, hidden until tier 4.

```typescript
  private createKillTracker(): void {
    const bodyNames = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Sun"];
    const startX = this.scene.scale.width / 2 - (bodyNames.length * 70) / 2;
    const y = 10;

    for (let i = 0; i < bodyNames.length; i++) {
      const text = this.scene.add
        .text(startX + i * 70 + 35, y, bodyNames[i], {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#555",
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(100)
        .setVisible(false)
        .setData("bodyName", bodyNames[i]);
      this.killTrackerTexts.push(text);
      this.objects.push(text);
    }
  }
```

Call it in the constructor after the other create methods:

```typescript
    this.createKillTracker();
```

- [ ] **Step 3: Add methods to show tracker and mark kills**

```typescript
  /** Show the kill tracker (called when player reaches tier 4+). */
  showKillTracker(): void {
    if (this.killTrackerVisible) return;
    this.killTrackerVisible = true;
    for (const text of this.killTrackerTexts) {
      text.setVisible(true);
    }
  }

  /** Mark a body as destroyed on the tracker. Returns true if all bodies are now destroyed. */
  markBodyDestroyed(name: string): boolean {
    this.destroyedBodies.add(name);
    for (const text of this.killTrackerTexts) {
      if (text.getData("bodyName") === name) {
        text.setText(`✓ ${name}`);
        text.setColor("#4ecdc4");
      }
    }
    return this.destroyedBodies.size >= this.killTrackerTexts.length;
  }
```

- [ ] **Step 4: Show tracker at tier 4+ in GameScene**

In `GameScene.ts`, in the `triggerEvolution` method, after the existing tier spike code, add:

```typescript
    if (newTier >= 4) {
      this.hud.showKillTracker();
    }
```

- [ ] **Step 5: Call `markBodyDestroyed` when a body is destroyed**

In `GameScene.ts`, in the `onBodyDestroyed` method (where tracked bodies are cleaned up), add:

```typescript
    const allDestroyed = this.hud.markBodyDestroyed(tracked.name);
    if (allDestroyed) {
      this.showWinScreen();
    }
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/HUD.ts src/scenes/GameScene.ts
git commit -m "feat: planet kill tracker at top of screen — visible from tier 4"
```

---

### Task 2: Add Win Screen

When all 9 bodies are destroyed, pause the game and show a centered "YOU WIN" splash with elapsed time.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Track elapsed time**

Add a field to `GameScene`:

```typescript
  private elapsedTime: number = 0; // ms since game start
```

In `update()`, at the very top (after the `isPaused` check), accumulate time:

```typescript
    this.elapsedTime += delta;
```

- [ ] **Step 2: Add `showWinScreen` method**

```typescript
  private showWinScreen(): void {
    this.isPaused = true;
    this.physics.world.pause();

    const { width, height } = this.scale;

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

    // Title
    this.add
      .text(width / 2, height * 0.35, "YOU WIN", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffd93d",
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(601);

    // Subtitle
    this.add
      .text(width / 2, height * 0.35 + 80, "The solar system has been destroyed.", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#aaa",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(601);

    // Time
    this.add
      .text(width / 2, height * 0.55, `Time: ${timeStr}`, {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#4ecdc4",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(601);

    // Stats
    this.add
      .text(width / 2, height * 0.55 + 50, `Total mass consumed: ${Math.floor(this.resources.totalMassEarned).toLocaleString()}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(601);

    // Ignore all win screen objects from main camera (render on UI camera only)
    // The overlay and text use setScrollFactor(0) which is enough for the UI camera
    this.cameras.main.ignore([overlay]);
  }
```

- [ ] **Step 3: Type check and test**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: win screen — YOU WIN with elapsed time when all bodies destroyed"
```
