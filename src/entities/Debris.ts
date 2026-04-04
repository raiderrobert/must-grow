import Phaser from "phaser";
import { COLORS } from "@/constants";

export interface DebrisConfig {
  x: number;
  y: number;
  mass: number;
  energy: number;
}

export class Debris {
  sprite: Phaser.Physics.Arcade.Sprite;
  mass: number;
  energy: number;

  private scene: Phaser.Scene;
  private lifetime: number = 10000; // ms before despawn
  private timer: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config: DebrisConfig) {
    this.scene = scene;
    this.mass = config.mass;
    this.energy = config.energy;

    const key = "debris";
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.fillStyle(COLORS.mass, 0.8);
      g.fillCircle(4, 4, 4);
      g.generateTexture(key, 8, 8);
      g.destroy();
    }

    this.sprite = scene.physics.add.sprite(config.x, config.y, key);
    this.sprite.setData("debris", this);

    // Scatter outward
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    this.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.sprite.setDamping(true);
    this.sprite.setDrag(0.97);

    // Fade out before despawn
    this.timer = scene.time.delayedCall(this.lifetime, () => this.destroy());
    scene.time.delayedCall(this.lifetime - 2000, () => {
      if (this.sprite.active) {
        scene.tweens.add({
          targets: this.sprite,
          alpha: 0,
          duration: 2000,
          ease: "Power2",
        });
      }
    });
  }

  destroy(): void {
    this.timer?.destroy();
    if (this.sprite?.active) this.sprite.destroy();
  }
}
