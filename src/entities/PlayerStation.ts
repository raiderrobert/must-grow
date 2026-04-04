import Phaser from "phaser";
import {
  PLAYER_BASE_SPEED,
  PLAYER_START_SIZE,
  COLORS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "@/constants";

export class PlayerStation {
  body: Phaser.Physics.Arcade.Sprite;
  size: number;
  tier: number = 1;
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private thrustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  isLocked: boolean = false;

  // Stats (modified by upgrades)
  speed: number = PLAYER_BASE_SPEED;
  thrustPower: number = 50;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.size = PLAYER_START_SIZE;

    // Create texture
    const textureKey = "player_station";
    const g = scene.add.graphics();
    this.drawStation(g, 32, 32, 32);
    g.generateTexture(textureKey, 64, 64);
    g.destroy();

    // Physics sprite
    this.body = scene.physics.add.sprite(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      textureKey
    );
    this.body.setCollideWorldBounds(true);
    this.body.setDamping(true);
    this.body.setDrag(0.95);
    this.body.setScale(this.size / 32);

    // Input
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Camera follow
    scene.cameras.main.startFollow(this.body, true, 0.08, 0.08);

    // Particle setup
    this.initParticles();
  }

  private drawStation(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number
  ): void {
    // Main body — octagon shape
    g.fillStyle(COLORS.station);
    const sides = 8;
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push(
        new Phaser.Geom.Point(
          cx + Math.cos(angle) * radius * 0.7,
          cy + Math.sin(angle) * radius * 0.7
        )
      );
    }
    g.fillPoints(points, true);

    // Glow outline
    g.lineStyle(2, COLORS.stationGlow, 0.6);
    g.strokePoints(points, true);

    // Center dot
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
      speed: { min: 20, max: 60 },
      scale: { start: 0.4, end: 0 },
      tint: COLORS.energy,
      lifespan: 300,
      quantity: 1,
      frequency: 50,
      follow: this.body,
      emitting: false,
    });
  }

  update(_delta: number): void {
    if (this.isLocked) {
      this.body.setAccelerationX(0);
      this.body.setAccelerationY(0);
      if (this.thrustEmitter) this.thrustEmitter.emitting = false;
      return;
    }
    const accel = this.speed * 3;

    // Horizontal
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.body.setAccelerationX(-accel);
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.body.setAccelerationX(accel);
    } else {
      this.body.setAccelerationX(0);
    }

    // Vertical
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.body.setAccelerationY(-accel);
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.body.setAccelerationY(accel);
    } else {
      this.body.setAccelerationY(0);
    }

    // Cap speed
    const vel = this.body.body!.velocity;
    const mag = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    if (mag > this.speed) {
      this.body.body!.velocity.scale(this.speed / mag);
    }

    // Thrust particles
    const isThrusting =
      this.cursors.up.isDown ||
      this.wasd.W.isDown ||
      this.cursors.down.isDown ||
      this.wasd.S.isDown ||
      this.cursors.left.isDown ||
      this.wasd.A.isDown ||
      this.cursors.right.isDown ||
      this.wasd.D.isDown;

    if (this.thrustEmitter) {
      this.thrustEmitter.emitting = isThrusting;
    }
  }

  applyGravity(gx: number, gy: number): void {
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += gx;
    body.velocity.y += gy;
  }

  get x(): number {
    return this.body.x;
  }
  get y(): number {
    return this.body.y;
  }

  setSize(newSize: number): void {
    this.size = newSize;
    const scale = newSize / 32;
    this.body.setScale(scale);
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    // Radius in unscaled texture-space; offset centers it in the 64x64 texture.
    const radius = newSize;
    body.setCircle(radius, 32 - radius, 32 - radius);
  }
}
