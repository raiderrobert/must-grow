# Fix: Upgrade Screen Needs Gamepad Support

> **For agentic workers:** Execute all steps in order.

**Goal:** Add gamepad navigation to the upgrade card selection screen. D-pad/stick left/right to highlight a card, A button to confirm selection.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The `UpgradeScreen` (`src/ui/UpgradeScreen.ts`) only supports keyboard (1/2/3) and mouse click. When using a gamepad, the player can't select an upgrade — the game is stuck on this screen. The subtitle says "Press 1 · 2 · 3 or click a card" with no mention of gamepad controls.

## The Fix

Add gamepad navigation: D-pad left/right (or left stick) to move a highlight between the 3 cards, A button (button 0) to confirm the highlighted card. The highlight starts on card 1 (left). The subtitle updates to show gamepad controls when the last input was a gamepad.

---

### Task 1: Add Gamepad Navigation to UpgradeScreen

**Files:**
- Modify: `src/ui/UpgradeScreen.ts`

- [ ] **Step 1: Add InputManager dependency**

The `UpgradeScreen` needs access to `InputManager` to detect gamepad vs keyboard and read gamepad buttons. Add it to the constructor:

In the import section, add:

```typescript
import type { InputManager } from "@/systems/InputManager";
```

Add a field:

```typescript
  private inputManager: InputManager | null = null;
```

Add a parameter to the constructor (after `audio`):

```typescript
  constructor(
    scene: Phaser.Scene,
    combat: CombatSystem,
    resources: ResourceManager,
    player: PlayerStation,
    audio: AudioManager | null = null,
    inputManager: InputManager | null = null
  ) {
    this.scene = scene;
    this.combat = combat;
    this.resources = resources;
    this.player = player;
    this.audio = audio;
    this.inputManager = inputManager;
  }
```

- [ ] **Step 2: Update GameScene to pass InputManager**

In `src/scenes/GameScene.ts`, find where `UpgradeScreen` is constructed and add `this.inputManager`:

```typescript
    this.upgradeScreen = new UpgradeScreen(
      this, this.combat, this.resources, this.player, this.audio, this.inputManager
    );
```

- [ ] **Step 3: Add selection state and gamepad polling**

Add fields to `UpgradeScreen` for tracking selection and preventing rapid repeats:

```typescript
  private selectedIndex: number = 0;
  private cardBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private currentCards: UpgradeCard[] = [];
  private keyObjects: Phaser.Input.Keyboard.Key[] = [];
  private gamepadPollTimer?: Phaser.Time.TimerEvent;
  private stickCooldown: number = 0;
```

- [ ] **Step 4: Rewrite `build()` to track card backgrounds and start gamepad polling**

Replace the `build` method with this version that tracks card backgrounds for highlighting and starts a gamepad poll loop:

```typescript
  private build(cards: UpgradeCard[]): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];
    this.currentCards = cards;
    this.selectedIndex = 0;
    this.cardBackgrounds = [];
    this.keyObjects = [];
    this.stickCooldown = 0;

    // Dark overlay
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(500);
    objects.push(overlay);

    // Title
    objects.push(
      this.scene.add.text(width / 2, height * 0.12, "CHOOSE AN UPGRADE", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Subtitle — show gamepad hint if using gamepad
    const isGamepad = this.inputManager?.isGamepad ?? false;
    const subtitleText = isGamepad
      ? "D-pad select  ·  A confirm"
      : "Press 1 · 2 · 3  or  click a card";
    objects.push(
      this.scene.add.text(width / 2, height * 0.12 + 40, subtitleText, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Cards
    const cardW = Math.min(260, (width - 120) / 3);
    const cardH = 220;
    const spacing = cardW + 30;
    const startX = width / 2 - spacing;

    const keyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
    ];

    for (let i = 0; i < cards.length; i++) {
      const cx = startX + i * spacing;
      const cy = height * 0.5;
      const cardObjs = this.buildCard(cards[i], cx, cy, cardW, cardH, i + 1);
      objects.push(...cardObjs);

      const key = this.scene.input.keyboard!.addKey(keyCodes[i]);
      this.keyObjects.push(key);
      const cardIndex = i;
      key.once("down", () => {
        if (this.isVisible) this.pick(cards[cardIndex]);
      });
    }

    this.container = this.scene.add.container(0, 0, objects);
    this.container.setDepth(500);

    if (this.mainCam) {
      this.mainCam.ignore(this.container);
    }

    // Highlight initial selection
    this.updateHighlight();

    // Start gamepad polling
    this.gamepadPollTimer = this.scene.time.addEvent({
      delay: 16, // ~60fps
      loop: true,
      callback: () => this.pollGamepad(),
    });
  }
```

- [ ] **Step 5: Add highlight update method**

```typescript
  private updateHighlight(): void {
    for (let i = 0; i < this.cardBackgrounds.length; i++) {
      const bg = this.cardBackgrounds[i];
      if (i === this.selectedIndex) {
        bg.setFillStyle(0x222255);
        bg.setStrokeStyle(3, 0xffffff, 1.0);
      } else {
        bg.setFillStyle(0x111133);
        const card = this.currentCards[i];
        const color = RARITY_COLORS[card.rarity] ?? "#ccc";
        const colorHex = parseInt(color.replace("#", ""), 16);
        bg.setStrokeStyle(2, colorHex, 0.9);
      }
    }
  }
```

- [ ] **Step 6: Add gamepad polling method**

```typescript
  private pollGamepad(): void {
    if (!this.isVisible || !this.inputManager) return;

    this.stickCooldown = Math.max(0, this.stickCooldown - 16);

    // Read D-pad or left stick for navigation
    const mx = this.inputManager.moveX;

    if (this.stickCooldown <= 0 && Math.abs(mx) > 0.5) {
      if (mx > 0 && this.selectedIndex < this.currentCards.length - 1) {
        this.selectedIndex++;
        this.updateHighlight();
        this.stickCooldown = 200; // 200ms before next move
      } else if (mx < 0 && this.selectedIndex > 0) {
        this.selectedIndex--;
        this.updateHighlight();
        this.stickCooldown = 200;
      }
    }

    // A button (button 0) confirms selection
    const pad = (this.inputManager as any).pad as Phaser.Input.Gamepad.Gamepad | null;
    if (pad?.buttons[0]?.pressed) {
      this.pick(this.currentCards[this.selectedIndex]);
    }
  }
```

Note: Accessing the `pad` field directly is a bit hacky. If `InputManager` doesn't expose the pad, add a public getter:

In `src/systems/InputManager.ts`, add:

```typescript
  /** Expose gamepad for upgrade screen polling. */
  get gamepad(): Phaser.Input.Gamepad.Gamepad | null {
    return this.pad;
  }
```

Then use `this.inputManager.gamepad?.buttons[0]?.pressed` instead of the cast.

- [ ] **Step 7: Track card backgrounds in `buildCard`**

In the `buildCard` method, after creating the `bg` rectangle, push it to the tracking array:

```typescript
    const bg = this.scene.add
      .rectangle(cx, cy, w, h, 0x111133, 1)
      .setStrokeStyle(2, colorHex, 0.9)
      .setScrollFactor(0)
      .setDepth(501)
      .setInteractive({ useHandCursor: true });
    objects.push(bg);
    this.cardBackgrounds.push(bg);  // ← add this line
```

- [ ] **Step 8: Clean up gamepad polling in `pick()`**

Update the `pick` method to stop the gamepad poll timer and clear state:

```typescript
  private pick(card: UpgradeCard): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    for (const key of this.keyObjects) key.removeAllListeners();
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.cardBackgrounds = [];
    this.currentCards = [];
    this.keyObjects = [];

    card.apply(this.combat, this.resources, this.player);
    this.audio?.play("sfx_upgrade");

    this.container?.destroy();
    this.container = null;

    this.onClose?.();
  }
```

Note: The old `pick` method accepted a `keys` parameter — remove it since `keyObjects` is now a class field.

- [ ] **Step 9: Type check and test**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: Clean.

- [ ] **Step 10: Commit**

```bash
git add src/ui/UpgradeScreen.ts src/scenes/GameScene.ts src/systems/InputManager.ts
git commit -m "feat: gamepad support for upgrade screen — D-pad navigate, A confirm"
```
