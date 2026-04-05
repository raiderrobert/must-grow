# Fix: Upgrade Screen Needs Input Guard — Prevent Accidental Selection

> **For agentic workers:** Execute all steps in order.

**Goal:** Add a brief delay before the upgrade screen accepts input, so players who are mashing the fire button don't accidentally pick an upgrade without reading the options.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

The A button (gamepad button 0) is used for both burst fire and upgrade selection. The upgrade screen appears mid-combat while the player is likely holding or mashing A. On the first frame the screen appears, the A button is already pressed — the highlighted card is instantly selected before the player sees it.

Same issue with keyboard: Space fires bursts and could be spammed. Keys 1/2/3 are less likely to be held but still possible.

## The Fix

When the upgrade screen opens, show a "CHOOSE AN UPGRADE" splash for 800ms with cards hidden or dimmed. During this period, all input is ignored. After 800ms, the cards brighten, the subtitle appears, and input is accepted. This gives the player time to release whatever button they were pressing and read the options.

---

### Task 1: Add Input Guard Delay to UpgradeScreen

**Files:**
- Modify: `src/ui/UpgradeScreen.ts`

- [ ] **Step 1: Add guard state**

Add a field to track whether input is accepted:

```typescript
  private inputReady: boolean = false;
```

- [ ] **Step 2: Start with cards dimmed and delay input acceptance**

In the `build()` method, after creating all cards and the container, add:

```typescript
    // Guard: dim cards and ignore input for 800ms
    this.inputReady = false;
    for (const bg of this.cardBackgrounds) {
      bg.setAlpha(0.3);
    }

    this.scene.time.delayedCall(800, () => {
      if (!this.isVisible) return;
      this.inputReady = true;
      for (const bg of this.cardBackgrounds) {
        bg.setAlpha(1.0);
      }
      this.updateHighlight();
    });
```

This dims the card backgrounds to 30% opacity for 800ms. When the timer fires, cards brighten and input is accepted.

- [ ] **Step 3: Also dim the card text content**

The card text objects (name, description, rarity, key number) are children of the container but not tracked separately. To dim everything, set alpha on the container itself and restore it:

Actually, simpler approach — just set the entire container's alpha:

Replace the dimming code from Step 2 with:

```typescript
    // Guard: dim everything and ignore input for 800ms
    this.inputReady = false;
    this.container!.setAlpha(0.4);

    this.scene.time.delayedCall(800, () => {
      if (!this.isVisible) return;
      this.inputReady = true;
      this.container?.setAlpha(1.0);
      this.updateHighlight();
    });
```

The overlay is part of the container too, but at 0.4 alpha the dark overlay becomes slightly transparent — which actually looks nice as a "fading in" effect.

- [ ] **Step 4: Guard all input paths**

In `pollGamepad()`, add the guard at the top:

```typescript
  private pollGamepad(): void {
    if (!this.isVisible || !this.inputManager || !this.inputReady) return;
    // ... rest unchanged
  }
```

In `build()`, wrap the keyboard key listeners with the guard:

```typescript
      key.once("down", () => {
        if (this.isVisible && this.inputReady) this.pick(cards[cardIndex]);
      });
```

In `buildCard()`, wrap the click handler with the guard:

```typescript
    bg.on("pointerdown", () => {
      if (this.inputReady) this.pick(card);
    });
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/UpgradeScreen.ts
git commit -m "fix: 800ms input guard on upgrade screen — prevents accidental selection"
```
