import Phaser from "phaser";
import { SpaceObject } from "@/entities/SpaceObject";
import { ZoneManager } from "@/systems/ZoneManager";
import { ResourceManager } from "@/systems/ResourceManager";
import { GRAVITY_CONSTANT, GRAVITY_SCALE, DEBRIS_ORBIT_SPEED_MULT } from "@/constants";

const BEAM_COOLDOWN = 2000; // ms between shots
const BEAM_RANGE = 500; // px
const BEAM_ENERGY_DRAIN = 8; // energy per hit
const SPAWN_INTERVAL = 10_000; // ms between new satellite spawns
const MAX_SATELLITES = 20;
const INITIAL_WAVE = 8;

interface DefenseSat {
  obj: SpaceObject;
  beamCooldown: number;
}

export class EarthDefense {
  private scene: Phaser.Scene;
  private zones: ZoneManager;
  private resources: ResourceManager;
  private satellites: DefenseSat[] = [];
  private active = false;
  private spawnTimer = 0;
  private beamGraphics: Phaser.GameObjects.Graphics;

  // Earth reference — set during activation
  private earthX = 0;
  private earthY = 0;
  private earthKillRadius = 0;
  private earthGravityMass = 0;
  private earthBodyName = "Earth";

  constructor(scene: Phaser.Scene, zones: ZoneManager, resources: ResourceManager) {
    this.scene = scene;
    this.zones = zones;
    this.resources = resources;
    this.beamGraphics = scene.add.graphics().setDepth(15);
  }

  activate(earthX: number, earthY: number, earthKillRadius: number, earthGravityMass: number): void {
    if (this.active) return;
    this.active = true;
    this.earthX = earthX;
    this.earthY = earthY;
    this.earthKillRadius = earthKillRadius;
    this.earthGravityMass = earthGravityMass;
    this.spawnWave(INITIAL_WAVE);
  }

  /** Update Earth position each frame (Earth orbits the Sun). */
  setEarthPosition(x: number, y: number): void {
    this.earthX = x;
    this.earthY = y;
  }

  private spawnWave(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.countActive() >= MAX_SATELLITES) break;
      this.spawnSatellite();
    }
  }

  private spawnSatellite(): void {
    const angle = Math.random() * Math.PI * 2;
    const altitude = 1000 + Math.random() * 4000;
    const dist = this.earthKillRadius + altitude;
    const x = this.earthX + Math.cos(angle) * dist;
    const y = this.earthY + Math.sin(angle) * dist;

    const obj = new SpaceObject(this.scene, {
      x, y,
      size: 20,
      health: 40,
      massYield: 15,
      energyYield: 10,
      gravityMass: 0,
      color: 0xcc4444,
      name: "Defense Sat",
    });

    this.zones.addFixedObject(obj);

    // Prescribe orbit around Earth
    obj.orbitParentName = this.earthBodyName;
    obj.orbitAngle = angle;
    obj.orbitRadius = dist;
    const baseAngularSpeed = Math.sqrt(
      GRAVITY_CONSTANT * this.earthGravityMass * GRAVITY_SCALE / dist
    ) / dist;
    obj.orbitAngularSpeed = -baseAngularSpeed * DEBRIS_ORBIT_SPEED_MULT;

    this.satellites.push({ obj, beamCooldown: Math.random() * BEAM_COOLDOWN });
  }

  private countActive(): number {
    return this.satellites.filter(s => s.obj.sprite.active).length;
  }

  update(delta: number, playerX: number, playerY: number): void {
    if (!this.active) return;

    this.beamGraphics.clear();

    // Prune destroyed satellites
    this.satellites = this.satellites.filter(s => s.obj.sprite.active);

    // Spawn timer
    this.spawnTimer += delta;
    if (this.spawnTimer >= SPAWN_INTERVAL && this.countActive() < MAX_SATELLITES) {
      this.spawnSatellite();
      this.spawnTimer = 0;
    }

    // Each satellite: check range and fire beam
    for (const sat of this.satellites) {
      if (!sat.obj.sprite.active) continue;

      sat.beamCooldown -= delta;
      if (sat.beamCooldown > 0) continue;

      const sx = sat.obj.sprite.x;
      const sy = sat.obj.sprite.y;
      const dist = Phaser.Math.Distance.Between(sx, sy, playerX, playerY);

      if (dist <= BEAM_RANGE) {
        // Fire beam — drain player energy
        this.resources.energy = Math.max(0, this.resources.energy - BEAM_ENERGY_DRAIN);
        sat.beamCooldown = BEAM_COOLDOWN;

        // Draw beam line
        this.beamGraphics.lineStyle(2, 0xff4444, 0.7);
        this.beamGraphics.lineBetween(sx, sy, playerX, playerY);

        // Clear beam visual after brief delay
        this.scene.time.delayedCall(120, () => {
          if (this.beamGraphics.active) this.beamGraphics.clear();
        });
      }
    }
  }

  getGraphics(): Phaser.GameObjects.Graphics {
    return this.beamGraphics;
  }
}
