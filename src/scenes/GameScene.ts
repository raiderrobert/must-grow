import Phaser from "phaser";
import { COLORS, WORLD_CENTER_X, WORLD_CENTER_Y, PLAYER_START_SIZE, PLAYER_THRUST_POWER, GRAVITY_SCALE, GRAVITY_CONSTANT, ZOOM_START, ZOOM_MIN, ORBIT_SPEED_SCALE, DEBRIS_ORBIT_SPEED_MULT } from "@/constants";
import { createStarfield, updateStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";
import { ResourceManager } from "@/systems/ResourceManager";
import { GravitySystem } from "@/systems/GravitySystem";
import { ZoneManager } from "@/systems/ZoneManager";
import { getTierForMass, getTierName, TIERS } from "@/data/tiers";
import { CombatSystem } from "@/systems/CombatSystem";
import { HUD } from "@/ui/HUD";
import { UpgradeScreen } from "@/ui/UpgradeScreen";
import { Minimap } from "@/ui/Minimap";
import { TrajectoryPredictor } from "@/ui/TrajectoryPredictor";
import { AudioManager } from "@/systems/AudioManager";
import { InputManager } from "@/systems/InputManager";
import { SettingsMenu, type CheatCallbacks } from "@/ui/SettingsMenu";
import { SpaceObject } from "@/entities/SpaceObject";
import { EarthDefense } from "@/systems/EarthDefense";

import { BODY_DEFS } from "@/data/bodies";
import { createOrbitStates, stepOrbit, type OrbitState } from "@/systems/OrbitSystem";
import { renderBody, type RenderedBody } from "@/entities/BodyRenderer";
import type { GravityBody } from "@/systems/GravitySystem";

/** Per-act monologue — single line per act, sourced from TIERS data. */
function getActMonologue(tier: number): string | undefined {
  return TIERS[tier - 1]?.monologue;
}

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
  private trajectoryPredictor!: TrajectoryPredictor;
  private earthDefense!: EarthDefense;
  audio!: AudioManager;
  inputManager!: InputManager;

  private trackedBodies: TrackedBody[] = [];
  private orbitStates: OrbitState[] = [];
  currentTier: number = 1;
  private upgradeCount: number = 0;
  private nextMilestone: number = 50;
  private readonly MILESTONE_SCALE = 1.6;
  private isPaused: boolean = false;
  private elapsedTime: number = 0; // ms since game start
  settingsMenu!: SettingsMenu;
  private godMode: boolean = false;
  private infiniteEnergy: boolean = false;
  private gameSpeedMult: number = 1;

  private starfieldLayers!: Phaser.GameObjects.TileSprite[];
  private gravityIndicatorGraphics!: Phaser.GameObjects.Graphics;
  private dangerVignette!: Phaser.GameObjects.Graphics;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private collisionCooldowns: WeakSet<Phaser.Physics.Arcade.Sprite> = new WeakSet();

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

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

      const gravityBody: GravityBody = { x, y, gravityMass: def.gravityMass, killRadius: def.killRadius, name: def.name };
      this.gravity.addBody(gravityBody);

      rendered.graphics.setData("origX", x);
      rendered.graphics.setData("origY", y);
      this.trackedBodies.push({ name: def.name, spaceObj, rendered, gravityBody });
    }

    this.orbitStates = createOrbitStates(BODY_DEFS);

    // Run one orbit step with delta=0 so all bodies snap to their
    // parent-relative positions before we try to spawn near Earth
    this.updateOrbits(0);

    // Now Earth is in its correct position — spawn player near it
    this.spawnNearEarth();

    // Debris belts orbiting each planet
    this.spawnDebrisBelt("Earth",  100, 500,   5_000);
    this.spawnDebrisBelt("Mercury", 10, 200,   2_000);
    this.spawnDebrisBelt("Venus",   15, 400,   3_000);
    this.spawnDebrisBelt("Mars",    12, 300,   2_500);
    this.spawnDebrisBelt("Jupiter", 25, 2_000, 15_000);
    this.spawnDebrisBelt("Saturn",  20, 2_000, 12_000);
    this.spawnDebrisBelt("Uranus",  10, 1_000, 6_000);
    this.spawnDebrisBelt("Neptune", 10, 1_000, 5_000);

    // Dense asteroid belt between Mars and Jupiter
    this.spawnAsteroidRing(150, 125_000, 145_000);

    this.zones.populate(this.player.x, this.player.y, 1);

    this.gravityIndicatorGraphics = this.add.graphics().setDepth(10);
    this.dangerVignette = this.add.graphics().setScrollFactor(0).setDepth(90);

    this.inputManager = new InputManager(this);
    this.player.setInputManager(this.inputManager);  // player reads movement from here

    this.combat = new CombatSystem(this, this.player, this.resources, this.zones);
    this.audio = new AudioManager(this);
    this.combat.setAudio(this.audio);

    this.earthDefense = new EarthDefense(this, this.zones, this.resources);
    this.hud = new HUD(this, this.resources, this.combat, this.inputManager);
    this.minimap = new Minimap(this, this.gravity);
    this.minimap.setVisible(false); // unlocked at Act II
    this.trajectoryPredictor = new TrajectoryPredictor(this, this.gravity);

    this.upgradeScreen = new UpgradeScreen(
      this, this.combat, this.resources, this.player, this.audio, this.inputManager
    );

    // Music starts when the player dismisses the start screen

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
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.uiCam.setZoom(1);
    this.uiCam.transparent = true;

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
      this.trajectoryPredictor.getGraphics(),
      ...(this.gravity.getGraphics() ? [this.gravity.getGraphics()!] : []),
      ...(this.player.getParticleEmitter() ? [this.player.getParticleEmitter()!] : []),
      ...this.combat.getWorldGraphics(),
      this.earthDefense.getGraphics(),
    ];
    this.uiCam.ignore(worldObjects);
    this.uiCam.ignore(this.zones.objectGroup);
    this.uiCam.ignore(this.combat.debrisGroup);

    // Future-spawned world sprites auto-ignored by uiCam
    (this.zones.objectGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => this.uiCam.ignore(item);
    (this.combat.debrisGroup as unknown as { addCallback: (item: Phaser.GameObjects.GameObject) => void }).addCallback =
      (item) => this.uiCam.ignore(item);

    // main camera ignores HUD; also tell dangerVignette to go to uiCam only
    const hudObjects = [...this.hud.getObjects(), ...this.minimap.getObjects(), this.dangerVignette];
    this.cameras.main.ignore(hudObjects);

    // UpgradeScreen overlay: tell it to use uiCam (ignore from main)
    this.upgradeScreen.setMainCamera(this.cameras.main);
    this.minimap.setMainCamera(this.cameras.main);

    // Reposition UI elements when window resizes
    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      const w = gameSize.width;
      const h = gameSize.height;
      this.uiCam.setSize(w, h);
      this.hud.reposition(w, h);
      this.minimap.reposition(w, h);
    });

    this.settingsMenu = new SettingsMenu(this, {
      setTier: (tier: number) => {
        // Give enough mass so the natural tier check doesn't override
        const thresholds = [0, 0, 100, 500, 2000, 10000];
        const requiredMass = thresholds[tier] ?? 10000;
        if (this.resources.totalMassEarned < requiredMass) {
          this.resources.totalMassEarned = requiredMass;
          this.resources.mass = requiredMass;
        }
        this.currentTier = tier;
        this.player.tier = tier;
        this.triggerEvolution(tier);
      },
      toggleGodMode: () => {
        this.godMode = !this.godMode;
        return this.godMode;
      },
      toggleInfiniteEnergy: () => {
        this.infiniteEnergy = !this.infiniteEnergy;
        return this.infiniteEnergy;
      },
      teleportToPlanet: (name: string) => {
        const body = this.trackedBodies.find(tb => tb.name === name);
        if (!body) return;
        const killR = body.gravityBody.killRadius ?? 0;
        this.player.body.setPosition(body.gravityBody.x, body.gravityBody.y - killR - 2000);
        const vel = this.getBodyVelocity(name);
        this.player.body.setVelocity(vel.vx, vel.vy);
      },
      killAllDebris: () => {
        for (const obj of [...this.zones.getObjects()]) {
          this.zones.removeObject(obj);
        }
      },
      setSpeedMultiplier: (mult: number) => {
        this.gameSpeedMult = mult;
      },
      spawnDebrisHere: () => {
        for (let i = 0; i < 100; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 200 + Math.random() * 2000;
          const x = this.player.x + Math.cos(angle) * dist;
          const y = this.player.y + Math.sin(angle) * dist;
          const size = 20 + Math.random() * 50;
          const colors = [0x888888, 0x666666, 0x8b7355, 0xa0926b];
          const obj = new SpaceObject(this, {
            x, y, size,
            health: 10 + size,
            massYield: Math.floor(size * 0.3),
            energyYield: Math.floor(size * 0.1),
            gravityMass: 0,
            color: colors[Math.floor(Math.random() * colors.length)],
            velocityX: this.player.body.body!.velocity.x,
            velocityY: this.player.body.body!.velocity.y,
          });
          this.zones.addFixedObject(obj);
        }
      },
      destroyPlanet: (name: string) => {
        const tracked = this.trackedBodies.find(tb => tb.name === name);
        if (!tracked) return;
        this.combat.createExplosionAt(tracked.spaceObj.sprite.x, tracked.spaceObj.sprite.y, tracked.spaceObj.config.color);
        this.resources.addMass(tracked.spaceObj.config.massYield);
        this.zones.removeObject(tracked.spaceObj);
        this.onBodyDestroyed(tracked);
      },
      getPlanetNames: () => {
        return this.trackedBodies.map(tb => tb.name);
      },
    } satisfies CheatCallbacks, this.audio);
    this.settingsMenu.setMainCamera(this.cameras.main);
    this.settingsMenu.setInputManager(this.inputManager);
    this.settingsMenu.setOnHide(() => {
      this.isPaused = false;
      this.physics.world.resume();
    });

    // (player position set dynamically in spawnNearEarth below)

    // Starting zoom: keeps player ~6px on screen, Earth arc visible at bottom
    this.cameras.main.setZoom(ZOOM_START);

    this.showStartScreen();
  }

  update(_time: number, delta: number): void {
    // Input polling and menu toggle must run even when paused
    this.inputManager.update();

    if (this.inputManager.consumeMenuToggle()) {
      this.settingsMenu.toggle();
      if (this.settingsMenu.visible) {
        this.isPaused = true;
        this.physics.world.pause();
      } else {
        this.isPaused = false;
        this.physics.world.resume();
      }
      return;
    }

    if (this.isPaused) return;

    this.elapsedTime += delta;
    delta *= this.gameSpeedMult;

    // Gravity — delta-based with GRAVITY_SCALE tuning
    const pull = this.gravity.calculateDominantPull(this.player.x, this.player.y);
    const resist = 1 - this.player.gravityResistance;
    this.player.applyGravity(
      pull.x * (delta / 1000) * GRAVITY_SCALE * resist,
      pull.y * (delta / 1000) * GRAVITY_SCALE * resist
    );

    // Update planet orbits (must run before kill zone check)
    this.updateOrbits(delta);

    // Update zone object positions — prescribed orbits or gravity
    for (const obj of this.zones.getObjects()) {
      if (!obj.sprite.active || !obj.sprite.body) continue;

      if (obj.orbitParentName) {
        // ── Prescribed orbit mode ──
        const parent = this.trackedBodies.find(tb => tb.name === obj.orbitParentName);
        if (!parent) {
          // Parent destroyed — clear orbit state, object reverts to physics
          obj.orbitParentName = null;
          continue;
        }

        // Advance angle
        obj.orbitAngle += obj.orbitAngularSpeed * (delta / 1000);
        if (obj.orbitAngle > Math.PI * 2) obj.orbitAngle -= Math.PI * 2;

        // Set position directly from parent + angle + radius
        const newX = parent.gravityBody.x + Math.cos(obj.orbitAngle) * obj.orbitRadius;
        const newY = parent.gravityBody.y + Math.sin(obj.orbitAngle) * obj.orbitRadius;
        obj.sprite.setPosition(newX, newY);

        // Zero out physics velocity so it doesn't fight the position
        (obj.sprite.body as Phaser.Physics.Arcade.Body).velocity.x = 0;
        (obj.sprite.body as Phaser.Physics.Arcade.Body).velocity.y = 0;
      } else {
        // ── Physics mode — gravity only (no prescribed orbit) ──
        const objPull = this.gravity.calculateDominantPull(obj.sprite.x, obj.sprite.y);
        const objBody = obj.sprite.body as Phaser.Physics.Arcade.Body;
        objBody.velocity.x += objPull.x * (delta / 1000) * GRAVITY_SCALE;
        objBody.velocity.y += objPull.y * (delta / 1000) * GRAVITY_SCALE;
      }

      // Keep damage overlay pinned to the moving sprite
      obj.syncOverlay();
    }

    // Gravity on debris
    for (const sprite of this.combat.debrisGroup.getChildren()) {
      const s = sprite as Phaser.Physics.Arcade.Sprite;
      if (!s.active || !s.body) continue;
      const dPull = this.gravity.calculateDominantPull(s.x, s.y);
      const dBody = s.body as Phaser.Physics.Arcade.Body;
      dBody.velocity.x += dPull.x * (delta / 1000) * GRAVITY_SCALE;
      dBody.velocity.y += dPull.y * (delta / 1000) * GRAVITY_SCALE;
    }

    // Gravity death
    if (this.gravity.isInLethalZone(this.player.x, this.player.y, this.player.thrustPower)) {
      if (!this.godMode) {
        this.handleDeath();
      }
    }

    // Player movement
    this.player.isLocked = false;
    this.player.isBoosting = this.inputManager.isBoostHeld
      ? this.resources.drainBoost(delta)
      : false;
    this.player.update(delta);

    // Camera look-ahead: offset toward velocity direction
    const pb = this.player.body.body as Phaser.Physics.Arcade.Body;
    const velMag = Math.sqrt(pb.velocity.x ** 2 + pb.velocity.y ** 2);
    if (velMag > 10) {
      const lookAheadMax = 200;
      const lookAheadFactor = Math.min(1, velMag / 1000);
      const offsetX = (pb.velocity.x / velMag) * lookAheadMax * lookAheadFactor;
      const offsetY = (pb.velocity.y / velMag) * lookAheadMax * lookAheadFactor;
      this.cameras.main.setFollowOffset(-offsetX, -offsetY);
    } else {
      this.cameras.main.setFollowOffset(0, 0);
    }

    // Burst fire
    if (this.inputManager.consumeAttack()) {
      this.combat.triggerBurst();
    }

    // Combat (auto-fire always on)
    this.combat.update(delta, 0);

    // Earth defense satellites
    const earthBody = this.trackedBodies.find(tb => tb.name === "Earth");
    if (earthBody) {
      this.earthDefense.setEarthPosition(earthBody.gravityBody.x, earthBody.gravityBody.y);
    }
    this.earthDefense.update(delta, this.player.x, this.player.y);

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

    // Cheat: infinite energy
    if (this.infiniteEnergy) {
      this.resources.energy = this.resources.batteryCapacity;
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
    // Size grows dramatically with tier — visible jumps at each evolution
    const tierSizeMultipliers = [1, 5, 20, 80, 300]; // T1 through T5
    const tierIdx = Math.min(this.currentTier - 1, tierSizeMultipliers.length - 1);
    const baseMult = tierSizeMultipliers[tierIdx];

    // Smooth growth within current tier (up to 50% larger before next tier)
    const currentThreshold = this.currentTier <= 1 ? 0 :
      [0, 0, 100, 500, 2000, 10000][this.currentTier] ?? 0;
    const nextThreshold = [0, 100, 500, 2000, 10000, 50000][this.currentTier] ?? 50000;
    const tierProgress = Math.min(1,
      (this.resources.totalMassEarned - currentThreshold) / (nextThreshold - currentThreshold)
    );
    const withinTierGrowth = 1 + tierProgress * 0.5; // up to 1.5x within a tier

    const growthFactor = baseMult * withinTierGrowth;
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
    const playerBody = this.player.body.body as Phaser.Physics.Arcade.Body;
    this.trajectoryPredictor.update(
      this.player.x, this.player.y,
      playerBody.velocity.x, playerBody.velocity.y
    );
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
    }, this.currentTier);
  }

  private triggerEvolution(newTier: number): void {
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.zoomTo(currentZoom * 0.8, 1000, "Cubic.easeInOut");

    // Roman numeral for the act banner
    const romanNumerals = ["I", "II", "III", "IV", "V"];
    const roman = romanNumerals[newTier - 1] ?? String(newTier);
    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 50,
        `ACT ${roman}: ${getTierName(newTier).toUpperCase()}`,
        { fontFamily: "monospace", fontSize: "32px", color: "#6c63ff", stroke: "#000", strokeThickness: 4 }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(300);

    // Per-act monologue
    const msg = getActMonologue(newTier);
    if (msg) {
      const monologue = this.add
        .text(this.scale.width / 2, this.scale.height / 2 + 30, `"${msg}"`, {
          fontFamily: "monospace",
          fontSize: "18px",
          color: "#ff6b6b",
          fontStyle: "italic",
          stroke: "#000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(301);

      this.tweens.add({
        targets: monologue,
        alpha: 0,
        y: monologue.y - 20,
        duration: 4000,
        delay: 1000,
        ease: "Power2",
        onComplete: () => monologue.destroy(),
      });
    }

    this.audio.play("sfx_tier_up");
    this.tweens.add({
      targets: text, alpha: 0, y: text.y - 40, duration: 3000, ease: "Power2",
      onComplete: () => text.destroy(),
    });
    this.audio.music.onTierChange(newTier);

    // ── Tier power spike ──────────────────────────────────────────
    // Each tier is 10x more powerful than the last
    const tierMultiplier = Math.pow(3, newTier - 1); // T1=1, T2=3, T3=9, T4=27, T5=81

    const rangeMultiplier = Math.pow(4, newTier - 1); // T1=1, T2=4, T3=16, T4=64, T5=256
    this.combat.beamRange = 300 * rangeMultiplier;
    this.combat.beamDamage = 10 * tierMultiplier;
    this.combat.autoFireCooldown = Math.max(100, 900 / (1 + (newTier - 1) * 0.5)); // gets faster but capped

    // Burst also scales
    this.combat.burstShotCount = 3 + (newTier - 1) * 2;

    // Debris pickup range scales with size
    this.combat.debrisPickupRange = 80 * (1 + (newTier - 1) * 2);

    // Energy scales with tier — sustain longer fights at higher tiers
    const energyMultiplier = Math.pow(3, newTier - 1); // same curve as weapons
    this.resources.batteryCapacity = 100 * energyMultiplier;
    this.resources.energy = this.resources.batteryCapacity; // full refill on tier up
    this.resources.passiveRechargeRate = 8 * energyMultiplier;

    // Thrust scales with tier so the player stays maneuverable
    const thrustMultipliers = [1, 2, 5, 15, 40]; // T1 through T5
    const thrustIdx = Math.min(newTier - 1, thrustMultipliers.length - 1);
    this.player.speed = PLAYER_THRUST_POWER * thrustMultipliers[thrustIdx];

    // Camera shake for dramatic effect
    this.cameras.main.shake(500, 0.01 * newTier);

    if (newTier >= 2) {
      this.minimap.setVisible(true);
    }
    if (newTier >= 3) {
      const earth = this.trackedBodies.find(tb => tb.name === "Earth");
      if (earth) {
        this.earthDefense.activate(
          earth.gravityBody.x, earth.gravityBody.y,
          earth.gravityBody.killRadius ?? 0, earth.gravityBody.gravityMass
        );
      }
    }
    if (newTier >= 4) {
      this.hud.showKillTracker();
    }
  }

  private getBodyVelocity(bodyName: string): { vx: number; vy: number } {
    const orbitState = this.orbitStates.find(os => os.bodyName === bodyName);
    if (!orbitState) return { vx: 0, vy: 0 };
    const linearSpeed = orbitState.orbitSpeed * orbitState.distance * ORBIT_SPEED_SCALE;
    const perpAngle = orbitState.currentAngle + Math.PI / 2;
    return { vx: Math.cos(perpAngle) * linearSpeed, vy: Math.sin(perpAngle) * linearSpeed };
  }

  private spawnDebrisBelt(
    bodyName: string,
    count: number,
    minAltitude: number,
    maxAltitude: number
  ): void {
    const tracked = this.trackedBodies.find(tb => tb.name === bodyName);
    if (!tracked) return;

    const bx = tracked.gravityBody.x;
    const by = tracked.gravityBody.y;
    const killR = tracked.gravityBody.killRadius ?? 0;
    const bodyMass = tracked.gravityBody.gravityMass;
    const { vx: bodyVx, vy: bodyVy } = this.getBodyVelocity(bodyName);

    const junkColors = [0x888888, 0x666666, 0x999999, 0xaaaaaa];
    const asteroidColors = [0x8b7355, 0xa0926b, 0x7a6b50];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const altitude = minAltitude + Math.random() * (maxAltitude - minAltitude);
      const dist = killR + altitude;
      const x = bx + Math.cos(angle) * dist;
      const y = by + Math.sin(angle) * dist;

      const orbitalSpeed = Math.sqrt(
        GRAVITY_CONSTANT * bodyMass * GRAVITY_SCALE / dist
      ) * DEBRIS_ORBIT_SPEED_MULT;
      const tangentAngle = angle + Math.PI / 2;
      const perturb = 0.85 + Math.random() * 0.3;
      const localVx = Math.cos(tangentAngle) * orbitalSpeed * perturb;
      const localVy = Math.sin(tangentAngle) * orbitalSpeed * perturb;

      const isSatellite = Math.random() < 0.3;
      const size = isSatellite ? 15 + Math.random() * 25 : 20 + Math.random() * 50;
      const color = isSatellite
        ? 0xaaaacc
        : (Math.random() < 0.5
          ? junkColors[Math.floor(Math.random() * junkColors.length)]
          : asteroidColors[Math.floor(Math.random() * asteroidColors.length)]);

      const obj = new SpaceObject(this, {
        x, y, size,
        health: 10 + size,
        massYield: Math.floor(size * 0.3),
        energyYield: Math.floor(size * 0.1),
        gravityMass: 0,
        color,
        name: isSatellite ? "Satellite" : undefined,
        velocityX: 0,
        velocityY: 0,
      });
      this.zones.addFixedObject(obj);
      // Prescribe orbit around this planet
      obj.orbitParentName = bodyName;
      obj.orbitAngle = angle;
      obj.orbitRadius = dist;
      const baseAngularSpeed = Math.sqrt(
        GRAVITY_CONSTANT * bodyMass * GRAVITY_SCALE / dist
      ) / dist;
      obj.orbitAngularSpeed = -baseAngularSpeed * DEBRIS_ORBIT_SPEED_MULT;
    }
  }

  private spawnAsteroidRing(
    count: number,
    minDist: number,
    maxDist: number
  ): void {
    const sunBody = this.trackedBodies.find(tb => tb.name === "Sun");
    if (!sunBody) return;

    const sunX = sunBody.gravityBody.x;
    const sunY = sunBody.gravityBody.y;
    const sunMass = sunBody.gravityBody.gravityMass;
    const asteroidColors = [0x8b7355, 0xa0926b, 0x7a6b50, 0x6b5c3e, 0x998877];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const x = sunX + Math.cos(angle) * dist;
      const y = sunY + Math.sin(angle) * dist;

      const orbitalSpeed = Math.sqrt(GRAVITY_CONSTANT * sunMass * GRAVITY_SCALE / dist);
      const tangentAngle = angle + Math.PI / 2;
      const perturb = 0.85 + Math.random() * 0.3;

      const size = 80 + Math.random() * 200;
      const color = asteroidColors[Math.floor(Math.random() * asteroidColors.length)];

      const obj = new SpaceObject(this, {
        x, y, size,
        health: 40 + Math.random() * 80,
        massYield: 20 + Math.random() * 40,
        energyYield: 5 + Math.random() * 10,
        gravityMass: 0,
        color,
        velocityX: 0,
        velocityY: 0,
      });
      this.zones.addFixedObject(obj);
      obj.orbitParentName = "Sun";
      obj.orbitAngle = angle;
      obj.orbitRadius = dist;
      const baseAngularSpeed = Math.sqrt(
        GRAVITY_CONSTANT * sunMass * GRAVITY_SCALE / dist
      ) / dist;
      obj.orbitAngularSpeed = -baseAngularSpeed * DEBRIS_ORBIT_SPEED_MULT;
    }
  }

  private getEarthVelocity(): { vx: number; vy: number } {
    return this.getBodyVelocity("Earth");
  }

  private spawnNearEarth(): void {
    const earthBody = this.trackedBodies.find(tb => tb.name === "Earth");
    if (!earthBody) {
      this.player.body.setPosition(WORLD_CENTER_X, WORLD_CENTER_Y);
      this.player.body.setVelocity(0, 0);
      return;
    }

    const killR = earthBody.gravityBody.killRadius ?? 3_000;
    const spawnDist = killR + 1_500;
    this.player.body.setPosition(
      earthBody.gravityBody.x,
      earthBody.gravityBody.y - spawnDist
    );

    // Player's circular orbit speed around Earth
    const playerOrbitSpeed = Math.sqrt(
      GRAVITY_CONSTANT * earthBody.gravityBody.gravityMass * GRAVITY_SCALE / spawnDist
    );

    // Add Earth's own velocity so the player moves with Earth
    const { vx: earthVx, vy: earthVy } = this.getEarthVelocity();
    this.player.body.setVelocity(earthVx - playerOrbitSpeed, earthVy);
  }

  private handleDeath(): void {
    this.audio.play("sfx_game_over");
    this.cameras.main.flash(500, 255, 100, 100);
    this.resources.energy = this.resources.batteryCapacity;
    this.spawnNearEarth();
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

    const allDestroyed = this.hud.markBodyDestroyed(tracked.name);
    if (allDestroyed) {
      this.showWinScreen();
    }
  }

  private showStartScreen(): void {
    this.isPaused = true;
    this.physics.world.pause();

    // Hide HUD and player so they don't bleed through the overlay
    this.hud.setVisible(false);
    this.player.body.setAlpha(0);

    const { width, height } = this.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Semi-transparent overlay — starfield visible behind
    objects.push(
      this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
        .setScrollFactor(0)
        .setDepth(800)
    );

    // Title
    const title = this.add
      .text(width / 2, height * 0.10, "I must grow.", {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#ffd93d",
        stroke: "#000",
        strokeThickness: 6,
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801);
    objects.push(title);

    // "Systems damaged. Repair protocol initiated." — fades in with delay, pulses gently
    const hunger = this.add
      .text(width / 2, height * 0.10 + 70, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ff6b6b",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801)
      .setAlpha(0);
    objects.push(hunger);

    // Typewriter effect — wait 800ms, then reveal one character every 80ms
    const hungerText = '"Systems damaged. Repair protocol initiated."';
    let charIdx = 0;
    this.time.delayedCall(800, () => {
      this.time.addEvent({
        delay: 80,
        repeat: hungerText.length - 1,
        callback: () => {
          if (!hunger.active) return;
          charIdx++;
          hunger.setText(hungerText.substring(0, charIdx));
          hunger.setAlpha(1);
        },
      });
    });

    // Gentle pulse after typewriter finishes
    this.time.delayedCall(800 + hungerText.length * 80 + 200, () => {
      if (hunger.active) {
        this.tweens.add({
          targets: hunger,
          alpha: 0.5,
          yoyo: true,
          repeat: -1,
          duration: 2000,
          ease: "Sine.easeInOut",
        });
      }
    });

    // Staggered fade-in for sections below the title
    const fadeIn = (obj: Phaser.GameObjects.Text, delay: number) => {
      obj.setAlpha(0);
      this.tweens.add({
        targets: obj,
        alpha: 1,
        duration: 400,
        delay,
        ease: "Quad.easeOut",
      });
    };

    // ── How to play ──
    const howHeader = this.add
      .text(width / 2, height * 0.30, "HOW TO PLAY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#6c63ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801);
    objects.push(howHeader);
    fadeIn(howHeader, 400);

    const instructions = [
      "You are a damaged repair bot in Earth orbit.",
      "Consume debris to repair your systems.",
    ];

    for (let i = 0; i < instructions.length; i++) {
      const line = this.add
        .text(width / 2, height * 0.30 + 30 + i * 24, instructions[i], {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#999",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801);
      objects.push(line);
      fadeIn(line, 500 + i * 80);
    }

    // ── Controls ──
    const ctrlHeader = this.add
      .text(width / 2, height * 0.50, "CONTROLS", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#6c63ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801);
    objects.push(ctrlHeader);
    fadeIn(ctrlHeader, 650);

    const controls = [
      "WASD / Left Stick ····· Move",
      "SPACE / A ············· Burst Fire",
      "SHIFT / RT ············ Boost",
      "ESC / Start ··········· Settings",
    ];

    for (let i = 0; i < controls.length; i++) {
      const line = this.add
        .text(width / 2, height * 0.50 + 30 + i * 24, controls[i], {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#999",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(801);
      objects.push(line);
      fadeIn(line, 730 + i * 80);
    }

    // ── Start prompt — pulses ──
    const prompt = this.add
      .text(width / 2, height * 0.82, "[ PRESS SPACE OR ANY BUTTON TO BEGIN ]", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#4ecdc4",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801)
      .setAlpha(0);
    objects.push(prompt);

    // Prompt fades in after other sections, then pulses
    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 400,
      delay: 1100,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: prompt,
          alpha: 0.3,
          yoyo: true,
          repeat: -1,
          duration: 1200,
          ease: "Sine.easeInOut",
        });
      },
    });

    this.cameras.main.ignore(objects);

    // Dismiss on ANY input
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      for (const obj of objects) obj.destroy();
      this.hud.setVisible(true);
      this.player.body.setAlpha(1);
      this.isPaused = false;
      this.physics.world.resume();
      this.audio.music.play("ambient");
    };

    // Space or Enter only (not Shift — interferes with screenshots)
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    spaceKey.once("down", dismiss);
    enterKey.once("down", dismiss);
    // Click/touch
    this.input.once("pointerdown", dismiss);
    // Gamepad any button
    if (this.input.gamepad) {
      this.input.gamepad.once("down", dismiss);
    }
  }

  private showWinScreen(): void {
    // Dismiss upgrade screen if open
    if (this.upgradeScreen) {
      this.upgradeScreen.forceClose();
    }

    this.isPaused = true;
    this.physics.world.pause();

    const { width, height } = this.scale;

    // ── Fanfare ──
    this.cameras.main.flash(1000, 255, 215, 0); // gold flash
    this.cameras.main.shake(2000, 0.015);
    this.audio.play("sfx_tier_up");

    // Explosion particles across the screen
    for (let i = 0; i < 8; i++) {
      const px = width * 0.2 + Math.random() * width * 0.6;
      const py = height * 0.2 + Math.random() * height * 0.6;
      const colors = [0xffd93d, 0xff6b6b, 0x6c63ff, 0x4ecdc4, 0xffaa00];
      const particles = this.add.particles(px, py, "particle", {
        speed: { min: 100, max: 300 },
        scale: { start: 1.0, end: 0 },
        tint: colors[i % colors.length],
        lifespan: 2000,
        quantity: 20,
        emitting: false,
      }).setScrollFactor(0).setDepth(610);
      this.time.delayedCall(i * 200, () => particles.explode(20));
      this.time.delayedCall(3000, () => particles.destroy());
    }

    // ── Win screen UI (delayed slightly so fanfare plays first) ──
    this.time.delayedCall(500, () => {
      // Dark overlay
      const overlay = this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
        .setScrollFactor(0)
        .setDepth(600);

      // Format elapsed time
      const totalSeconds = Math.floor(this.elapsedTime / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timeStr = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

      // Title — animates in
      const title = this.add
        .text(width / 2, height * 0.3, "YOU WIN", {
          fontFamily: "monospace",
          fontSize: "72px",
          color: "#ffd93d",
          stroke: "#000",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601)
        .setAlpha(0)
        .setScale(0.5);

      this.tweens.add({
        targets: title,
        alpha: 1,
        scale: 1,
        duration: 800,
        ease: "Back.easeOut",
      });

      // Subtitle
      const subtitle = this.add
        .text(width / 2, height * 0.3 + 80, "The solar system has been destroyed.", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#aaa",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601)
        .setAlpha(0);

      this.tweens.add({
        targets: subtitle,
        alpha: 1,
        duration: 600,
        delay: 600,
      });

      // Final monologue
      this.add
        .text(width / 2, height * 0.3 + 120, '"There is nothing left... or is there?"', {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ff6b6b",
          fontStyle: "italic",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);

      // Time
      this.add
        .text(width / 2, height * 0.5, `Time: ${timeStr}`, {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#4ecdc4",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);

      // Stats
      this.add
        .text(width / 2, height * 0.5 + 50, `Total mass consumed: ${Math.floor(this.resources.totalMassEarned).toLocaleString()}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#888",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(601);

      // Restart button
      const restartBtn = this.add
        .text(width / 2, height * 0.7, "[ PLAY AGAIN ]", {
          fontFamily: "monospace",
          fontSize: "24px",
          color: "#4ecdc4",
          backgroundColor: "#1a1a2e",
          padding: { x: 24, y: 12 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(602)
        .setInteractive({ useHandCursor: true });

      restartBtn.on("pointerover", () => restartBtn.setColor("#fff"));
      restartBtn.on("pointerout", () => restartBtn.setColor("#4ecdc4"));
      restartBtn.on("pointerdown", () => this.scene.restart());

      // Keyboard restart
      const restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      restartKey.once("down", () => this.scene.restart());
      const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.once("down", () => this.scene.restart());

      // Gamepad A button restart
      if (this.input.gamepad) {
        this.input.gamepad.once("down", () => this.scene.restart());
      }

      // Ignore overlay from main camera
      this.cameras.main.ignore([overlay]);
    });
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

      // Store velocity so ZoneManager and other systems can inherit it
      const linearSpeed = orbit.orbitSpeed * orbit.distance * ORBIT_SPEED_SCALE;
      const perpAngle = orbit.currentAngle + Math.PI / 2;
      tracked.gravityBody.velocityX = Math.cos(perpAngle) * linearSpeed;
      tracked.gravityBody.velocityY = Math.sin(perpAngle) * linearSpeed;

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
    const pull = this.gravity.calculateDominantPull(this.player.x, this.player.y);
    if (pull.magnitude < 0.1) return;

    const nx = pull.x / pull.magnitude;
    const ny = pull.y / pull.magnitude;

    let color = 0x4488cc;
    let alpha = 0.6;
    let arrowLength = 20;

    const dominant = this.gravity.getDominantBody(this.player.x, this.player.y);
    if (dominant) {
      const level = this.gravity.getDangerLevel(dominant, this.player.x, this.player.y, this.player.thrustPower);
      if (level === "deadly") { color = 0xff4444; alpha = 1.0; arrowLength = 28; }
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
