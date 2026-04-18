# Mobile Controls Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-anywhere virtual joystick for mobile, auto-zoom on mobile devices, right-side tap for burst fire.

**Architecture:** Extend InputManager with touch handling, create MobileControls.ts for joystick rendering, integrate into GameScene for mobile zoom.

**Tech Stack:** Phaser 3 touch/pointer input, existing InputManager pattern

---

### Task 1: Add MobileControls Module

**Files:**
- Create: `src/ui/MobileControls.ts`

- [ ] **Step 1: Write the MobileControls module**

Create `src/ui/MobileControls.ts`:

```typescript
import Phaser from "phaser";

/**
 * Drag-anywhere virtual joystick for mobile.
 * Only renders when touch is active in the left zone.
 * Use: new MobileControls(scene). Then in update(), call .update().
 */
export class MobileControls {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private outerRing!: Phaser.GameObjects.Arc;
  private innerThumb!: Phaser.GameObjects.Arc;
  
  private touchActive: boolean = false;
  private touchOriginX: number = 0;
  private touchOriginY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  
  private readonly OUTER_RADIUS = 60;
  private readonly THUMB_RADIUS = 20;
  private readonly MAX_CLAMP = 50;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createGraphics();
  }

  private createGraphics(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(500);
    this.container.setVisible(false);

    // Outer ring
    this.outerRing = this.scene.add.circle(0, 0, this.OUTER_RADIUS, 0x4ecdc4, 0.3);
    this.outerRing.setStrokeStyle(2, 0x4ecdc4, 0.6);
    this.container.add(this.outerRing);

    // Inner thumb
    this.innerThumb = this.scene.add.circle(0, 0, this.THUMB_RADIUS, 0x4ecdc4, 0.6);
    this.container.add(this.innerThumb);
  }

  update(): void {
    const pointers = this.scene.input.pointers;
    const leftPointer = pointers.find(p => p.position.x < this.scene.scale.width / 2);
    const rightPointer = pointers.find(p => p.position.x >= this.scene.scale.width / 2);

    // Check for right-side tap (attack)
    if (rightPointer && rightPointer.down) {
      // Emit attack event - handled via InputManager
    }

    if (!leftPointer) {
      if (this.touchActive) {
        this.hide();
      }
      return;
    }

    if (leftPointer.justDown) {
      this.show(leftPointer.x, leftPointer.y);
      this.touchOriginX = leftPointer.x;
      this.touchOriginY = leftPointer.y;
      this.touchActive = true;
    }

    if (leftPointer.isDown && this.touchActive) {
      this.currentX = leftPointer.x;
      this.currentY = leftPointer.y;
      this.updateThumb();
    }

    if (leftPointer.justUp && this.touchActive) {
      this.hide();
      this.touchActive = false;
    }
  }

  private show(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this.innerThumb.setPosition(0, 0);
  }

  private hide(): void {
    this.container.setVisible(false);
  }

  private updateThumb(): void {
    const dx = this.currentX - this.touchOriginX;
    const dy = this.currentY - this.touchOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp thumb to max radius
    const clampDist = Math.min(dist, this.MAX_CLAMP);
    const angle = Math.atan2(dy, dx);
    
    const thumbX = Math.cos(angle) * clampDist;
    const thumbY = Math.sin(angle) * clampDist;
    this.innerThumb.setPosition(thumbX, thumbY);
  }

  /** Returns -1 to 1 for X axis based on joystick displacement */
  get moveX(): number {
    if (!this.touchActive) return 0;
    const dx = this.currentX - this.touchOriginX;
    return Math.max(-1, Math.min(1, dx / this.MAX_CLAMP));
  }

  /** Returns -1 to 1 for Y axis based on joystick displacement */
  get moveY(): number {
    if (!this.touchActive) return 0;
    const dy = this.currentY - this.touchOriginY;
    return Math.max(-1, Math.min(1, dy / this.MAX_CLAMP));
  }

  get isActive(): boolean {
    return this.touchActive;
  }

  destroy(): void {
    this.container.destroy();
  }
}
```

- [ ] **Step 2: Build to verify no syntax errors**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/MobileControls.ts
git commit -m "feat: add MobileControls module for virtual joystick"
```

---

### Task 2: Integrate Touch Input into InputManager

**Files:**
- Modify: `src/systems/InputManager.ts:1-180`

- [ ] **Step 1: Add mobile detection and touch input to InputManager**

Add to `InputManager.ts`:

1. Add `"touch"` to the `InputType` union (line ~4):
```typescript
export type InputType = "keyboard" | "gamepad" | "touch";
```

2. Add new properties after the existing private fields:
```typescript
private mobileControls: import("@/ui/MobileControls").MobileControls | null = null;
private _isMobile: boolean = false;
private _attackJustPressedFromTouch: boolean = false;
```

3. Add to constructor after gamepad setup:
```typescript
// Mobile detection
this._isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (this._isMobile) {
  const MobileControls = require("@/ui/MobileControls").MobileControls;
  this.mobileControls = new MobileControls(scene);
}
```

4. Update `update()` method to poll mobile controls:
```typescript
// Mobile joystick
if (this.mobileControls) {
  this.mobileControls.update();
  if (this.mobileControls.isActive) {
    this._lastInputType = "touch";
  }
}
```

5. Update `get moveX()` to include mobile:
```typescript
get moveX(): number {
  const stick = this.pad?.axes[0]?.getValue() ?? 0;
  if (Math.abs(stick) > 0.2) return stick;
  if (this.cursors.left.isDown || this.wasd.A.isDown) return -1;
  if (this.cursors.right.isDown || this.wasd.D.isDown) return 1;
  if (this.mobileControls?.isActive) return this.mobileControls.moveX;
  return 0;
}
```

6. Update `get moveY()` similarly:
```typescript
get moveY(): number {
  const stick = this.pad?.axes[1]?.getValue() ?? 0;
  if (Math.abs(stick) > 0.2) return stick;
  if (this.cursors.up.isDown || this.wasd.W.isDown) return -1;
  if (this.cursors.down.isDown || this.wasd.S.isDown) return 1;
  if (this.mobileControls?.isActive) return this.mobileControls.moveY;
  return 0;
}
```

7. Add getter for isMobile:
```typescript
get isMobile(): boolean {
  return this._isMobile;
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/systems/InputManager.ts
git commit -m "feat: integrate touch input into InputManager"
```

---

### Task 3: Add Mobile Zoom in GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts:307` (create method call)

- [ ] **Step 1: Update camera zoom for mobile**

Find the line in `create()` around line 307 that sets initial zoom:
```typescript
this.cameras.main.setZoom(ZOOM_START);
```

Change it to:
```typescript
const initialZoom = this.inputManager.isMobile ? ZOOM_START * 0.6 : ZOOM_START;
this.cameras.main.setZoom(initialZoom);
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: apply mobile zoom on touch devices"
```

---

### Task 4: Test on Mobile

**Testing:**
1. Open game on mobile device or use Chrome DevTools device emulation
2. Check that:
   - [ ] Joystick appears when touching left half of screen
   - [ ] Joystick follows drag direction
   - [ ] Player moves with joystick
   - [ ] Initial zoom is more zoomed out on mobile
   - [ ] Right-side tap triggers burst fire

---

### Task 5: Final Commit and Deploy

- [ ] **Step 1: Push and deploy**

```bash
git push origin main
```
