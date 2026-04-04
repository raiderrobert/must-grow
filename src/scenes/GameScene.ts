import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS, WORLD_CENTER_X, WORLD_CENTER_Y, PLAYER_START_SIZE, GRAVITY_SCALE, ZOOM_START, ZOOM_MIN, PLAYER_SPAWN_X, PLAYER_SPAWN_Y, ORBIT_SPEED_SCALE } from "@/constants";
import { createStarfield, updateStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";
import { ResourceManager } from "@/systems/ResourceManager";
import { GravitySystem } from "@/systems/GravitySystem";
import { ZoneManager } from "@/systems/ZoneManager";
import { getTierForMass, getTierName } from "@/data/tiers";
import { CombatSystem } from "@/systems/CombatSystem";
import { HUD } from "@/ui/HUD";
import { UpgradeScreen } from "@/ui/UpgradeScreen";
import { Minimap } from "@/ui/Minimap";
import { AudioManager } from "@/systems/AudioManager";
import { InputManager } from "@/systems/InputManager";
import { SpaceObject } from "@/entities/SpaceObject";

import { BODY_DEFS } from "@/data/bodies";
import { createOrbitStates, stepOrbit, type OrbitState } from "@/systems/OrbitSystem";
import { renderBody, type RenderedBody } from "@/entities/BodyRenderer";
import type { GravityBody } from "@/systems/GravitySystem";

interface TrackedBody {
  name: string;
  spaceObj: SpaceObject;
  rendered: RenderedBody;
  gravityBody: GravityBody;
}

export class GameScene extends Phaser.Scene {
  player!: PlayerStation;
  resources!: ResourceManager;
  gravity!: GravitySystem;
  zones!: ZoneManager;
  combat!: CombatSystem;
  hud!: HUD;
  upgradeScreen!: UpgradeScreen;
  minimap!: Minimap;
  audio!: AudioManager;
  inputManager!: InputManager;

  private trackedBodies: TrackedBody[] = [];
  private orbitStates: OrbitState[] = [];
  currentTier: number = 1;
  private upgradeCount: number = 0;
  private nextMilestone: number = 50;
  private readonly MILESTONE_SCALE = 1.6;
  private isPaused: boolean = false;

  private starfieldLayers!: Phaser.GameObjects.TileSprite[];
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
    this.zones = new ZoneManager(this, this.gravity);
    this.player = new PlayerStation(this);

    this.gravity.initGraphics(this);

    // Create all 9 celestial bodies from unified definitions
    for (const def of BODY_DEFS) {
      const x = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
      const y = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;

      const rendered = renderBody(this, x, y, def.visualRadius, def.killRadius, def.name, def.color, def.visual, -3);

      const proxyRadius = Math.min(def.visualRadius, 1500);
      const spaceObj = new SpaceObject(this, {
        x, y, size: proxyRadius,
        health: def.health, massYield: def.massYield, energyYield: def.energyYield,
        gravityMass: def.gravityMass, color: def.color, name: def.name,
      });
      spaceObj.sprite.setVisible(false);
      spaceObj.sprite.setVelocity(0, 0);
      this.zones.addFixedObject(spaceObj);

      const gravityBody: GravityBody = { x, y, gravityMass: def.gravityMass, killRadius: def.killRadius };
      this.gravity.addBody(gravityBody);

      rendered.graphics.setData("origX", x);
      rendered.graphics.setData("origY", y);
      this.trackedBodies.push({ name: def.name, spaceObj, rendered, gravityBody });
    }

    this.orbitStates = createOrbitStates(BODY_DEFS);
    this.zones.populate(this.player.x, this.player.y, 1);

    this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);

    this.inputManager = new InputManager(this);
    this.player.setInputManager(this.inputManager);  // player reads movement from here

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.audio = new AudioManager(this);
    this.combat.setAudio(this.audio);

    this.hud = new HUD(this, this.resources, this.combat, this.inputManager, this.audio);
    this.minimap = new Minimap(this, this.gravity);

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
      ...this.trackedBodies.flatMap(tb => [
        tb.rendered.graphics,
        tb.rendered.label,
        ...(tb.rendered.debugRing ? [tb.rendered.debugRing] : []),
      ]),
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
    const hudObjects = [...this.hud.getObjects(), ...this.minimap.getObjects(), this.dangerVignette];
    this.cameras.main.ignore(hudObjects);

    // UpgradeScreen overlay: tell it to use uiCam (ignore from main)
    this.upgradeScreen.setMainCamera(this.cameras.main);
    this.minimap.setMainCamera(this.cameras.main);

    // Initial spawn position set by PlayerStation constructor via PLAYER_SPAWN_X/Y

    // Starting zoom: keeps player ~6px on screen, Earth arc visible at bottom
    this.cameras.main.setZoom(ZOOM_START);
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // Gravity — delta-based with GRAVITY_SCALE tuning
    const pull = this.gravity.calculateTotalPull(this.player.x, this.player.y);
    const resist = 1 - this.player.gravityResistance;
    this.player.applyGravity(
      pull.x * (delta / 1000) * GRAVITY_SCALE * resist,
      pull.y * (delta / 1000) * GRAVITY_SCALE * resist
    );

    // Update planet orbits (must run before kill zone check)
    this.updateOrbits(delta);

    // Gravity on all zone objects (makes them orbit)
    for (const obj of this.zones.getObjects()) {
      if (!obj.sprite.active || !obj.sprite.body) continue;
      const objPull = this.gravity.calculateTotalPull(obj.sprite.x, obj.sprite.y);
      const objBody = obj.sprite.body as Phaser.Physics.Arcade.Body;
      objBody.velocity.x += objPull.x * (delta / 1000) * GRAVITY_SCALE;
      objBody.velocity.y += objPull.y * (delta / 1000) * GRAVITY_SCALE;
    }

    // Gravity on debris
    for (const sprite of this.combat.debrisGroup.getChildren()) {
      const s = sprite as Phaser.Physics.Arcade.Sprite;
      if (!s.active || !s.body) continue;
      const dPull = this.gravity.calculateTotalPull(s.x, s.y);
      const dBody = s.body as Phaser.Physics.Arcade.Body;
      dBody.velocity.x += dPull.x * (delta / 1000) * GRAVITY_SCALE;
      dBody.velocity.y += dPull.y * (delta / 1000) * GRAVITY_SCALE;
    }

    // Gravity death
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      this.handleDeath();
    }

    // Poll input first so all systems read consistent state this frame
    this.inputManager.update();

    // Player movement
    this.player.isLocked = false;
    this.player.isBoosting = this.inputManager.isBoostHeld
      ? this.resources.drainBoost(delta)
      : false;
    this.player.update(delta);

    // Burst fire
    if (this.inputManager.consumeAttack()) {
      this.combat.triggerBurst();
    }

    // Combat (auto-fire always on)
    this.combat.update(delta, 0);

    // Check if any tracked bodies were destroyed
    for (let i = this.trackedBodies.length - 1; i >= 0; i--) {
      const tb = this.trackedBodies[i];
      if (!tb.spaceObj.sprite.active) {
        this.onBodyDestroyed(tb);
      }
    }

    // Zone spawning
    const tier = getTierForMass(this.resources.totalMassEarned);
    this.zones.update(delta, this.player.x, this.player.y, tier, this.player.size);

    // Energy passive regen
    this.resources.update(delta);

    // Atmosphere energy drain — ramps up quadratically as you approach kill zone
    const approachFactor = this.gravity.getApproachFactor(this.player.x, this.player.y);
    if (approachFactor > 0) {
      const drainPerSec = approachFactor * approachFactor * 40; // 0 at outer edge, 40/sec at surface
      this.resources.energy = Math.max(0, this.resources.energy - drainPerSec * (delta / 1000));
    }

    // Tier evolution
    const newTier = getTierForMass(this.resources.totalMassEarned);
    if (newTier > this.currentTier) {
      this.triggerEvolution(newTier);
    }
    this.currentTier = newTier;
    this.player.tier = newTier;

    // Upgrade milestone
    if (this.resources.totalMassEarned >= this.nextMilestone) {
      this.triggerUpgrade();
      return;
    }

    // Station growth + zoom
    const growthFactor = 1 + Math.log2(1 + this.resources.totalMassEarned) * 0.5;
    this.player.setSize(PLAYER_START_SIZE * growthFactor);

    // Keep player ~6px on screen regardless of size; zoom out as station grows
    const targetZoom = Math.max(ZOOM_START / growthFactor, ZOOM_MIN);
    const currentZoom = this.cameras.main.zoom;
    const lerpFactor = 1 - Math.exp(-1.5 * (delta / 1000));
    this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * lerpFactor);

    // HUD + visuals
    this.hud.update();
    this.minimap.update(this.player.x, this.player.y, delta);
    updateStarfield(this.starfieldLayers, this.cameras.main);
    this.gravity.renderDangerZones(this.player.x, this.player.y, this.player.thrustPower);
    this.updateGravityIndicator();
    this.updateDangerVignette();
  }

  private triggerUpgrade(): void {
    this.isPaused = true;
    this.physics.world.pause();
    this.upgradeCount++;
    this.nextMilestone = Math.floor(
      this.resources.totalMassEarned +
        50 * Math.pow(this.MILESTONE_SCALE, this.upgradeCount)
    );

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
    this.player.body.setPosition(PLAYER_SPAWN_X, PLAYER_SPAWN_Y);
    this.player.body.setVelocity(0, 0);
  }

  private onBodyDestroyed(tracked: TrackedBody): void {
    this.minimap.addGhost(tracked.gravityBody.x, tracked.gravityBody.y, tracked.spaceObj.config.color);
    this.gravity.removeBody(tracked.gravityBody);
    tracked.rendered.graphics.destroy();
    tracked.rendered.label.destroy();
    tracked.rendered.debugRing?.destroy();
    const idx = this.trackedBodies.indexOf(tracked);
    if (idx !== -1) this.trackedBodies.splice(idx, 1);
    const shakeIntensity = Math.min(0.02, 0.005 + tracked.spaceObj.config.size / 100_000);
    this.cameras.main.shake(1000, shakeIntensity);
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

  private updateOrbits(delta: number): void {
    for (const orbit of this.orbitStates) {
      const parent = this.trackedBodies.find(tb => tb.name === orbit.parentName);
      if (!parent) continue;

      const result = stepOrbit(
        orbit.currentAngle, orbit.distance, orbit.orbitSpeed,
        delta, ORBIT_SPEED_SCALE,
        parent.gravityBody.x, parent.gravityBody.y
      );
      orbit.currentAngle = result.angle;

      const tracked = this.trackedBodies.find(tb => tb.name === orbit.bodyName);
      if (!tracked) continue;

      tracked.gravityBody.x = result.x;
      tracked.gravityBody.y = result.y;

      const origX = tracked.rendered.graphics.getData("origX") as number;
      const origY = tracked.rendered.graphics.getData("origY") as number;
      if (origX !== undefined && origY !== undefined) {
        tracked.rendered.graphics.setPosition(result.x - origX, result.y - origY);
        if (tracked.rendered.debugRing) {
          tracked.rendered.debugRing.setPosition(result.x - origX, result.y - origY);
        }
      }

      const bodyDef = BODY_DEFS.find(d => d.name === orbit.bodyName);
      const labelRadius = bodyDef?.visualRadius ?? tracked.spaceObj.config.size;
      const labelFontSize = Math.max(24, Math.min(labelRadius * 0.12, 400));
      tracked.rendered.label.setPosition(result.x, result.y + labelRadius + labelFontSize * 1.5);

      tracked.spaceObj.sprite.setPosition(result.x, result.y);
    }
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

    const approachFactor = this.gravity.getApproachFactor(this.player.x, this.player.y);
    if (approachFactor <= 0) return;

    // Pulse rate speeds up as you get closer: 1200ms at outer edge → 80ms at surface
    const pulseMs = 1200 - approachFactor * 1120;
    const pulse = (Math.sin(this.time.now / pulseMs) + 1) / 2;

    // Color shifts from yellow → orange → red as factor increases
    const color = approachFactor < 0.5 ? 0xffaa00 : 0xff2200;

    // Intensity also ramps up
    const baseAlpha = 0.05 + approachFactor * 0.25;
    const alpha = baseAlpha + pulse * (0.04 + approachFactor * 0.14);

    const w = this.scale.width;
    const h = this.scale.height;
    const edgeSize = Math.floor(Math.min(w, h) * (0.08 + approachFactor * 0.1));
    this.dangerVignette.fillStyle(color, alpha);
    this.dangerVignette.fillRect(0, 0, w, edgeSize);
    this.dangerVignette.fillRect(0, h - edgeSize, w, edgeSize);
    this.dangerVignette.fillRect(0, 0, edgeSize, h);
    this.dangerVignette.fillRect(w - edgeSize, 0, edgeSize, h);
  }
}
