import Phaser from "phaser";
import { COLORS } from "@/constants";

/** Creates parallax starfield using small tiled textures (512x512 each). */
export function createStarfield(
  scene: Phaser.Scene
): Phaser.GameObjects.TileSprite[] {
  const layers: Phaser.GameObjects.TileSprite[] = [];
  const { width, height } = scene.scale;
  const tileSize = 512;

  const layerConfigs = [
    { count: 40, size: 1, alpha: 0.3, scrollFactor: 0.1 },
    { count: 30, size: 1.5, alpha: 0.5, scrollFactor: 0.3 },
    { count: 20, size: 2, alpha: 0.8, scrollFactor: 0.6 },
  ];

  for (const [i, config] of layerConfigs.entries()) {
    const key = `starfield_${i}`;
    const graphics = scene.add.graphics();
    graphics.fillStyle(COLORS.starfield, config.alpha);

    for (let s = 0; s < config.count; s++) {
      const x = Math.random() * tileSize;
      const y = Math.random() * tileSize;
      graphics.fillCircle(x, y, config.size);
    }

    graphics.generateTexture(key, tileSize, tileSize);
    graphics.destroy();

    const tile = scene.add.tileSprite(width / 2, height / 2, width, height, key);
    tile.setScrollFactor(0); // manually scrolled via tilePosition
    tile.setDepth(-10 + i);
    tile.setData("parallaxFactor", config.scrollFactor);
    layers.push(tile);
  }

  return layers;
}

/** Call each frame to update parallax based on camera position. */
export function updateStarfield(
  layers: Phaser.GameObjects.TileSprite[],
  camera: Phaser.Cameras.Scene2D.Camera
): void {
  for (const layer of layers) {
    const factor = layer.getData("parallaxFactor") as number;
    layer.tilePositionX = camera.scrollX * factor;
    layer.tilePositionY = camera.scrollY * factor;
  }
}
