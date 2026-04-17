import QRCode from "qrcode";

/**
 * Generates and displays a QR code on a Phaser scene that can be clicked to enlarge.
 * 
 * Usage:
 *   import { createQRCode } from "@/ui/QRCode";
 *   const qrObjects = createQRCode(scene);
 *   // Later, destroy qrObjects when done:
 *   qrObjects.forEach(obj => obj.destroy());
 */
export function createQRCode(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const { width, height } = scene.scale;

  // Generate QR code from current URL
  const url = window.location.href;

  QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  })
    .then((qrDataUrl) => {
      // Create image from data URL
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        scene.textures.addCanvas("qrcode", canvas);

        // Small QR in bottom-right
        const qrImage = scene.add.image(width - 80, height - 80, "qrcode");
        qrImage.setScale(0.35);
        qrImage.setAlpha(0.8);
        qrImage.setInteractive({ useHandCursor: true });

        // Label
        const label = scene.add.text(width - 80, height - 20, "Click to enlarge", {
          fontSize: "11px",
          color: "#6c63ff",
        });
        label.setOrigin(0.5);

        // Track for cleanup
        objects.push(qrImage, label);

        // Click to show enlarged QR
        qrImage.on("pointerdown", () => showEnlargedQR(scene, qrDataUrl, width, height));
      };
      img.src = qrDataUrl;
    })
    .catch((err) => {
      console.warn("Failed to generate QR code:", err);
    });

  return objects;
}

function showEnlargedQR(scene: Phaser.Scene, dataUrl: string, screenW: number, screenH: number): void {
  const overlay = scene.add.rectangle(screenW / 2, screenH / 2, screenW, screenH, 0x000000, 0.9)
    .setScrollFactor(0)
    .setDepth(900)
    .setInteractive();

  const qrSize = Math.min(screenW, screenH) * 0.7;
  const qrImage = scene.add.image(screenW / 2, screenH / 2 - 40, "qrcode")
    .setScrollFactor(0)
    .setDepth(901)
    .setScale(qrSize / 256);

  const title = scene.add.text(screenW / 2, screenH / 2 + qrSize / 2 + 30, "Scan to play!", {
    fontFamily: "monospace",
    fontSize: "24px",
    color: "#4ecdc4",
  })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(901);

  const closeHint = scene.add.text(screenW / 2, screenH - 60, "Click anywhere to close", {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#666",
  })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(901);

  // Click overlay to dismiss
  overlay.once("pointerdown", () => {
    overlay.destroy();
    qrImage.destroy();
    title.destroy();
    closeHint.destroy();
  });
}
