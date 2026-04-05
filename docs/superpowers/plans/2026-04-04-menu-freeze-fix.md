# Fix: Game Freezes When Closing Settings Menu

> **For agentic workers:** Execute all steps in order.

**Goal:** Fix the game permanently freezing when opening the settings menu. The menu toggle code runs after the `isPaused` early return, so it can never close the menu.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Bug

In `GameScene.update()`:

```typescript
update(_time: number, delta: number): void {
    if (this.isPaused) return;  // ← line 276: exits here when menu is open

    // ... 80 lines of game logic ...

    this.inputManager.update();  // ← line 354: never reached when paused

    if (this.inputManager.consumeMenuToggle()) {  // ← line 356: never reached
      this.settingsMenu.toggle();
      // ...
    }
```

When the menu opens, `isPaused` is set to `true`. On the next frame, `update()` returns at line 276. The `inputManager.update()` and `consumeMenuToggle()` on lines 354-356 never execute. The ESC key press is never detected. The menu can never close. The game is permanently frozen.

## The Fix

Move input polling and menu toggle BEFORE the `isPaused` check so the player can always open/close the menu regardless of pause state.

---

### Task 1: Move Menu Toggle Before Pause Check

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Restructure the top of `update()`**

Move `inputManager.update()` and the menu toggle block to run before the `isPaused` early return. The new order:

```typescript
  update(_time: number, delta: number): void {
    // Input polling and menu toggle must run even when paused
    this.inputManager.update();

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

    if (this.isPaused) return;

    this.elapsedTime += delta;
    delta *= this.gameSpeedMult;

    // ... rest of update unchanged ...
```

- [ ] **Step 2: Remove the old `inputManager.update()` and menu toggle block**

Delete the duplicate `this.inputManager.update()` call and the duplicate `consumeMenuToggle` block from their old location further down in `update()` (around line 354-365). They now live at the top.

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Verify**

Run `pnpm dev`. Open menu with ESC. Press ESC again. Game should resume. Repeat with gamepad Start button.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: menu toggle runs before pause check — menu can actually close"
```
