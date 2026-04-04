import Phaser from "phaser";
import { ZONES, type ZoneDefinition } from "@/data/zones";
import { SpaceObject } from "@/entities/SpaceObject";
import { WORLD_WIDTH, WORLD_HEIGHT, GRAVITY_CONSTANT, GRAVITY_SCALE } from "@/constants";
import type { GravitySystem } from "@/systems/GravitySystem";

const CENTER_X = WORLD_WIDTH / 2;
const CENTER_Y = WORLD_HEIGHT / 2;

export class ZoneManager {
  private scene: Phaser.Scene;
  private gravity: GravitySystem | null;
  private objects: SpaceObject[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000;

  objectGroup!: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, gravity: GravitySystem | null = null) {
    this.scene = scene;
    this.gravity = gravity;
    this.objectGroup = scene.physics.add.group();
  }

  update(
    delta: number,
    playerX: number,
    playerY: number,
    playerTier: number,
    playerSize: number = 8
  ): void {
    this.spawnTimer += delta;

    if (this.spawnTimer < this.spawnInterval) return;
    this.spawnTimer = 0;

    // Clean up destroyed objects
    this.objects = this.objects.filter((obj) => obj.sprite.active);

    // LOD cull — remove objects too small to matter at current player size
    const surviving: SpaceObject[] = [];
    for (const obj of this.objects) {
      if (!obj.sprite.active) continue;
      const isFixed = obj.sprite.getData("fixed") === true;
      if (isFixed) {
        surviving.push(obj);
        continue;
      }
      const cullThreshold = playerSize * 0.08;
      if (obj.config.size < cullThreshold) {
        obj.destroy();
        continue;
      }
      surviving.push(obj);
    }
    this.objects = surviving;

    const playerDist = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      CENTER_X,
      CENTER_Y
    );

    for (const zone of ZONES) {
      // Gate zones by activation range
      const zoneCenter = (zone.minDistance + zone.maxDistance) / 2;
      const distToZone = Math.abs(playerDist - zoneCenter);
      if (distToZone > zone.activationRange + playerSize * 10) continue;

      const objectsInZone = this.objects.filter((obj) => {
        const d = Phaser.Math.Distance.Between(
          obj.sprite.x,
          obj.sprite.y,
          CENTER_X,
          CENTER_Y
        );
        return d >= zone.minDistance && d < zone.maxDistance;
      });

      if (objectsInZone.length >= zone.maxObjects) continue;

      this.spawnInZone(zone, playerTier, playerX, playerY, false, playerSize);
    }
  }

  /** Pre-populate zones at scene start — fills each zone to 70% capacity immediately. */
  populate(playerX: number, playerY: number, playerTier: number): void {
    for (const zone of ZONES) {
      const target = Math.floor(zone.maxObjects * 0.7);
      for (let i = 0; i < target; i++) {
        this.spawnInZone(zone, playerTier, playerX, playerY, true, 8);
      }
    }
  }

  /** Returns true if the position is inside any gravity body's warning band. */
  /**
   * Compute tangential velocity for a stable circular orbit around the nearest major body.
   */
  private computeOrbitalVelocity(x: number, y: number): { vx: number; vy: number } {
    if (!this.gravity) return { vx: 0, vy: 0 };
    let nearestBody: { x: number; y: number; gravityMass: number } | null = null;
    let nearestDist = Infinity;
    for (const body of this.gravity.getBodies()) {
      if (body.killRadius === undefined) continue;
      const dist = Phaser.Math.Distance.Between(x, y, body.x, body.y);
      if (dist < nearestDist) { nearestDist = dist; nearestBody = body; }
    }
    if (!nearestBody || nearestDist < 1) return { vx: 0, vy: 0 };

    const orbitalSpeed = Math.sqrt(
      GRAVITY_CONSTANT * nearestBody.gravityMass * GRAVITY_SCALE / nearestDist
    );
    const dx = nearestBody.x - x;
    const dy = nearestBody.y - y;
    const nx = dx / nearestDist;
    const ny = dy / nearestDist;
    const sign = Math.random() < 0.5 ? 1 : -1;
    const perturb = 0.9 + Math.random() * 0.2;
    return { vx: -ny * sign * orbitalSpeed * perturb, vy: nx * sign * orbitalSpeed * perturb };
  }

  private isInsideBodyZone(x: number, y: number): boolean {
    if (!this.gravity) return false;
    for (const body of this.gravity.getBodies()) {
      if (body.killRadius === undefined) continue;
      const dist = Phaser.Math.Distance.Between(x, y, body.x, body.y);
      if (dist < body.killRadius * 1.2) return true;
    }
    return false;
  }

  private spawnInZone(
    zone: ZoneDefinition,
    playerTier: number,
    playerX: number,
    playerY: number,
    skipDistCheck: boolean = false,
    playerSize: number = 8
  ): void {
    const eligible = zone.spawnTable.filter((e) => playerTier >= e.minTier);
    if (eligible.length === 0) return;

    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = eligible[0];
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) { selected = entry; break; }
    }

    const playerDist = Phaser.Math.Distance.Between(playerX, playerY, CENTER_X, CENTER_Y);

    for (let attempt = 0; attempt < 5; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const minD = skipDistCheck ? zone.minDistance : Math.max(zone.minDistance, playerDist - 400);
      const maxD = skipDistCheck ? zone.maxDistance : Math.min(zone.maxDistance, playerDist + 600);
      const dist = minD + Math.random() * Math.max(maxD - minD, 0);

      const x = CENTER_X + Math.cos(angle) * dist;
      const y = CENTER_Y + Math.sin(angle) * dist;

      if (this.isInsideBodyZone(x, y)) continue;

      const spawnMin = Math.max(200, playerSize * 3);
      const spawnMax = Math.max(2000, playerSize * 25);
      const distToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY);
      if (!skipDistCheck && (distToPlayer < spawnMin || distToPlayer > spawnMax)) continue;

      const config = selected.factory();
      const { vx, vy } = this.computeOrbitalVelocity(x, y);
      const obj = new SpaceObject(this.scene, { x, y, velocityX: vx, velocityY: vy, ...config });
      this.objects.push(obj);
      this.objectGroup.add(obj.sprite);
      return;
    }
  }

  /** Add a permanently-placed object (planet). Never culled by size. */
  addFixedObject(obj: SpaceObject): void {
    obj.sprite.setData("fixed", true);
    this.objects.push(obj);
    this.objectGroup.add(obj.sprite);
  }

  getObjects(): SpaceObject[] {
    return this.objects.filter((o) => o.sprite.active);
  }

  removeObject(obj: SpaceObject): void {
    const idx = this.objects.indexOf(obj);
    if (idx !== -1) this.objects.splice(idx, 1);
    obj.destroy();
  }
}
