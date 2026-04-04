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
  private attackKeys!: Phaser.Input.Keyboard.Key[];
  private boostKey!: Phaser.Input.Keyboard.Key;
  private upgradeKey!: Phaser.Input.Keyboard.Key;
  private pad: Phaser.Input.Gamepad.Gamepad | null = null;
  private thrustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // One-shot gamepad flags (set by event, cleared by consume methods)
  private padAttackJust: boolean = false;
  private padUpgradeJust: boolean = false;

  isLocked: boolean = false;
  isBoosting: boolean = false;

  // Stats (modified by upgrades and cards)
  speed: number = PLAYER_BASE_SPEED;
  thrustPower: number = 50;
  gravityResistance: number = 0; // 0 = full gravity, 0.9 = 90% reduction

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
    this.body.setDrag(0.99); // snappy stop
    this.body.setScale(this.size / 32);

    // Movement keys
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Action keys
    this.attackKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
    ];
    this.boostKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.upgradeKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Gamepad support
    if (scene.input.gamepad) {
      scene.input.gamepad.once(
        "connected",
        (pad: Phaser.Input.Gamepad.Gamepad) => { this.pad = pad; }
      );
      scene.input.gamepad.on(
        "down",
        (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
          if (button.index === 0) this.padAttackJust = true;
          if (button.index === 9) this.padUpgradeJust = true;
        }
      );
    }

    // Camera follow
    scene.cameras.main.startFollow(this.body, true, 0.08, 0.08);

    // Particles
    this.initParticles();
  }

  private drawStation(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number
  ): void {
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
    // Refresh gamepad reference
    if (!this.pad && (this.scene.input.gamepad?.total ?? 0) > 0) {
      this.pad = this.scene.input.gamepad!.getPad(0);
    }

    if (this.isLocked) {
      this.body.setAccelerationX(0);
      this.body.setAccelerationY(0);
      if (this.thrustEmitter) this.thrustEmitter.emitting = false;
      return;
    }

    const stickX = this.pad?.axes[0]?.getValue() ?? 0;
    const stickY = this.pad?.axes[1]?.getValue() ?? 0;
    const boostMult = this.isBoosting ? 2.0 : 1.0;
    const accel = this.speed * 8 * boostMult;

    // Horizontal
    if (this.cursors.left.isDown || this.wasd.A.isDown || stickX < -0.2) {
      this.body.setAccelerationX(-accel * Math.max(Math.abs(stickX), 1));
    } else if (this.cursors.right.isDown || this.wasd.D.isDown || stickX > 0.2) {
      this.body.setAccelerationX(accel * Math.max(Math.abs(stickX), 1));
    } else {
      this.body.setAccelerationX(0);
    }

    // Vertical
    if (this.cursors.up.isDown || this.wasd.W.isDown || stickY < -0.2) {
      this.body.setAccelerationY(-accel * Math.max(Math.abs(stickY), 1));
    } else if (this.cursors.down.isDown || this.wasd.S.isDown || stickY > 0.2) {
      this.body.setAccelerationY(accel * Math.max(Math.abs(stickY), 1));
    } else {
      this.body.setAccelerationY(0);
    }

    // Use Phaser's built-in maxVelocity
    const maxSpeed = this.speed * (this.isBoosting ? 2.0 : 1.0);
    (this.body.body as Phaser.Physics.Arcade.Body).setMaxVelocity(maxSpeed, maxSpeed);

    // Thrust particles
    const isThrusting =
      this.cursors.up.isDown || this.wasd.W.isDown ||
      this.cursors.down.isDown || this.wasd.S.isDown ||
      this.cursors.left.isDown || this.wasd.A.isDown ||
      this.cursors.right.isDown || this.wasd.D.isDown ||
      Math.abs(stickX) > 0.2 || Math.abs(stickY) > 0.2;

    if (this.thrustEmitter) {
      this.thrustEmitter.emitting = isThrusting;
    }
  }

  /** Returns true if Space/J or gamepad A was just pressed. Clears the flag. */
  consumeAttack(): boolean {
    const keyJustDown = this.attackKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
    const padJustDown = this.padAttackJust;
    this.padAttackJust = false;
    return keyJustDown || padJustDown;
  }

  /** Returns true while Shift or gamepad LB is held. */
  isBoostHeld(): boolean {
    const keyHeld = this.boostKey.isDown;
    const padHeld = (this.pad?.buttons[4]?.pressed ?? false);
    return keyHeld || padHeld;
  }

  /** Returns true if E or gamepad Start was just pressed. Clears the flag. */
  consumeUpgradeToggle(): boolean {
    const keyJustDown = Phaser.Input.Keyboard.JustDown(this.upgradeKey);
    const padJustDown = this.padUpgradeJust;
    this.padUpgradeJust = false;
    return keyJustDown || padJustDown;
  }

  getParticleEmitter(): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    return this.thrustEmitter;
  }

  applyGravity(gx: number, gy: number): void {
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    body.velocity.x += gx;
    body.velocity.y += gy;
  }

  get x(): number { return this.body.x; }
  get y(): number { return this.body.y; }

  setSize(newSize: number): void {
    this.size = newSize;
    const scale = newSize / 32;
    this.body.setScale(scale);
    const body = this.body.body as Phaser.Physics.Arcade.Body;
    const radius = newSize;
    body.setCircle(radius, 32 - radius, 32 - radius);
  }
}
