import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "@/constants";
import { createStarfield } from "@/entities/Starfield";
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
  private collisionCooldowns: WeakSet<Phaser.Physics.Arcade.Sprite> = new WeakSet();

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    createStarfield(this);

    this.resources = new ResourceManager();
    this.upgrades = new UpgradeManager(this.resources);
    this.gravity = new GravitySystem();
    this.zones = new ZoneManager(this);
    this.player = new PlayerStation(this);

    // Earth gravity body — below starting position
    this.gravity.addBody({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2 + 600,
      gravityMass: 500,
    });

    this.gravity.initGraphics(this);

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.combat.setUpgrades(this.upgrades);

    this.audio = new AudioManager(this);
    this.hud = new HUD(this, this.resources, this.audio);
    this.shop = new UpgradeShop(this, this.upgrades, this.resources);

    this.combat.setAudio(this.audio);

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

    // 3. Combat (manual + auto)
    this.combat.update(delta);

    // 4. Upgrade effects
    this.upgrades.applyEffects(this.player, this.combat, this.resources);

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
    }
    this.currentTier = newTier;
    this.player.tier = newTier;

    // 6. Continuous growth
    const baseSize = 16;
    const growthFactor =
      1 + Math.log2(1 + this.resources.totalMassEarned) * 0.3;
    this.player.setSize(baseSize * growthFactor);

    // 7. HUD
    this.hud.update();

    // 8. Danger zones
    this.gravity.renderDangerZones(
      this.player.x,
      this.player.y,
      this.player.thrustPower
    );
  }

  private triggerEvolution(newTier: number): void {
    const targetZoom = Math.max(1 - (newTier - 1) * 0.15, 0.3);
    this.cameras.main.zoomTo(targetZoom, 2000, "Cubic.easeInOut");

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
