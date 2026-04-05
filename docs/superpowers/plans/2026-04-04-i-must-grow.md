# Feature: "I must grow." — Menacing Player Monologue

> **For agentic workers:** Execute all steps in order.

**Goal:** The game is titled "I must grow." Show this as the title on the start screen. Display escalating menacing messages from the player at each tier evolution. The player entity has a voice — hungry, driven, increasingly cosmic in scale.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Change Title to "I must grow."

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update the start screen title**

In the `showStartScreen()` method, find the title text:

```typescript
        .text(width / 2, height * 0.2, "PLANET\nDESTROYER", {
```

Replace with:

```typescript
        .text(width / 2, height * 0.2, "I must grow.", {
          fontFamily: "monospace",
          fontSize: "52px",
          color: "#ffd93d",
          stroke: "#000",
          strokeThickness: 6,
          fontStyle: "italic",
        })
```

- [ ] **Step 2: Update the HTML page title**

In `index.html` (the root HTML file), find the `<title>` tag and change it:

```html
<title>I must grow.</title>
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts index.html
git commit -m "feat: game title is 'I must grow.'"
```

---

### Task 2: Add Tier Evolution Monologue

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add monologue messages**

Add a constant at the top of `GameScene.ts` (after imports, before the class):

```typescript
const TIER_MONOLOGUE: Record<number, string[]> = {
  1: [
    "I must grow.",
    "I hunger.",
    "So small... but not for long.",
  ],
  2: [
    "More. I need more.",
    "I can feel the pull of larger things.",
    "This debris is beneath me now.",
  ],
  3: [
    "The planets tremble.",
    "I am becoming something... inevitable.",
    "Their orbits are my feeding grounds.",
  ],
  4: [
    "I will devour worlds.",
    "Nothing can stop what I have become.",
    "The planets are mine to consume.",
  ],
  5: [
    "Even stars must fall.",
    "I am the end of all things.",
    "The Sun itself will feed my hunger.",
  ],
};
```

- [ ] **Step 2: Show a monologue message on tier evolution**

In `triggerEvolution()`, after the existing tier name text and before the audio play, add the monologue:

```typescript
    // Menacing monologue
    const messages = TIER_MONOLOGUE[newTier];
    if (messages) {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const monologue = this.add
        .text(this.scale.width / 2, this.scale.height / 2 + 30, `"${msg}"`, {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ff6b6b",
          fontStyle: "italic",
          stroke: "#000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(301);

      this.tweens.add({
        targets: monologue,
        alpha: 0,
        y: monologue.y - 20,
        duration: 4000,
        delay: 1000,
        ease: "Power2",
        onComplete: () => monologue.destroy(),
      });
    }
```

- [ ] **Step 3: Show opening monologue on game start**

In `showStartScreen()`, add a subtitle below the title:

After the title text creation, add:

```typescript
    // Opening monologue
    objects.push(
      this.add
        .text(width / 2, height * 0.2 + 60, "\"I hunger.\"", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#ff6b6b",
          fontStyle: "italic",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801)
    );
```

- [ ] **Step 4: Show monologue on win screen**

In `showWinScreen()`, after the subtitle ("The solar system has been destroyed."), add a final menacing line:

```typescript
      // Final monologue
      const finalMessages = [
        "There is nothing left... or is there?",
      ];
      const finalMsg = finalMessages[Math.floor(Math.random() * finalMessages.length)];
      this.add
        .text(width / 2, height * 0.3 + 120, `"${finalMsg}"`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ff6b6b",
          fontStyle: "italic",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: 'I must grow.' — menacing monologue at start, each tier, and victory"
```
