import Phaser from "phaser";
import QRCode from "qrcode";

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

  async create(): Promise<void> {
    // Generate QR code from current URL
    const url = window.location.href;
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      // Load the QR code as an image
      this.load.image("qrcode", qrDataUrl);
      this.load.once("complete", () => {
        const { width, height } = this.scale;
        const qrImage = this.add.image(width - 150, height - 150, "qrcode");
        qrImage.setScale(0.5);
        qrImage.setAlpha(0.8);

        // Label
        this.add.text(width - 150, height - 40, "Scan to play!", {
          fontSize: "14px",
          color: "#6c63ff",
        }).setOrigin(0.5);
      });
      this.load.start();
    } catch (err) {
      console.warn("Failed to generate QR code:", err);
    }

    // Wait a bit before starting game scene to let QR code load
    this.load.once("complete", () => {
      this.time.delayedCall(500, () => {
        this.scene.start("GameScene");
      });
    });

    // Fallback timeout in case load never completes
    this.time.delayedCall(2000, () => {
      if (this.scene.isActive("BootScene")) {
        this.scene.start("GameScene");
      }
    });
  }
}
