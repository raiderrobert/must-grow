import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "@/constants";
import { createStarfield, updateStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";
import { ResourceManager } from "@/systems/ResourceManager";
import { UpgradeManager } from "@/systems/UpgradeManager";
import { GravitySystem } from "@/systems/GravitySystem";
import { ZoneManager } from "@/systems/ZoneManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import { CombatSystem } from "@/systems/CombatSystem";
import { HUD } from "@/ui/HUD";
import { UpgradeShop } from "@/ui/UpgradeShop";
import { AudioManager } from "@/systems/AudioManager";
import type { SpaceObject } from "@/entities/SpaceObject";

export class GameScene extends Phaser.Scene {
  player!: PlayerStation;
  resources!: ResourceManager;
  upgrades!: UpgradeManager;
  gravity!: GravitySystem;
  zones!: ZoneManager;
  combat!: CombatSystem;
  hud!: HUD;
  shop!: UpgradeShop;
  audio!: AudioManager;
  currentTier: number = 1;
  private starfieldLayers!: Phaser.GameObjects.TileSprite[];
  private gravityIndicatorGraphics!: Phaser.GameObjects.Graphics;
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private earthObjects: Phaser.GameObjects.GameObject[] = [];
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
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
    this.upgrades = new UpgradeManager(this.resources);
    this.gravity = new GravitySystem();
    this.zones = new ZoneManager(this);
    this.player = new PlayerStation(this);
    this.zones.populate(this.player.x, this.player.y, 1);

    // Earth gravity body — below starting position
    this.gravity.addBody({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2 + 600,
      gravityMass: 500,
    });

    // The Sun — far from start at the top of the solar system
    this.gravity.addBody({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2 - 3500,
      gravityMass: 50000,
    });

    this.gravity.initGraphics(this);
    this.renderEarth();

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.combat.setUpgrades(this.upgrades);

    this.audio = new AudioManager(this);
    this.hud = new HUD(this, this.resources, this.audio);
    this.shop = new UpgradeShop(this, this.upgrades, this.resources);
    this.shop.setDependencies(this.player, this.combat, this.audio);

    this.combat.setAudio(this.audio);

    // Start ambient music (resumes after first user gesture)
    this.input.once("pointerdown", () => {
      this.audio.music.play("ambient");
    });

    // Apply initial stats (level 0 defaults)
    this.upgrades.applyEffects(this.player, this.combat, this.resources);

    // Collision: player vs space objects
    this.physics.add.overlap(
      this.player.body,
      this.zones.objectGroup,
      (_playerSprite, objSprite) => {
        const obj = (objSprite as Phaser.Physics.Arcade.Sprite).getData(
          "spaceObject"
        ) as import("@/entities/SpaceObject").SpaceObject;
        if (obj) this.onCollision(obj);
      }
    );

    // Overlap: player auto-collects debris on touch
    this.physics.add.overlap(
      this.player.body,
      this.combat.debrisGroup,
      (_playerSprite, debrisSprite) => {
        const debris = (debrisSprite as Phaser.Physics.Arcade.Sprite).getData(
          "debris"
        ) as import("@/entities/Debris").Debris;
        if (debris) this.combat.collectDebris(debris);
      }
    );

    this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);

    // ---- Two-camera setup ----
    // UI camera: fixed zoom=1, renders only HUD elements
    const { width, height } = this.scale;
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.uiCam.setZoom(1);
    this.uiCam.transparent = true; // don't clear background

    // World objects: UI camera must ignore all of these
    const worldObjects: Phaser.GameObjects.GameObject[] = [
      ...this.starfieldLayers,
      ...this.earthObjects,
      this.player.body,
      this.gravityIndicatorGraphics,
      ...(this.gravity.getGraphics() ? [this.gravity.getGraphics()!] : []),
      ...(this.player.getParticleEmitter() ? [this.player.getParticleEmitter()!] : []),
      ...this.combat.getWorldGraphics(),
    ];
    this.uiCam.ignore(worldObjects);
    this.uiCam.ignore(this.zones.objectGroup);
    this.uiCam.ignore(this.combat.debrisGroup);

    // Auto-ignore future spawned world sprites (addCallback exists at runtime, not in TS types)
    (this.zones.objectGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => this.uiCam.ignore(item);
    (this.combat.debrisGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => this.uiCam.ignore(item);

    // HUD objects: main camera must ignore all of these
    const hudObjects: Phaser.GameObjects.GameObject[] = [
      ...this.hud.getObjects(),
      ...this.shop.getObjects(),
      this.dangerVignette,
    ];
    this.cameras.main.ignore(hudObjects);

    // Shop needs main camera reference to re-apply ignore after rebuild()
    this.shop.setMainCamera(this.cameras.main);
  }

  update(_time: number, delta: number): void {
    // 1. Gravity pull
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    this.player.applyGravity(pull.x, pull.y);

    // 2. Gravity death check
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      this.handleDeath();
    }

    // 3. Player movement (lock while clamped)
    this.player.isLocked = this.combat.clampedTarget !== null;
    this.player.update(delta);

    // Attack button — clamp/chew (Tier 1) or fire beam (Tier 2+)
    if (this.player.consumeAttack()) {
      this.combat.attackPressed();
    }
    // Power button — manual energy generation
    if (this.player.consumePower()) {
      this.resources.manualGenerate();
      this.audio.play("sfx_power_up");
    }
    // Upgrade menu toggle
    if (this.player.consumeUpgradeToggle()) {
      this.shop.toggle();
    }

    // Combat (manual + auto)
    this.combat.update(delta);

    // Zone spawning
    const tier = getTierForMass(this.resources.totalMassEarned);
    this.zones.update(
      delta,
      this.player.x,
      this.player.y,
      tier,
      this.resources.totalMassEarned
    );

    // Energy tick
    this.resources.updateEnergy(delta);

    // 5. Tier check
    const newTier = getTierForMass(this.resources.totalMassEarned);
    if (newTier > this.currentTier) {
      this.triggerEvolution(newTier);
      this.audio.music.onTierChange(newTier);
    }
    this.currentTier = newTier;
    this.player.tier = newTier;

    // 6. Continuous growth
    const baseSize = 16;
    const growthFactor =
      1 + Math.log2(1 + this.resources.totalMassEarned) * 0.3;
    this.player.setSize(baseSize * growthFactor);

    // Continuous camera zoom tracks station growth (delta-based, frame-rate independent)
    const targetZoom = Math.max(1 / growthFactor, 0.2);
    const currentZoom = this.cameras.main.zoom;
    const lerpFactor = 1 - Math.exp(-1.5 * (delta / 1000));
    this.cameras.main.setZoom(
      currentZoom + (targetZoom - currentZoom) * lerpFactor
    );

    // 7. HUD
    this.hud.update();

    // 8. Starfield parallax
    updateStarfield(this.starfieldLayers, this.cameras.main);

    // 9. Danger zones + indicators
    this.gravity.renderDangerZones(
      this.player.x,
      this.player.y,
      this.player.thrustPower
    );
    this.updateGravityIndicator();
    this.updateDangerVignette();
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
      const level = this.gravity.getDangerLevel(
        body, this.player.x, this.player.y, this.player.thrustPower
      );
      if (level === "deadly") {
        color = 0xff4444; alpha = 1.0; arrowLength = 28; break;
      } else if (level === "warning") {
        color = 0xffaa44; alpha = 0.85; arrowLength = 24;
      }
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

    let worstLevel: import("@/systems/GravitySystem").DangerLevel = "safe";
    for (const body of this.gravity.getBodies()) {
      const level = this.gravity.getDangerLevel(
        body, this.player.x, this.player.y, this.player.thrustPower
      );
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
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#4488cc",
    }).setOrigin(0.5).setDepth(-3).setAlpha(0.6);
    this.earthObjects.push(label);
  }

  private triggerEvolution(newTier: number): void {
    // Dramatic zoom-out pulse, then continuous zoom resumes
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.zoomTo(currentZoom * 0.7, 1000, "Cubic.easeInOut");

    const tierName = getTierName(newTier);
    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `TIER ${newTier}: ${tierName.toUpperCase()}`,
        {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#6c63ff",
          stroke: "#000",
          strokeThickness: 4,
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300);

    this.audio.play("sfx_tier_up");
    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 40,
      duration: 3000,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  private handleDeath(): void {
    this.audio.play("sfx_game_over");
    this.cameras.main.flash(500, 255, 100, 100);
    this.resources.energy = this.resources.batteryCapacity;
    this.player.body.setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.player.body.setVelocity(0, 0);
  }

  // Exposed for collision handler (wired later)
  onCollision(obj: SpaceObject): void {
    if (this.collisionCooldowns.has(obj.sprite)) return;
    this.collisionCooldowns.add(obj.sprite);
    this.time.delayedCall(500, () => {
      this.collisionCooldowns.delete(obj.sprite);
    });

    const sizeRatio = obj.config.size / this.player.size;

    if (sizeRatio < 0.3) {
      this.resources.addMass(obj.config.massYield * 0.2);
      this.zones.removeObject(obj);
      return;
    }

    const damage = sizeRatio * 20;
    this.resources.drainEnergy(damage);

    const dx = this.player.x - obj.sprite.x;
    const dy = this.player.y - obj.sprite.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    this.player.body.body!.velocity.x += (dx / dist) * 200;
    this.player.body.body!.velocity.y += (dy / dist) * 200;

    if (this.resources.isPowerDead && sizeRatio > 0.8) {
      this.handleDeath();
    }
  }
}
