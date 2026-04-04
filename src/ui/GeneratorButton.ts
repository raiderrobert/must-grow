import Phaser from "phaser";
import { COLORS } from "@/constants";
import { ResourceManager } from "@/systems/ResourceManager";
import type { AudioManager } from "@/systems/AudioManager";

export class GeneratorButton {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private resources: ResourceManager;
  private audio: AudioManager | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resources: ResourceManager
  ) {
    this.resources = resources;

    this.bg = scene.add
      .rectangle(0, 0, 120, 40, COLORS.energy, 0.3)
      .setStrokeStyle(2, COLORS.energy);

    const label = scene.add
      .text(0, 0, "⚡ POWER", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd93d",
      })
      .setOrigin(0.5);

    this.container = scene.add.container(x, y, [this.bg, label]);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on("pointerdown", () => {
      this.resources.manualGenerate();
      this.audio?.play("sfx_power_up");
      this.bg.setFillStyle(COLORS.energy, 0.6);
      scene.time.delayedCall(100, () => {
        this.bg.setFillStyle(COLORS.energy, 0.3);
      });
    });
  }

  setAudio(audio: AudioManager): void {
    this.audio = audio;
  }
}
