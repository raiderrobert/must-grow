import Phaser from "phaser";
import { ZONES, type ZoneDefinition } from "@/data/zones";
import { SpaceObject } from "@/entities/SpaceObject";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/constants";

const CENTER_X = WORLD_WIDTH / 2;
const CENTER_Y = WORLD_HEIGHT / 2;

export class ZoneManager {
  private scene: Phaser.Scene;
  private objects: SpaceObject[] = [];
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000; // ms between spawn checks

  objectGroup!: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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

    const playerDist = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      CENTER_X,
      CENTER_Y
    );

    for (const zone of ZONES) {
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

      if (
        playerDist < zone.minDistance - 1500 ||
        playerDist > zone.maxDistance + 1500
      )
        continue;

      this.spawnInZone(zone, playerTier, playerX, playerY);
    }
  }

  /** Pre-populate zones at scene start — fills each zone to 70% capacity immediately. */
  populate(playerX: number, playerY: number, playerTier: number): void {
    for (const zone of ZONES) {
      const target = Math.floor(zone.maxObjects * 0.7);
      for (let i = 0; i < target; i++) {
        this.spawnInZone(zone, playerTier, playerX, playerY, true);
      }
    }
  }

  private spawnInZone(
    zone: ZoneDefinition,
    playerTier: number,
    playerX: number,
    playerY: number,
    skipDistCheck: boolean = false
  ): void {
    const eligible = zone.spawnTable.filter((e) => playerTier >= e.minTier);
    if (eligible.length === 0) return;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected = eligible[0];
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) {
        selected = entry;
        break;
      }
    }

    const angle = Math.random() * Math.PI * 2;

    // Bias spawn ring toward the player's current distance from center
    const playerDist = Phaser.Math.Distance.Between(playerX, playerY, CENTER_X, CENTER_Y);
    const minD = skipDistCheck
      ? zone.minDistance
      : Math.max(zone.minDistance, playerDist - 400);
    const maxD = skipDistCheck
      ? zone.maxDistance
      : Math.min(zone.maxDistance, playerDist + 600);
    const dist = minD + Math.random() * Math.max(maxD - minD, 0);

    const x = CENTER_X + Math.cos(angle) * dist;
    const y = CENTER_Y + Math.sin(angle) * dist;

    // Don't spawn too close to or too far from player
    const distToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY);
    if (!skipDistCheck && (distToPlayer < 200 || distToPlayer > 2000)) return;

    const config = selected.factory();
    const obj = new SpaceObject(this.scene, { x, y, ...config });
    this.objects.push(obj);
    this.objectGroup.add(obj.sprite);
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
