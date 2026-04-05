# Fix: Move Burst to Top-Right Weapon HUD with Cooldown Bar

> **For agentic workers:** Execute all steps in order.

**Goal:** Replace the "BURST ready [SPC]" text in the top-left with a weapon slot in the top-right corner showing a cooldown bar and the correct input hint (gamepad vs keyboard). Position it as the first slot in a row that can grow as more weapons are added.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

## The Problem

1. The burst indicator says `[SPC]` even on gamepad (should show `[A]`)
2. It's text-only — no visual indication of cooldown progress
3. It's crammed into the top-left with energy/mass/tier — wrong location for weapons

## The Fix

Top-right corner gets a weapon slot: a small box with the weapon name, a cooldown bar that fills as the cooldown recharges, and the correct button hint based on input type. When the weapon is ready, the bar is full and bright. When on cooldown, the bar drains and dims.

Positioned so additional weapon slots can be added below it in the future.

---

### Task 1: Create Weapon HUD in Top-Right

**Files:**
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Remove the old burst text**

In `src/ui/HUD.ts`, remove the `createBurstText()` method and its call in the constructor. Also remove the `burstText` field and its update logic in `update()`.

Delete the field:
```typescript
  // DELETE: private burstText!: Phaser.GameObjects.Text;
```

Delete the method:
```typescript
  // DELETE: private createBurstText(): void { ... }
```

Delete from constructor:
```typescript
  // DELETE: this.createBurstText();
```

Delete from `update()`:
```typescript
  // DELETE: const canBurst = this.resources.canBurst && (this.combat?.burstCooldown ?? 0) <= 0;
  // DELETE: this.burstText.setText(canBurst ? "BURST ready [SPC]" : "");
  // DELETE: this.burstText.setColor(canBurst ? "#ffd93d" : "#555");
```

- [ ] **Step 2: Add weapon slot fields**

Add new fields:

```typescript
  private weaponSlotBg!: Phaser.GameObjects.Rectangle;
  private weaponSlotFill!: Phaser.GameObjects.Rectangle;
  private weaponSlotLabel!: Phaser.GameObjects.Text;
  private weaponSlotHint!: Phaser.GameObjects.Text;
```

- [ ] **Step 3: Create the weapon slot**

Add a method and call it from the constructor (after the other create calls):

```typescript
  private createWeaponSlot(): void {
    const slotW = 100;
    const slotH = 36;
    const x = this.scene.scale.width - slotW - 12;
    const y = 12;

    // Background
    this.weaponSlotBg = this.scene.add
      .rectangle(x + slotW / 2, y + slotH / 2, slotW, slotH, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0xffd93d, 0.4)
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.weaponSlotBg);

    // Cooldown fill bar (bottom of slot, fills left to right)
    this.weaponSlotFill = this.scene.add
      .rectangle(x + 2, y + slotH - 6, 0, 4, 0xffd93d)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
    this.objects.push(this.weaponSlotFill);

    // Weapon name
    this.weaponSlotLabel = this.scene.add
      .text(x + slotW / 2, y + 10, "BURST", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffd93d",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(102);
    this.objects.push(this.weaponSlotLabel);

    // Button hint (below name)
    this.weaponSlotHint = this.scene.add
      .text(x + slotW / 2, y + 24, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#888",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(102);
    this.objects.push(this.weaponSlotHint);
  }
```

Add the call in the constructor:

```typescript
    this.createWeaponSlot();
```

- [ ] **Step 4: Update weapon slot each frame**

In `update()`, add weapon slot logic (where the old burst text update was):

```typescript
    // Weapon slot: burst cooldown
    if (this.combat) {
      const cooldownMax = this.combat.burstCooldownMax;
      const cooldownLeft = Math.max(0, this.combat.burstCooldown);
      const progress = 1 - (cooldownLeft / cooldownMax); // 0 = just fired, 1 = ready
      const canBurst = this.resources.canBurst && cooldownLeft <= 0;

      // Fill bar
      this.weaponSlotFill.width = (100 - 4) * progress; // slotW - 4px border

      // Color: bright when ready, dim when recharging
      if (canBurst) {
        this.weaponSlotFill.setFillStyle(0xffd93d, 1.0);
        this.weaponSlotBg.setStrokeStyle(1, 0xffd93d, 0.6);
        this.weaponSlotLabel.setColor("#ffd93d");
      } else {
        this.weaponSlotFill.setFillStyle(0xffd93d, 0.4);
        this.weaponSlotBg.setStrokeStyle(1, 0xffd93d, 0.2);
        this.weaponSlotLabel.setColor("#777");
      }

      // Input hint: show correct button
      if (this.inputManager?.isGamepad) {
        this.weaponSlotHint.setText("[A]");
      } else {
        this.weaponSlotHint.setText("[SPACE]");
      }
    }
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/HUD.ts
git commit -m "feat: weapon HUD slot in top-right — burst cooldown bar with correct input hint"
```
