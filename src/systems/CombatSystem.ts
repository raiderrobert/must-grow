import Phaser from "phaser";
import { PlayerStation } from "@/entities/PlayerStation";
import { SpaceObject } from "@/entities/SpaceObject";
import { Debris } from "@/entities/Debris";
import { ResourceManager } from "@/systems/ResourceManager";
import { ZoneManager } from "@/systems/ZoneManager";
import { COLORS, ENERGY_FROM_DESTROY_BASE } from "@/constants";
import type { UpgradeManager } from "@/systems/UpgradeManager";
import type { AudioManager } from "@/systems/AudioManager";

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: PlayerStation;
  private resources: ResourceManager;
  private zones: ZoneManager;
  private upgrades: UpgradeManager | null = null;
  private audio: AudioManager | null = null;
  private debrisList: Debris[] = [];

  // State
  clampedTarget: SpaceObject | null = null;
  private beamCooldown: number = 0;
  private beamGraphics: Phaser.GameObjects.Graphics;
  private autoFireTimer: number = 0;
  private autoFireInterval: number = 1000;

  // Stats (modified by upgrades)
  clampRange: number = 80;
  beamDamage: number = 10;
  beamCooldownMax: number = 500;
  beamRange: number = 200;
  jawStrengthMultiplier: number = 1.0;
  chewSpeedMultiplier: number = 1.0;
  energyAmplifierMultiplier: number = 1.0;

  // Drone swarm
  private droneAngles: number[] = [];
  private droneCooldowns: number[] = [];
  private droneGraphics!: Phaser.GameObjects.Graphics;
  private droneBeamGraphics!: Phaser.GameObjects.Graphics;
  private readonly DRONE_ORBIT_RADIUS = 60;
  private readonly DRONE_FIRE_INTERVAL = 2500; // ms between drone shots
  private readonly DRONE_DAMAGE = 5;

  debrisGroup!: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    player: PlayerStation,
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

    // Ensure particle texture exists
    if (!scene.textures.exists("particle")) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("particle", 4, 4);
      g.destroy();
    }

  }

  setUpgrades(upgrades: UpgradeManager): void {
    this.upgrades = upgrades;
  }

  setAudio(audio: AudioManager): void {
    this.audio = audio;
  }

  /** Called when the player presses the attack button. */
  attackPressed(): void {
    if (this.clampedTarget) {
      this.chew();
      return;
    }

    if (this.player.tier === 1) {
      // Find nearest object in clamp range
      const objects = this.zones.getObjects();
      let nearest: SpaceObject | null = null;
      let nearestDist = this.clampRange;

      for (const obj of objects) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          obj.sprite.x, obj.sprite.y
        );
        if (dist < nearestDist) {
          nearest = obj;
          nearestDist = dist;
        }
      }

      if (nearest) {
        this.clampedTarget = nearest;
        nearest.isBeingChewed = true;
        const reducedClicks = Math.max(
          Math.ceil(nearest.chewClicksRemaining / this.chewSpeedMultiplier),
          1
        );
        nearest.chewClicksRemaining = reducedClicks;
        this.chew();
      }
    } else {
      // Fire beam at nearest object in range
      if (this.beamCooldown > 0) return;

      const objects = this.zones.getObjects();
      let nearest: SpaceObject | null = null;
      let nearestDist = this.beamRange;

      for (const obj of objects) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          obj.sprite.x, obj.sprite.y
        );
        if (dist < nearestDist) {
          nearest = obj;
          nearestDist = dist;
        }
      }

      if (nearest) this.fireBeam(nearest);
    }
  }

  private chew(): void {
    if (!this.clampedTarget) return;

    const result = this.clampedTarget.chew();
    this.resources.addMass(result.mass * this.jawStrengthMultiplier);
    this.resources.addEnergy(result.energy);

    if (result.depleted) {
      this.zones.removeObject(this.clampedTarget);
      this.clampedTarget = null;
    }
  }

  fireBeam(target: SpaceObject): void {
    this.beamCooldown = this.beamCooldownMax;

    this.beamGraphics.clear();
    this.beamGraphics.lineStyle(2, COLORS.beam, 0.8);
    this.beamGraphics.lineBetween(
      this.player.x,
      this.player.y,
      target.sprite.x,
      target.sprite.y
    );
    this.scene.time.delayedCall(100, () => this.beamGraphics.clear());

    this.audio?.play("sfx_zap");

    // Binding energy check — show "TOO SMALL" but still damage
    if (
      target.bindingMassThreshold > 0 &&
      this.resources.totalMassEarned < target.bindingMassThreshold
    ) {
      const text = this.scene.add
        .text(target.sprite.x, target.sprite.y - 20, "TOO SMALL", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#ff4444",
        })
        .setOrigin(0.5);
      this.scene.tweens.add({
        targets: text,
        alpha: 0,
        y: text.y - 20,
        duration: 1000,
        onComplete: () => text.destroy(),
      });
    }

    const destroyed = target.takeDamage(this.beamDamage);
    if (destroyed) {
      this.audio?.play("sfx_explosion");
      this.createExplosion(target.sprite.x, target.sprite.y, target.config.color);
      this.spawnDebris(target);
      this.resources.addEnergy(
        (target.config.energyYield + ENERGY_FROM_DESTROY_BASE) *
          this.energyAmplifierMultiplier
      );
      this.zones.removeObject(target);
    }
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
    const count = 3 + Math.floor(Math.random() * 3);
    const massEach = source.config.massYield / count;
    const energyEach = source.config.energyYield / count;

    for (let i = 0; i < count; i++) {
      const debris = new Debris(this.scene, {
        x: source.sprite.x,
        y: source.sprite.y,
        mass: massEach,
        energy: energyEach,
      });
      this.debrisList.push(debris);
      this.debrisGroup.add(debris.sprite);
    }
  }

  collectDebris(debris: Debris): void {
    this.resources.addMass(debris.mass);
    this.resources.addEnergy(debris.energy);
    this.audio?.playWithVariation("sfx_pickup");
    const idx = this.debrisList.indexOf(debris);
    if (idx !== -1) this.debrisList.splice(idx, 1);
    debris.destroy();
  }

  releaseClamp(): void {
    if (this.clampedTarget) {
      this.clampedTarget.isBeingChewed = false;
      this.clampedTarget = null;
    }
  }

  private updateAutoTurrets(delta: number, turretCount: number): void {
    if (turretCount === 0 || !this.resources.isSystemOnline("autoTurrets")) return;

    this.autoFireTimer += delta;
    if (this.autoFireTimer < this.autoFireInterval / turretCount) return;
    this.autoFireTimer = 0;

    const objects = this.zones.getObjects();
    let nearest: SpaceObject | null = null;
    let nearestDist = this.beamRange * 1.5;

    for (const obj of objects) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        obj.sprite.x,
        obj.sprite.y
      );
      if (dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    if (nearest) {
      this.fireBeam(nearest);
    }
  }

  updateTractorBeam(delta: number, tractorLevel: number): void {
    if (tractorLevel === 0 || !this.resources.isSystemOnline("tractorBeam")) return;
    void delta;

    const range = 150 + tractorLevel * 50;
    for (const debris of this.debrisList) {
      if (!debris.sprite.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        debris.sprite.x,
        debris.sprite.y
      );
      if (dist < range) {
        const angle = Phaser.Math.Angle.Between(
          debris.sprite.x,
          debris.sprite.y,
          this.player.x,
          this.player.y
        );
        const pullSpeed = 80 + tractorLevel * 30;
        debris.sprite.body!.velocity.x = Math.cos(angle) * pullSpeed;
        debris.sprite.body!.velocity.y = Math.sin(angle) * pullSpeed;

        if (dist < 30) {
          this.collectDebris(debris);
        }
      }
    }
  }

  updateGravityWell(delta: number, gravityWellLevel: number): void {
    if (gravityWellLevel === 0 || !this.resources.isSystemOnline("gravityWell")) return;

    const range = 300 + gravityWellLevel * 100;
    const objects = this.zones.getObjects();

    for (const obj of objects) {
      if (obj.isBeingChewed) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        obj.sprite.x,
        obj.sprite.y
      );
      if (dist < range && obj.config.size < this.player.size * 0.5) {
        const angle = Phaser.Math.Angle.Between(
          obj.sprite.x,
          obj.sprite.y,
          this.player.x,
          this.player.y
        );
        const pullSpeed = 30 + gravityWellLevel * 15;
        obj.sprite.body!.velocity.x +=
          Math.cos(angle) * pullSpeed * (delta / 1000);
        obj.sprite.body!.velocity.y +=
          Math.sin(angle) * pullSpeed * (delta / 1000);
      }
    }
  }

  private updateDroneSwarm(delta: number, droneCount: number): void {
    this.droneGraphics.clear();

    if (droneCount === 0 || !this.resources.isSystemOnline("drones")) {
      this.droneAngles = [];
      this.droneCooldowns = [];
      return;
    }

    // Resize arrays to match active drone count
    while (this.droneAngles.length < droneCount) {
      // Space new drones evenly in the orbit
      this.droneAngles.push(
        (this.droneAngles.length / droneCount) * Math.PI * 2
      );
      this.droneCooldowns.push(Math.random() * this.DRONE_FIRE_INTERVAL);
    }
    this.droneAngles.length = droneCount;
    this.droneCooldowns.length = droneCount;

    const orbitRadius =
      this.DRONE_ORBIT_RADIUS + this.player.size * 0.5;
    const rotateSpeed = 0.0015 * delta; // radians per ms

    for (let i = 0; i < droneCount; i++) {
      this.droneAngles[i] += rotateSpeed;
      const dx = Math.cos(this.droneAngles[i]) * orbitRadius;
      const dy = Math.sin(this.droneAngles[i]) * orbitRadius;
      const droneX = this.player.x + dx;
      const droneY = this.player.y + dy;

      // Draw drone body (small triangle pointing along orbit)
      const fwd = this.droneAngles[i] + Math.PI / 2;
      const size = 5;
      this.droneGraphics.fillStyle(COLORS.mass, 0.9);
      const pts = [
        new Phaser.Geom.Point(
          droneX + Math.cos(fwd) * size,
          droneY + Math.sin(fwd) * size
        ),
        new Phaser.Geom.Point(
          droneX + Math.cos(fwd + 2.3) * size,
          droneY + Math.sin(fwd + 2.3) * size
        ),
        new Phaser.Geom.Point(
          droneX + Math.cos(fwd - 2.3) * size,
          droneY + Math.sin(fwd - 2.3) * size
        ),
      ];
      this.droneGraphics.fillPoints(pts, true);

      // Attack cooldown
      this.droneCooldowns[i] -= delta;
      if (this.droneCooldowns[i] <= 0) {
        this.droneCooldowns[i] = this.DRONE_FIRE_INTERVAL;
        this.droneFire(droneX, droneY);
      }
    }
  }

  private droneFire(droneX: number, droneY: number): void {
    const objects = this.zones.getObjects();
    let nearest: SpaceObject | null = null;
    let nearestDist = this.beamRange;

    for (const obj of objects) {
      const dist = Phaser.Math.Distance.Between(
        droneX,
        droneY,
        obj.sprite.x,
        obj.sprite.y
      );
      if (dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }
    if (!nearest) return;

    // Draw drone beam (brief flash)
    this.droneBeamGraphics.lineStyle(1, COLORS.mass, 0.7);
    this.droneBeamGraphics.lineBetween(
      droneX,
      droneY,
      nearest.sprite.x,
      nearest.sprite.y
    );
    this.scene.time.delayedCall(80, () => this.droneBeamGraphics.clear());

    const destroyed = nearest.takeDamage(this.DRONE_DAMAGE);
    if (destroyed) {
      this.audio?.play("sfx_explosion", 0.4);
      this.createExplosion(
        nearest.sprite.x,
        nearest.sprite.y,
        nearest.config.color
      );
      this.spawnDebris(nearest);
      this.resources.addEnergy(
        (nearest.config.energyYield + ENERGY_FROM_DESTROY_BASE) *
          this.energyAmplifierMultiplier
      );
      this.zones.removeObject(nearest);
    }
  }

  update(delta: number): void {
    if (this.beamCooldown > 0) {
      this.beamCooldown -= delta;
    }

    // Release clamp if target drifted too far
    if (this.clampedTarget) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.clampedTarget.sprite.x,
        this.clampedTarget.sprite.y
      );
      if (dist > this.clampRange * 2) {
        this.releaseClamp();
      }
    }

    // Auto systems
    const turretCount = this.upgrades?.getLevel("autoTurret") ?? 0;
    this.updateAutoTurrets(delta, turretCount);

    const tractorLevel = this.upgrades?.getLevel("tractorBeam") ?? 0;
    this.updateTractorBeam(delta, tractorLevel);

    const gravWellLevel = this.upgrades?.getLevel("gravityWell") ?? 0;
    this.updateGravityWell(delta, gravWellLevel);

    const droneCount = this.upgrades?.getLevel("droneSwarm") ?? 0;
    this.updateDroneSwarm(delta, droneCount);

    // Clean up despawned debris
    this.debrisList = this.debrisList.filter((d) => d.sprite.active);
  }
}
