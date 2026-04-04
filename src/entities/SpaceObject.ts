import Phaser from "phaser";

export interface SpaceObjectConfig {
  x: number;
  y: number;
  size: number;
  health: number;
  massYield: number;
  energyYield: number;
  gravityMass: number;
  color: number;
  name?: string;
  velocityX?: number;
  velocityY?: number;
}

export class SpaceObject {
  sprite: Phaser.Physics.Arcade.Sprite;
  config: SpaceObjectConfig;
  health: number;
  readonly maxHealth: number;
  isBeingChewed: boolean = false; // kept for compatibility

  private scene: Phaser.Scene;
  private damageOverlay?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, config: SpaceObjectConfig) {
    this.scene = scene;
    this.config = config;
    this.health = config.health;
    this.maxHealth = config.health;

    const key = `space_obj_${config.color}_${Math.round(config.size)}`;
    if (!scene.textures.exists(key)) {
      const g = scene.add.graphics();
      g.fillStyle(config.color, 1);
      g.fillCircle(config.size, config.size, config.size);
      g.lineStyle(Math.max(1, config.size * 0.02), 0xffffff, 0.2);
      g.strokeCircle(config.size, config.size, config.size);
      g.generateTexture(key, config.size * 2, config.size * 2);
      g.destroy();
    }

    this.sprite = scene.physics.add.sprite(config.x, config.y, key);
    this.sprite.setData("spaceObject", this);

    const vx = config.velocityX ?? 0;
    const vy = config.velocityY ?? 0;
    this.sprite.setVelocity(vx, vy);
  }

  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite.active) {
        this.sprite.clearTint();
        this.updateDamageVisual();
      }
    });
    return this.health <= 0;
  }

  private updateDamageVisual(): void {
    const ratio = this.health / this.maxHealth;
    if (ratio > 0.75) return;

    if (!this.damageOverlay) {
      this.damageOverlay = this.scene.add.graphics().setDepth(2);
    }
    this.damageOverlay.clear();

    const x = this.sprite.x;
    const y = this.sprite.y;
    const r = this.config.size;
    const crackAlpha = 1 - ratio;
    this.damageOverlay.lineStyle(Math.max(1, r * 0.03), 0xff4400, crackAlpha * 0.8);

    const crackCount = Math.floor((1 - ratio) * 6) + 1;
    const seed = this.config.x * 1000 + this.config.y;
    for (let i = 0; i < crackCount; i++) {
      const a = ((seed * (i + 1) * 137.5) % 360) * (Math.PI / 180);
      const len = r * (0.5 + ((seed * (i + 3)) % 50) / 100);
      this.damageOverlay.lineBetween(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
  }

  get healthRatio(): number {
    return this.health / this.maxHealth;
  }

  destroy(): void {
    this.damageOverlay?.destroy();
    this.sprite.destroy();
  }
}
