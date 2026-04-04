import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS, WORLD_CENTER_X, WORLD_CENTER_Y } from "@/constants";
import { createStarfield, updateStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";
import { ResourceManager } from "@/systems/ResourceManager";
import { GravitySystem } from "@/systems/GravitySystem";
import { ZoneManager } from "@/systems/ZoneManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import { CombatSystem } from "@/systems/CombatSystem";
import { HUD } from "@/ui/HUD";
import { UpgradeScreen } from "@/ui/UpgradeScreen";
import { AudioManager } from "@/systems/AudioManager";
import type { SpaceObject } from "@/entities/SpaceObject";
import type { DangerLevel } from "@/systems/GravitySystem";
import { PLANET_DEFS, createPlanet } from "@/entities/PlanetObject";

const UPGRADE_MILESTONE = 30; // trigger upgrade screen every N mass

export class GameScene extends Phaser.Scene {
  player!: PlayerStation;
  resources!: ResourceManager;
  gravity!: GravitySystem;
  zones!: ZoneManager;
  combat!: CombatSystem;
  hud!: HUD;
  upgradeScreen!: UpgradeScreen;
  audio!: AudioManager;

  planets: SpaceObject[] = [];
  currentTier: number = 1;
  private nextMilestone: number = UPGRADE_MILESTONE;
  private isPaused: boolean = false;

  private starfieldLayers!: Phaser.GameObjects.TileSprite[];
  private earthObjects: Phaser.GameObjects.GameObject[] = [];
  private gravityIndicatorGraphics!: Phaser.GameObjects.Graphics;
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private collisionCooldowns: WeakSet<Phaser.Physics.Arcade.Sprite> = new WeakSet();

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.starfieldLayers = createStarfield(this);

    this.resources = new ResourceManager();
    this.gravity = new GravitySystem();
    this.zones = new ZoneManager(this);
    this.player = new PlayerStation(this);

    this.zones.populate(this.player.x, this.player.y, 1);

    // Gravity bodies
    this.gravity.addBody({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 + 600, gravityMass: 500 });
    this.gravity.addBody({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 - 3500, gravityMass: 50000 });

    this.gravity.initGraphics(this);
    this.renderEarth();

    // Place named planets as fixed world objects
    for (const def of PLANET_DEFS) {
      const planet = createPlanet(this, def);
      this.planets.push(planet);
      this.zones.addFixedObject(planet);
      const px = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
      const py = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;
      this.gravity.addBody({ x: px, y: py, gravityMass: def.config.gravityMass });
    }

    this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.audio = new AudioManager(this);
    this.combat.setAudio(this.audio);

    this.hud = new HUD(this, this.resources, this.audio);

    this.upgradeScreen = new UpgradeScreen(
      this, this.combat, this.resources, this.player, this.audio
    );

    this.input.once("pointerdown", () => this.audio.music.play("ambient"));

    // Collisions
    this.physics.add.overlap(
      this.player.body,
      this.zones.objectGroup,
      (_p, objSprite) => {
        const obj = (objSprite as Phaser.Physics.Arcade.Sprite).getData("spaceObject") as SpaceObject;
        if (obj) this.onCollision(obj);
      }
    );
    this.physics.add.overlap(
      this.player.body,
      this.combat.debrisGroup,
      (_p, debrisSprite) => {
        const debris = (debrisSprite as Phaser.Physics.Arcade.Sprite).getData("debris") as import("@/entities/Debris").Debris;
        if (debris) this.combat.collectDebris(debris);
      }
    );

    // ── Two-camera setup ──────────────────────────────────────────
    const { width, height } = this.scale;
    const uiCam = this.cameras.add(0, 0, width, height);
    uiCam.setZoom(1);
    uiCam.transparent = true;

    // uiCam ignores all world objects
    const worldObjects: Phaser.GameObjects.GameObject[] = [
      ...this.starfieldLayers,
      ...this.earthObjects,
      this.player.body,
      this.gravityIndicatorGraphics,
      ...(this.gravity.getGraphics() ? [this.gravity.getGraphics()!] : []),
      ...(this.player.getParticleEmitter() ? [this.player.getParticleEmitter()!] : []),
      ...this.combat.getWorldGraphics(),
    ];
    uiCam.ignore(worldObjects);
    uiCam.ignore(this.zones.objectGroup);
    uiCam.ignore(this.combat.debrisGroup);

    // Future-spawned world sprites auto-ignored by uiCam
    (this.zones.objectGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => uiCam.ignore(item);
    (this.combat.debrisGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => uiCam.ignore(item);

    // main camera ignores HUD; also tell dangerVignette to go to uiCam only
    const hudObjects = [...this.hud.getObjects(), this.dangerVignette];
    this.cameras.main.ignore(hudObjects);

    // UpgradeScreen overlay: tell it to use uiCam (ignore from main)
    this.upgradeScreen.setMainCamera(this.cameras.main);
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // Gravity — delta-based, GRAVITY_CONSTANT already tuned to 250
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    const resist = 1 - this.player.gravityResistance;
    this.player.applyGravity(
      pull.x * (delta / 1000) * resist,
      pull.y * (delta / 1000) * resist
    );

    // Gravity death
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      this.handleDeath();
    }

    // Player movement
    this.player.isLocked = false;
    if (this.player.isBoostHeld()) {
      this.player.isBoosting = this.resources.drainBoost(delta);
    } else {
      this.player.isBoosting = false;
    }
    this.player.update(delta);

    // Burst fire
    if (this.player.consumeAttack()) {
      this.combat.triggerBurst();
    }

    // Combat (auto-fire always on)
    this.combat.update(delta, 0);

    // Zone spawning
    const tier = getTierForMass(this.resources.totalMassEarned);
    this.zones.update(delta, this.player.x, this.player.y, tier, this.resources.totalMassEarned);

    // Energy passive regen
    this.resources.update(delta);

    // Tier evolution
    const newTier = getTierForMass(this.resources.totalMassEarned);
    if (newTier > this.currentTier) {
      this.triggerEvolution(newTier);
    }
    this.currentTier = newTier;
    this.player.tier = newTier;

    // Upgrade milestone
    if (this.resources.totalMassEarned >= this.nextMilestone) {
      this.nextMilestone += UPGRADE_MILESTONE;
      this.triggerUpgrade();
      return;
    }

    // Station growth + zoom
    const baseSize = 16;
    const growthFactor = 1 + Math.log2(1 + this.resources.totalMassEarned) * 0.3;
    this.player.setSize(baseSize * growthFactor);

    const targetZoom = Math.max(1 / growthFactor, 0.2);
    const currentZoom = this.cameras.main.zoom;
    const lerpFactor = 1 - Math.exp(-1.5 * (delta / 1000));
    this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * lerpFactor);

    // HUD + visuals
    this.hud.update();
    updateStarfield(this.starfieldLayers, this.cameras.main);
    this.gravity.renderDangerZones(this.player.x, this.player.y, this.player.thrustPower);
    this.updateGravityIndicator();
    this.updateDangerVignette();
  }

  private triggerUpgrade(): void {
    this.isPaused = true;
    this.physics.world.pause();

    this.upgradeScreen.show(() => {
      this.isPaused = false;
      this.physics.world.resume();
      this.audio.music.onTierChange(this.currentTier);
    });
  }

  private triggerEvolution(newTier: number): void {
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut");

    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `TIER ${newTier}: ${getTierName(newTier).toUpperCase()}`,
        { fontFamily: "monospace", fontSize: "32px", color: "#6c63ff", stroke: "#000", strokeThickness: 4 }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300);

    this.audio.play("sfx_tier_up");
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40, duration: 3000, ease: "Power2",
      onComplete: () => text.destroy(),
    });
    this.audio.music.onTierChange(newTier);
  }

  private handleDeath(): void {
    this.audio.play("sfx_game_over");
    this.cameras.main.flash(500, 255, 100, 100);
    this.resources.energy = this.resources.batteryCapacity;
    this.player.body.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.player.body.setVelocity(0, 0);
  }

  onCollision(obj: SpaceObject): void {
    if (this.collisionCooldowns.has(obj.sprite)) return;
    this.collisionCooldowns.add(obj.sprite);
    this.time.delayedCall(500, () => this.collisionCooldowns.delete(obj.sprite));

    const sizeRatio = obj.config.size / this.player.size;
    if (sizeRatio < 0.3) {
      this.resources.addMass(obj.config.massYield * 0.2);
      this.zones.removeObject(obj);
      return;
    }

    const damage = sizeRatio * 20;
    this.resources.energy = Math.max(0, this.resources.energy - damage);

    const dx = this.player.x - obj.sprite.x;
    const dy = this.player.y - obj.sprite.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    this.player.body.body!.velocity.x += (dx / dist) * 200;
    this.player.body.body!.velocity.y += (dy / dist) * 200;
  }

  private renderEarth(): void {
    const earthX = WORLD_WIDTH / 2;
    const earthY = WORLD_HEIGHT / 2 + 600;
    const radius = 180;
    const g = this.add.graphics().setDepth(-3);
    this.earthObjects.push(g);

    g.fillStyle(0x1a3a5c, 0.3);
    g.fillCircle(earthX, earthY, radius + 30);
    g.fillStyle(0x1a4a8a, 0.9);
    g.fillCircle(earthX, earthY, radius);
    g.fillStyle(0x2d6e2d, 0.85);
    g.fillEllipse(earthX - 40, earthY - 30, 90, 70);
    g.fillEllipse(earthX + 50, earthY + 20, 70, 80);
    g.fillEllipse(earthX - 20, earthY + 50, 60, 40);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(earthX, earthY, radius);
    g.lineStyle(2, 0x4488cc, 0.4);
    g.strokeCircle(earthX, earthY, radius);

    const label = this.add.text(earthX, earthY + radius + 20, "Earth", {
      fontFamily: "monospace", fontSize: "14px", color: "#4488cc",
    }).setOrigin(0.5).setDepth(-3).setAlpha(0.6);
    this.earthObjects.push(label);
  }

  private updateGravityIndicator(): void {
    this.gravityIndicatorGraphics.clear();
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    if (pull.magnitude < 0.1) return;

    const nx = pull.x / pull.magnitude;
    const ny = pull.y / pull.magnitude;

    let color = 0x4488cc;
    let alpha = 0.6;
    let arrowLength = 20;

    for (const body of this.gravity.getBodies()) {
      const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { color = 0xff4444; alpha = 1.0; arrowLength = 28; break; }
      else if (level === "warning") { color = 0xffaa44; alpha = 0.85; arrowLength = 24; }
    }

    const startDist = this.player.size + 4;
    const sx = this.player.x + nx * startDist;
    const sy = this.player.y + ny * startDist;
    const ex = sx + nx * arrowLength;
    const ey = sy + ny * arrowLength;

    this.gravityIndicatorGraphics.lineStyle(2, color, alpha);
    this.gravityIndicatorGraphics.lineBetween(sx, sy, ex, ey);

    const headSize = 5;
    const angle = Math.atan2(ny, nx);
    const spread = Math.PI * 0.7;
    this.gravityIndicatorGraphics.fillStyle(color, alpha);
    this.gravityIndicatorGraphics.fillTriangle(
      ex, ey,
      ex - Math.cos(angle - spread) * headSize, ey - Math.sin(angle - spread) * headSize,
      ex - Math.cos(angle + spread) * headSize, ey - Math.sin(angle + spread) * headSize
    );
  }

  private updateDangerVignette(): void {
    this.dangerVignette.clear();

    let worstLevel: DangerLevel = "safe";
    for (const body of this.gravity.getBodies()) {
      const level = this.gravity.getDangerLevel(body, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { worstLevel = "deadly"; break; }
      if (level === "warning") worstLevel = "warning";
    }
    if (worstLevel === "safe") return;

    const w = this.scale.width;
    const h = this.scale.height;
    const pulse = (Math.sin(this.time.now / (worstLevel === "deadly" ? 150 : 400)) + 1) / 2;
    const baseAlpha = worstLevel === "deadly" ? 0.25 : 0.10;
    const alpha = baseAlpha + pulse * (worstLevel === "deadly" ? 0.15 : 0.06);
    const color = worstLevel === "deadly" ? 0xff2222 : 0xff8800;

    const edgeSize = Math.floor(Math.min(w, h) * 0.12);
    this.dangerVignette.fillStyle(color, alpha);
    this.dangerVignette.fillRect(0, 0, w, edgeSize);
    this.dangerVignette.fillRect(0, h - edgeSize, w, edgeSize);
    this.dangerVignette.fillRect(0, 0, edgeSize, h);
    this.dangerVignette.fillRect(w - edgeSize, 0, edgeSize, h);
  }
}
