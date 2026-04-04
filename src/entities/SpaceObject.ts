import Phaser from "phaser";

export interface SpaceObjectConfig {
  x: number;
  y: number;
  size: number;
  health: number;
  massYield: number;
  energyYield: number;
  gravityMass: number; // 0 for asteroids, large for planets
  color: number;
  name?: string; // for named objects like "Mars"
  chewClicks?: number; // clicks to consume via clamping (Tier 1)
  bindingMassThreshold?: number;
  healRate?: number;
}

export class SpaceObject {
  sprite: Phaser.Physics.Arcade.Sprite;
  config: SpaceObjectConfig;
  health: number;
  chewClicksRemaining: number;
  isBeingChewed: boolean = false;
  bindingMassThreshold: number;
  healRate: number;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, config: SpaceObjectConfig) {
    this.scene = scene;
    this.config = config;
    this.health = config.health;
    this.chewClicksRemaining =
      config.chewClicks ?? Math.ceil(config.health / 10);
    this.bindingMassThreshold =
      config.bindingMassThreshold ?? config.gravityMass * 0.5;
    this.healRate =
      config.healRate ??
      (config.gravityMass > 0 ? config.health * 0.05 : 0);

    // Generate circle texture
    const key = `space_obj_${config.color}_${Math.round(config.size)}`;
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.fillStyle(config.color, 1);
      g.fillCircle(config.size, config.size, config.size);
      g.lineStyle(1, 0xffffff, 0.2);
      g.strokeCircle(config.size, config.size, config.size);
      g.generateTexture(key, config.size * 2, config.size * 2);
      g.destroy();
    }

    this.sprite = scene.physics.add.sprite(config.x, config.y, key);
    this.sprite.setData("spaceObject", this);

    // Slight random drift
    const vx = (Math.random() - 0.5) * 20;
    const vy = (Math.random() - 0.5) * 20;
    this.sprite.setVelocity(vx, vy);
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    // Flash white briefly
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });
    return this.health <= 0;
  }

  /** Returns mass per chew click. */
  chew(): { mass: number; energy: number; depleted: boolean } {
    this.chewClicksRemaining--;
    const totalClicks = this.config.chewClicks ?? 1;
    const massPerChew = this.config.massYield / totalClicks;
    const energyPerChew = this.config.energyYield / totalClicks;
    return {
      mass: massPerChew,
      energy: energyPerChew,
      depleted: this.chewClicksRemaining <= 0,
    };
  }

  updateHealing(delta: number, playerMass: number): void {
    if (this.bindingMassThreshold <= 0) return;
    if (playerMass >= this.bindingMassThreshold) return;
    if (this.health >= this.config.health) return;
    this.health = Math.min(
      this.health + this.healRate * (delta / 1000),
      this.config.health
    );
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
