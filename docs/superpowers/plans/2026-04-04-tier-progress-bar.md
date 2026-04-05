# Fix: Add Tier Progress Bar to HUD

> **For agentic workers:** Execute all steps in order.

**Goal:** Add a progress bar below the tier text showing how far the player is toward the next tier. Shows current mass / next tier threshold.

**Tech Stack:** TypeScript, Phaser 3

**Validation:** `pnpm exec tsc --noEmit && pnpm test && pnpm build`

---

### Task 1: Add Tier Progress Bar

**Files:**
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Add progress bar fields**

Add fields to the `HUD` class for the tier progress bar:

```typescript
  private tierProgressBg!: Phaser.GameObjects.Rectangle;
  private tierProgressFill!: Phaser.GameObjects.Rectangle;
```

- [ ] **Step 2: Create the progress bar in the constructor**

After the `createTierIndicator()` call in the constructor, add a method call to create the tier progress bar:

```typescript
    this.createTierProgress();
```

Add the method:

```typescript
  private createTierProgress(): void {
    const x = 20;
    const y = 88;
    const width = 120;
    const height = 6;

    this.tierProgressBg = this.scene.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x333333)
      .setStrokeStyle(1, 0x6c63ff, 0.3)
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.tierProgressBg);

    this.tierProgressFill = this.scene.add
      .rectangle(x + 1, y + 1, 0, height - 2, 0x6c63ff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
    this.objects.push(this.tierProgressFill);
  }
```

- [ ] **Step 3: Move existing elements down to make room**

The tier text is at y=74. The progress bar goes at y=88 (right below the tier text). The burst text is at y=94 — needs to move down.

In `createBurstText()`, change:

```typescript
      .text(20, 94, "", {
```

To:

```typescript
      .text(20, 100, "", {
```

- [ ] **Step 4: Update the progress bar each frame**

In the `update()` method, after the tier text update, add progress bar logic:

```typescript
    // Tier progress bar
    const currentThreshold = tier <= 1 ? 0 : [0, 0, 100, 500, 2000, 10000][tier] ?? 0;
    const nextThreshold = [0, 100, 500, 2000, 10000, 50000][tier] ?? 50000;
    const progress = Math.min(1,
      (this.resources.totalMassEarned - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)
    );
    this.tierProgressFill.width = 118 * progress; // 120 - 2px border

    // Update tier text to show mass / next threshold
    this.tierText.setText(
      `Tier ${tier}: ${getTierName(tier)}  (${Math.floor(this.resources.totalMassEarned)}/${nextThreshold})`
    );
```

This replaces the existing `tierText.setText` line that just shows tier name.

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/HUD.ts
git commit -m "feat: tier progress bar shows mass toward next evolution"
```
