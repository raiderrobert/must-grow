# Fix: Trajectory Prediction Line Still Rendering on Both Cameras

> **For agentic workers:** Execute all steps in order.

**Goal:** The trajectory prediction dots appear twice — once correctly in world space (main camera) and once as a static line on screen (UI camera). The UI camera must ignore the trajectory graphics.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Bug

The `TrajectoryPredictor` draws dots on a world-space `Phaser.GameObjects.Graphics` object. The two-camera setup in `GameScene.create()` should make the UI camera ignore this object, but it's not happening. Both cameras render the dots:

- **Main camera:** dots at correct world positions (moves with the player/camera)
- **UI camera:** dots at fixed screen coordinates (creates a static duplicate line, usually going straight left)

The duplicate is most visible at high speed because the main camera offsets via look-ahead while the UI camera doesn't.

This was documented in `2026-04-04-post-orbital-fixes.md` Task 1 but may not have been applied.

---

### Task 1: Ensure UI Camera Ignores Trajectory Graphics

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Find the two-camera setup in `create()`**

Search for `uiCam.ignore(worldObjects)` in `GameScene.ts`. Find the `worldObjects` array that lists everything the UI camera should ignore.

- [ ] **Step 2: Verify `trajectoryPredictor` graphics is in the list**

Check if `this.trajectoryPredictor.getGraphics()` is included in the `worldObjects` array. If it's missing, add it:

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
      this.trajectoryPredictor.getGraphics(), // ← MUST be here
    ];
    uiCam.ignore(worldObjects);
```

- [ ] **Step 3: If it IS in the list but still duplicates, check creation order**

The `trajectoryPredictor` might be created AFTER the `uiCam.ignore()` call. In that case the graphics object didn't exist when the ignore list was built. 

Fix: either move the `TrajectoryPredictor` creation before the camera setup, or add an explicit ignore after creation:

```typescript
    // If trajectoryPredictor is created after camera setup:
    this.trajectoryPredictor = new TrajectoryPredictor(this, this.gravity);
    uiCam.ignore(this.trajectoryPredictor.getGraphics());
```

Search for where `this.trajectoryPredictor` is assigned and where `uiCam.ignore(worldObjects)` is called. If the predictor comes after, add the explicit ignore line right after creation.

- [ ] **Step 4: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 5: Visual verification**

Run: `pnpm dev`
Check: only ONE set of trajectory dots visible. When moving fast, the dots should follow the player in world space — no static ghost line on screen.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: trajectory prediction line no longer duplicated — UI camera ignores it"
```
