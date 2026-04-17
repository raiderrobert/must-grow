import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Audio assets
    const audioFiles = [
      "sfx_zap",
      "sfx_explosion",
      "sfx_pickup",
      "sfx_power_up",
      "sfx_power_down",
      "sfx_upgrade",
      "sfx_game_over",
      "sfx_tier_up",
    ];
    for (const key of audioFiles) {
      this.load.audio(key, `assets/audio/${key}.wav`);
    }

    // Loading bar
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2, height / 2, 0, 20, 0x6c63ff);
    this.load.on("progress", (value: number) => {
      bar.width = width * 0.6 * value;
    });
  }

  create(): void {
    // Start game scene immediately - QR code goes on start screen
    this.scene.start("GameScene");
  }
}
