import Phaser from "phaser";
import { COLORS } from "@/constants";
import { ResourceManager } from "@/systems/ResourceManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import type { AudioManager } from "@/systems/AudioManager";

export class HUD {
  private scene: Phaser.Scene;
  private resources: ResourceManager;

  private energyBarBg!: Phaser.GameObjects.Rectangle;
  private energyBarFill!: Phaser.GameObjects.Rectangle;
  private energyText!: Phaser.GameObjects.Text;
  private massText!: Phaser.GameObjects.Text;
  private tierText!: Phaser.GameObjects.Text;
  private burstIndicator!: Phaser.GameObjects.Text;

  // All tracked HUD objects for camera ignore
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    resources: ResourceManager,
    audio?: AudioManager
  ) {
    this.scene = scene;
    this.resources = resources;

    this.createEnergyBar();
    this.createMassCounter();
    this.createTierIndicator();
    this.createBurstIndicator();

    if (audio) {
      const muteBtn = scene.add
        .text(scene.scale.width - 40, scene.scale.height - 40, "🔊", {
          fontFamily: "monospace",
          fontSize: "20px",
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive({ useHandCursor: true });
      muteBtn.on("pointerdown", () => {
        const muted = audio.toggleMute();
        muteBtn.setText(muted ? "🔇" : "🔊");
      });
      this.objects.push(muteBtn);
    }

    const hint = scene.add
      .text(
        scene.scale.width / 2,
        scene.scale.height - 16,
        "WASD move  ·  SHIFT boost  ·  SPACE/J burst fire",
        { fontFamily: "monospace", fontSize: "11px", color: "#666" }
      )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0.7);
    this.objects.push(hint);
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

  private createBurstIndicator(): void {
    this.burstIndicator = this.scene.add
      .text(20, 94, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffd93d",
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.objects.push(this.burstIndicator);
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

    this.massText.setText(
      `Mass: ${Math.floor(this.resources.mass)} (total: ${Math.floor(this.resources.totalMassEarned)})`
    );

    const tier = getTierForMass(this.resources.totalMassEarned);
    this.tierText.setText(`Tier ${tier}: ${getTierName(tier)}`);

    this.burstIndicator.setText(
      this.resources.canBurst ? "BURST ready [SPC]" : `burst ${Math.floor(this.resources.energy)}/${this.resources.burstCost}`
    );
  }
}
