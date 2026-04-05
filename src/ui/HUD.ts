import Phaser from "phaser";
import { COLORS } from "@/constants";
import { ResourceManager } from "@/systems/ResourceManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import type { CombatSystem } from "@/systems/CombatSystem";
import type { InputManager } from "@/systems/InputManager";

export class HUD {
  private scene: Phaser.Scene;
  private resources: ResourceManager;

  private energyBarBg!: Phaser.GameObjects.Rectangle;
  private energyBarFill!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private massText!: Phaser.GameObjects.Text;
  private tierText!: Phaser.GameObjects.Text;
  private tierProgressBg!: Phaser.GameObjects.Rectangle;
  private tierProgressFill!: Phaser.GameObjects.Rectangle;
  private weaponSlotBg!: Phaser.GameObjects.Rectangle;
  private weaponSlotFill!: Phaser.GameObjects.Rectangle;
  private weaponSlotLabel!: Phaser.GameObjects.Text;
  private weaponSlotHint!: Phaser.GameObjects.Text;

  private killTrackerTexts: Phaser.GameObjects.Text[] = [];
  private killTrackerVisible: boolean = false;
  private destroyedBodies: Set<string> = new Set();
  private combat: CombatSystem | null = null;
  private inputManager: InputManager | null = null;
  private controlsHint!: Phaser.GameObjects.Text;

  // All tracked HUD objects for camera ignore
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    resources: ResourceManager,
    combat: CombatSystem | null = null,
    inputManager: InputManager | null = null,
  ) {
    this.combat = combat;
    this.inputManager = inputManager;
    this.scene = scene;
    this.resources = resources;

    this.createEnergyBar();
    this.createMassCounter();
    this.createTierIndicator();
    this.createTierProgress();
    this.createWeaponSlot();
    this.createKillTracker();

    this.controlsHint = scene.add
      .text(20, scene.scale.height - 16, "", {
        fontFamily: "monospace", fontSize: "11px", color: "#444",
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.controlsHint);
  }

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

  /** Show or hide all HUD objects (used during start screen). */
  setVisible(visible: boolean): void {
    for (const obj of this.objects) {
      (obj as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(visible);
    }
  }

  /** Reposition edge-anchored elements after a window resize. */
  reposition(width: number, height: number): void {
    // Controls hint — bottom-left
    this.controlsHint.setPosition(20, height - 16);

    // Kill tracker — centered top
    const bodyCount = this.killTrackerTexts.length;
    const startX = width / 2 - (bodyCount * 70) / 2;
    for (let i = 0; i < bodyCount; i++) {
      this.killTrackerTexts[i].setX(startX + i * 70 + 35);
    }

    // Weapon slot — top-right
    const slotW = 100;
    const x = width - slotW - 12;
    const y = 12;
    this.weaponSlotBg.setPosition(x + slotW / 2, y + 36 / 2);
    this.weaponSlotFill.setPosition(x + 2, y + 36 - 6);
    this.weaponSlotLabel.setPosition(x + slotW / 2, y + 10);
    this.weaponSlotHint.setPosition(x + slotW / 2, y + 24);
  }

  /** Tell a camera to ignore all HUD objects (so they're only rendered by the UI camera). */
  ignoreWithCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.ignore(this.objects.filter(Boolean));
  }

  /** All HUD GameObjects — for external camera setup. */
  getObjects(): Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  private createEnergyBar(): void {
    const x = 20;
    const y = 20;
    const width = 200;
    const height = 16;

    this.energyBarBg = this.scene.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x333333)
      .setStrokeStyle(1, COLORS.energy, 0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.energyBarBg);

    this.energyBarFill = this.scene.add
      .rectangle(x + 1, y + 1, 0, height - 2, COLORS.energy)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101);
    this.objects.push(this.energyBarFill);

    this.energyText = this.scene.add
      .text(x + width + 10, y, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd93d",
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.energyText);
  }

  private createMassCounter(): void {
    this.massText = this.scene.add
      .text(20, 50, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#4ecdc4",
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.massText);
  }

  private createTierIndicator(): void {
    this.tierText = this.scene.add
      .text(20, 74, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#6c63ff",
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.tierText);
  }

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
        fontSize: "12px",
        color: "#888",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(102);
    this.objects.push(this.weaponSlotHint);
  }

  update(): void {
    const ratio = this.resources.energyRatio;
    const maxWidth = 198;
    this.energyBarFill.width = maxWidth * ratio;

    if (ratio < 0.2) {
      const flash = Math.sin(this.scene.time.now / 200) > 0;
      this.energyBarFill.setFillStyle(flash ? COLORS.dangerRed : COLORS.energy);
    } else {
      this.energyBarFill.setFillStyle(COLORS.energy);
    }

    this.energyText.setText(
      `${Math.floor(this.resources.energy)}/${this.resources.batteryCapacity}`
    );

    const mass = Math.floor(this.resources.mass);
    const earned = Math.floor(this.resources.totalMassEarned);
    this.massText.setText(
      earned > mass ? `Mass: ${mass}  (earned: ${earned})` : `Mass: ${mass}`
    );

    const tier = getTierForMass(this.resources.totalMassEarned);

    // Tier progress bar
    const currentThreshold = tier <= 1 ? 0 : ([0, 0, 100, 500, 2000, 10000][tier] ?? 0);
    const nextThreshold = [0, 100, 500, 2000, 10000, 50000][tier] ?? 50000;
    const tierProgress = Math.min(1,
      (this.resources.totalMassEarned - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)
    );
    this.tierProgressFill.width = 118 * tierProgress; // 120 - 2px border
    this.tierText.setText(`Act ${tier}: ${getTierName(tier)}  → ${nextThreshold}`);

    // Weapon slot: burst cooldown
    if (this.combat) {
      const cooldownMax = this.combat.burstCooldownMax;
      const cooldownLeft = Math.max(0, this.combat.burstCooldown);
      const cooldownProgress = 1 - (cooldownLeft / cooldownMax); // 0 = just fired, 1 = ready
      const canBurst = this.resources.canBurst && cooldownLeft <= 0;

      this.weaponSlotFill.width = (100 - 4) * cooldownProgress; // slotW - 4px border

      if (canBurst) {
        this.weaponSlotFill.setFillStyle(0xffd93d, 1.0);
        this.weaponSlotBg.setStrokeStyle(1, 0xffd93d, 0.6);
        this.weaponSlotLabel.setColor("#ffd93d");
      } else {
        this.weaponSlotFill.setFillStyle(0xffd93d, 0.4);
        this.weaponSlotBg.setStrokeStyle(1, 0xffd93d, 0.2);
        this.weaponSlotLabel.setColor("#777");
      }

      if (this.inputManager?.isGamepad) {
        this.weaponSlotHint.setText("[A]");
      } else {
        this.weaponSlotHint.setText("[SPACE]");
      }
    }

    // Switch controls hint based on last active input device
    if (this.inputManager?.isGamepad) {
      this.controlsHint.setText("Left stick move  ·  A burst  ·  LB boost");
    } else {
      this.controlsHint.setText("WASD move  ·  SPACE burst  ·  SHIFT boost");
    }
  }
}
