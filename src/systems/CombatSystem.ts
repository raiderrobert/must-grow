import Phaser from "phaser";
import { Player } from "@/entities/Player";
import { SpaceObject } from "@/entities/SpaceObject";
import { Debris } from "@/entities/Debris";
import { ResourceManager } from "@/systems/ResourceManager";
import { ZoneManager } from "@/systems/ZoneManager";
import { COLORS, ENERGY_FROM_DESTROY_BASE } from "@/constants";
import type { AudioManager } from "@/systems/AudioManager";

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private resources: ResourceManager;
  private zones: ZoneManager;
  private audio: AudioManager | null = null;
  private debrisList: Debris[] = [];
  private beamGraphics: Phaser.GameObjects.Graphics;
  private droneGraphics: Phaser.GameObjects.Graphics;
  private droneBeamGraphics: Phaser.GameObjects.Graphics;

  // Auto-fire state
  private autoFireTimer: number = 0;

  // Burst fire state
  burstCooldown: number = 0;
  private burstQueue: number = 0;
  private burstFireTimer: number = 0;
  private readonly BURST_FIRE_INTERVAL = 80; // ms between shots in a burst

  // Drone state
  private droneAngles: number[] = [];
  private droneCooldowns: number[] = [];
  private readonly DRONE_ORBIT_RADIUS = 60;
  private readonly DRONE_FIRE_INTERVAL = 2500;
  private readonly DRONE_DAMAGE = 5;

  // ── Stats (modified by upgrade cards) ────────────────────────────
  autoFireCooldown: number = 900;  // ms between auto shots
  autoShotCount: number = 1;       // shots per auto trigger
  spreadAngle: number = 0;         // total spread in degrees
  beamDamage: number = 10;
  beamRange: number = 300;
  burstShotCount: number = 3;      // shots per manual burst activation
  burstCooldownMax: number = 800;  // ms before another burst allowed
  debrisPickupRange: number = 400; // world pixels — debris pulled toward player within this radius

  debrisGroup!: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    resources: ResourceManager,
    zones: ZoneManager
  ) {
    this.scene = scene;
    this.player = player;
    this.resources = resources;
    this.zones = zones;
    this.beamGraphics = scene.add.graphics();
    this.droneGraphics = scene.add.graphics().setDepth(5);
    this.droneBeamGraphics = scene.add.graphics().setDepth(5);
    this.debrisGroup = scene.physics.add.group();

    if (!scene.textures.exists("particle")) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("particle", 4, 4);
      g.destroy();
    }
  }

  setAudio(audio: AudioManager): void {
    this.audio = audio;
  }

  getWorldGraphics(): Phaser.GameObjects.Graphics[] {
    return [this.beamGraphics, this.droneGraphics, this.droneBeamGraphics];
  }

  /** Called by GameScene when the player presses the burst key. */
  triggerBurst(): void {
    if (this.burstCooldown > 0) return;
    if (!this.resources.spendBurst()) return;
    this.burstQueue = this.burstShotCount;
    this.burstFireTimer = 0;
    this.burstCooldown = this.burstCooldownMax;
  }

  private findNearest(fromX: number, fromY: number, range: number): SpaceObject | null {
    let nearest: SpaceObject | null = null;
    let nearestDist = range;
    for (const obj of this.zones.getObjects()) {
      const dist = Phaser.Math.Distance.Between(fromX, fromY, obj.sprite.x, obj.sprite.y);
      if (dist < nearestDist) { nearest = obj; nearestDist = dist; }
    }
    return nearest;
  }

  private fireBeamsAt(
    fromX: number,
    fromY: number,
    target: SpaceObject,
    shotCount: number,
    spread: number,
    damage: number,
    color: number = COLORS.beam,
    volumeScale: number = 1
  ): void {
    const baseAngle = Phaser.Math.Angle.Between(fromX, fromY, target.sprite.x, target.sprite.y);
    const spreadRad = Phaser.Math.DegToRad(spread);
    const step = shotCount > 1 ? spreadRad / (shotCount - 1) : 0;
    const startAngle = baseAngle - spreadRad / 2;

    this.beamGraphics.lineStyle(2, color, 0.85);
    for (let i = 0; i < shotCount; i++) {
      const angle = shotCount === 1 ? baseAngle : startAngle + step * i;
      const range = this.beamRange * 1.2;
      this.beamGraphics.lineBetween(
        fromX, fromY,
        fromX + Math.cos(angle) * range,
        fromY + Math.sin(angle) * range
      );
    }

    this.scene.time.delayedCall(90, () => this.beamGraphics.clear());
    this.audio?.play("sfx_zap", volumeScale * 0.7);

    // Primary shot always hits the aimed target
    const destroyed = target.takeDamage(damage);
    if (destroyed) {
      this.audio?.play("sfx_explosion", 0.8);
      this.createExplosion(target.sprite.x, target.sprite.y, target.config.color);
      this.spawnDebris(target);
      this.resources.addMass(target.config.massYield);
      this.resources.onKill();
      this.zones.removeObject(target);
    }
  }

  private updateAutoFire(delta: number): void {
    this.autoFireTimer += delta;
    if (this.autoFireTimer < this.autoFireCooldown) return;
    this.autoFireTimer = 0;

    const nearest = this.findNearest(this.player.x, this.player.y, this.beamRange);
    if (!nearest) return;

    this.fireBeamsAt(
      this.player.x, this.player.y,
      nearest,
      this.autoShotCount,
      this.spreadAngle,
      this.beamDamage,
      COLORS.beam,
      0.5
    );
  }

  private updateBurstQueue(delta: number): void {
    if (this.burstQueue <= 0) return;

    this.burstFireTimer += delta;
    if (this.burstFireTimer < this.BURST_FIRE_INTERVAL) return;
    this.burstFireTimer = 0;
    this.burstQueue--;

    const nearest = this.findNearest(this.player.x, this.player.y, this.beamRange * 1.3);
    if (!nearest) return;

    this.fireBeamsAt(
      this.player.x, this.player.y,
      nearest,
      Math.max(1, Math.ceil(this.autoShotCount * 1.5)),
      this.spreadAngle + 10,
      Math.round(this.beamDamage * 1.5),
      0xffd93d, // gold burst color
      1.0
    );
  }

  createExplosionAt(x: number, y: number, color: number): void {
    this.createExplosion(x, y, color);
  }

  private createExplosion(x: number, y: number, color: number): void {
    const particles = this.scene.add.particles(x, y, "particle", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.6, end: 0 },
      tint: color,
      lifespan: 400,
      quantity: 12,
      emitting: false,
    });
    particles.explode(12);
    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  private spawnDebris(source: SpaceObject): void {
    const count = 2 + Math.floor(Math.random() * 3);
    const energyEach = (source.config.energyYield + ENERGY_FROM_DESTROY_BASE) / count;
    for (let i = 0; i < count; i++) {
      const d = new Debris(this.scene, {
        x: source.sprite.x, y: source.sprite.y,
        mass: 0, // mass awarded immediately on kill
        energy: energyEach,
      });
      this.debrisList.push(d);
      this.debrisGroup.add(d.sprite);
    }
  }

  collectDebris(debris: Debris): void {
    this.resources.energy = Math.min(
      this.resources.batteryCapacity,
      this.resources.energy + debris.energy
    );
    this.audio?.playWithVariation("sfx_pickup");
    const idx = this.debrisList.indexOf(debris);
    if (idx !== -1) this.debrisList.splice(idx, 1);
    debris.destroy();
  }

  private updateDroneSwarm(delta: number, droneCount: number): void {
    this.droneGraphics.clear();
    if (droneCount === 0) {
      this.droneAngles = [];
      this.droneCooldowns = [];
      return;
    }

    while (this.droneAngles.length < droneCount) {
      this.droneAngles.push((this.droneAngles.length / droneCount) * Math.PI * 2);
      this.droneCooldowns.push(Math.random() * this.DRONE_FIRE_INTERVAL);
    }
    this.droneAngles.length = droneCount;
    this.droneCooldowns.length = droneCount;

    const orbitRadius = this.DRONE_ORBIT_RADIUS + this.player.size * 0.5;
    const rotateSpeed = 0.0015 * delta;

    for (let i = 0; i < droneCount; i++) {
      this.droneAngles[i] += rotateSpeed;
      const droneX = this.player.x + Math.cos(this.droneAngles[i]) * orbitRadius;
      const droneY = this.player.y + Math.sin(this.droneAngles[i]) * orbitRadius;

      const fwd = this.droneAngles[i] + Math.PI / 2;
      const sz = 5;
      this.droneGraphics.fillStyle(COLORS.mass, 0.9);
      this.droneGraphics.fillTriangle(
        droneX + Math.cos(fwd) * sz, droneY + Math.sin(fwd) * sz,
        droneX + Math.cos(fwd + 2.3) * sz, droneY + Math.sin(fwd + 2.3) * sz,
        droneX + Math.cos(fwd - 2.3) * sz, droneY + Math.sin(fwd - 2.3) * sz
      );

      this.droneCooldowns[i] -= delta;
      if (this.droneCooldowns[i] <= 0) {
        this.droneCooldowns[i] = this.DRONE_FIRE_INTERVAL;
        const nearest = this.findNearest(droneX, droneY, this.beamRange);
        if (nearest) {
          this.droneBeamGraphics.lineStyle(1, COLORS.mass, 0.7);
          this.droneBeamGraphics.lineBetween(droneX, droneY, nearest.sprite.x, nearest.sprite.y);
          this.scene.time.delayedCall(80, () => this.droneBeamGraphics.clear());
          const destroyed = nearest.takeDamage(this.DRONE_DAMAGE);
          if (destroyed) {
            this.createExplosion(nearest.sprite.x, nearest.sprite.y, nearest.config.color);
            this.spawnDebris(nearest);
            this.resources.addMass(nearest.config.massYield);
            this.resources.onKill();
            this.zones.removeObject(nearest);
          }
        }
      }
    }
  }

  private updateDebrisAttraction(): void {
    // Pickup range scales with player size — always collect things you fly over
    const effectiveRange = this.debrisPickupRange + this.player.size;

    for (const d of this.debrisList) {
      if (!d.sprite.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, d.sprite.x, d.sprite.y
      );
      if (dist < effectiveRange) {
        const angle = Phaser.Math.Angle.Between(
          d.sprite.x, d.sprite.y, this.player.x, this.player.y
        );
        const sizeBoost = Math.max(1, this.player.size / 50); // 1x at size 50, 48x at size 2400
        const pullSpeed = (600 + (1 - dist / effectiveRange) * 1200) * sizeBoost;
        d.sprite.body!.velocity.x = Math.cos(angle) * pullSpeed;
        d.sprite.body!.velocity.y = Math.sin(angle) * pullSpeed;
      }
    }
  }

  update(delta: number, droneCount: number = 0): void {
    if (this.burstCooldown > 0) this.burstCooldown -= delta;

    this.updateAutoFire(delta);
    this.updateBurstQueue(delta);
    this.updateDebrisAttraction();
    this.updateDroneSwarm(delta, droneCount);

    this.debrisList = this.debrisList.filter(d => d.sprite.active);
  }
}
