import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "@/constants";

/** Creates parallax starfield layers drawn to static textures. */
export function createStarfield(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const layers: Phaser.GameObjects.Image[] = [];
  const layerConfigs = [
    { count: 200, size: 1, alpha: 0.3, scrollFactor: 0.1 },
    { count: 150, size: 1.5, alpha: 0.5, scrollFactor: 0.3 },
    { count: 100, size: 2, alpha: 0.8, scrollFactor: 0.6 },
  ];

  for (const [i, config] of layerConfigs.entries()) {
    const key = `starfield_${i}`;
    const graphics = scene.add.graphics();
    graphics.fillStyle(COLORS.starfield, config.alpha);

    for (let s = 0; s < config.count; s++) {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
      graphics.fillCircle(x, y, config.size);
    }

    graphics.generateTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
    graphics.destroy();

    const image = scene.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, key);
    image.setScrollFactor(config.scrollFactor);
    image.setDepth(-10 + i);
    layers.push(image);
  }

  return layers;
}
