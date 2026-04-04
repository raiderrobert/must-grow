import Phaser from "phaser";
import { COLORS } from "@/constants";

/** Displays a hint showing the power key — no longer interactive (use K or gamepad B). */
export class GeneratorButton {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    const bg = scene.add
      .rectangle(0, 0, 130, 40, COLORS.energy, 0.15)
      .setStrokeStyle(1, COLORS.energy, 0.4);

    const label = scene.add
      .text(0, 0, "⚡ [K] POWER", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffd93d",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    const container = scene.add.container(x, y, [bg, label]);
    container.setScrollFactor(0);
    container.setDepth(100);
  }

  // No-op — kept so HUD constructor call is unchanged
  setAudio(_audio: unknown): void {}
}
