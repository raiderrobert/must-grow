import Phaser from "phaser";
import {
  PLAYER_THRUST_POWER,
  PLAYER_START_SIZE,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  COLORS,
} from "@/constants";
import type { InputManager } from "@/systems/InputManager";

export class Player {
  body: Phaser.Physics.Arcade.Sprite;
  size: number;
  tier: number = 1;
  private scene: Phaser.Scene;
  private thrustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private input!: InputManager;

  isLocked: boolean = false;
  isBoosting: boolean = false;

  // Stats (modified by upgrades and cards)
  speed: number = PLAYER_THRUST_POWER;
  thrustPower: number = 50;
  gravityResistance: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.size = PLAYER_START_SIZE;

    const textureKey = "player_station";
    const g = scene.add.graphics();
    this.drawStation(g, 32, 32, 32);
    g.generateTexture(textureKey, 64, 64);
    g.destroy();

    this.body = scene.physics.add.sprite(
      PLAYER_SPAWN_X,
      PLAYER_SPAWN_Y,
      textureKey,
    );
    this.body.setScale(this.size / 32);

    scene.cameras.main.startFollow(this.body, true, 1, 1);
    this.initParticles();
  }

  setInputManager(im: InputManager): void {
    this.input = im;
  }

  private drawStation(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    g.fillStyle(COLORS.station);
    const sides = 8;
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push(
        new Phaser.Geom.Point(
          cx + Math.cos(angle) * radius * 0.7,
          cy + Math.sin(angle) * radius * 0.7,
        ),
      );
    }
    g.fillPoints(points, true);
    g.lineStyle(2, COLORS.stationGlow, 0.6);
    g.strokePoints(points, true);
    g.fillStyle(COLORS.stationGlow);
    g.fillCircle(cx, cy, radius * 0.15);
  }

  initParticles(): void {
    if (!this.scene.textures.exists("particle")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("particle", 4, 4);
      g.destroy();
    }
    this.thrustEmitter = this.scene.add.particles(0, 0, "particle", {
      speed: { min: 40, max: 40 },
      radial: false,
      scale: { start: 0.4, end: 0 },
      tint: COLORS.energy,
      lifespan: 300,
      quantity: 1,
      frequency: 50,
      follow: this.body,
      emitting: false,
      emitCallback: (particle: Phaser.GameObjects.Particles.Particle) => {
        const vel = (this.body.body as Phaser.Physics.Arcade.Body).velocity;
        const mx = this.input.moveX;
        const my = this.input.moveY;
        // Match player velocity so particle appears stationary relative to player,
        // then add exhaust kick opposite to acceleration direction
        particle.velocityX = vel.x + -mx * 150;
        particle.velocityY = vel.y + -my * 150;
      },
    });
  }

  update(_delta: number): void {
    if (this.isLocked) {
      this.body.setAccelerationX(0);
      this.body.setAccelerationY(0);
      if (this.thrustEmitter) this.thrustEmitter.emitting = false;
      return;
    }

    const mx = this.input.moveX;
    const my = this.input.moveY;
    const boostMult = this.isBoosting ? 2.0 : 1.0;
    const accel = this.speed * 8 * boostMult;

    this.body.setAccelerationX(
      mx !== 0 ? Math.sign(mx) * accel * Math.abs(mx) : 0,
    );
    this.body.setAccelerationY(
      my !== 0 ? Math.sign(my) * accel * Math.abs(my) : 0,
    );

    if (this.thrustEmitter) {
      this.thrustEmitter.emitting = this.input.isMoving;

      // Position emitter at the edge opposite to acceleration direction
      if (this.input.isMoving) {
        const len = Math.sqrt(mx * mx + my * my) || 1;
        this.thrustEmitter.followOffset.x = (-mx / len) * this.size;
        this.thrustEmitter.followOffset.y = (-my / len) * this.size;
      }
    }
  }

  applyGravity(gx: number, gy: number): void {
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += gx;
    body.velocity.y += gy;
  }

  getParticleEmitter():
    | Phaser.GameObjects.Particles.ParticleEmitter
    | undefined {
    return this.thrustEmitter;
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }

  setSize(newSize: number): void {
    this.size = newSize;
    this.body.setScale(newSize / 32);
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    body.setCircle(newSize, 32 - newSize, 32 - newSize);
  }
}
