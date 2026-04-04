import Phaser from "phaser";
import { COLORS, WORLD_CENTER_X, WORLD_CENTER_Y } from "@/constants";
import { BODY_DEFS } from "@/data/bodies";
import type { GravitySystem, GravityBody } from "@/systems/GravitySystem";
import { computeViewRange, worldToMinimap } from "@/ui/MinimapMath";

// Re-export pure functions so tests can import from @/ui/Minimap
export { computeViewRange, worldToMinimap } from "@/ui/MinimapMath";
export type { MinimapPos } from "@/ui/MinimapMath";

// ── Label abbreviations ─────────────────────────────────────────────

const ABBREVS: Record<string, string> = {
  Sun: "Su", Earth: "Ea", Mercury: "Me", Venus: "Ve",
  Mars: "Ma", Jupiter: "Ju", Saturn: "Sa", Uranus: "Ur", Neptune: "Ne",
};

// ── Internal types ──────────────────────────────────────────────────

interface Ghost { x: number; y: number; color: number; }

interface BodyInfo {
  name: string;
  color: number;
  visualRadius: number;
  killRadius: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MAP_SIZE = 150;
const MAP_MARGIN = 8;

// ── Minimap class ───────────────────────────────────────────────────

export class Minimap {
  private scene: Phaser.Scene;
  private gravity: GravitySystem;
  private graphics: Phaser.GameObjects.Graphics;
  private ghosts: Ghost[] = [];
  private currentViewRange: number = 10_000;

  private bodyInfoMap: Map<GravityBody, BodyInfo> = new Map();

  private mapX: number;
  private mapY: number;

  private labelPool: Phaser.GameObjects.Text[] = [];
  private labelIndex: number = 0;
  private mainCamera: Phaser.Cameras.Scene2D.Camera | null = null;

  constructor(scene: Phaser.Scene, gravity: GravitySystem) {
    this.scene = scene;
    this.gravity = gravity;

    this.mapX = scene.scale.width - MAP_SIZE - MAP_MARGIN;
    this.mapY = scene.scale.height - MAP_SIZE - MAP_MARGIN;

    this.graphics = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(95);

    this.rebuildBodyInfo();
  }

  setMainCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCamera = camera;
  }

  private rebuildBodyInfo(): void {
    this.bodyInfoMap.clear();
    for (const body of this.gravity.getBodies()) {
      const def = BODY_DEFS.find(d => {
        const bx = WORLD_CENTER_X + Math.cos(d.angle) * d.distance;
        const by = WORLD_CENTER_Y + Math.sin(d.angle) * d.distance;
        return Math.abs(bx - body.x) < 1 && Math.abs(by - body.y) < 1;
      });
      if (def) {
        this.bodyInfoMap.set(body, {
          name: def.name,
          color: def.color,
          visualRadius: def.visualRadius,
          killRadius: def.killRadius,
        });
      }
    }
  }

  private getLabel(): Phaser.GameObjects.Text {
    if (this.labelIndex < this.labelPool.length) {
      const label = this.labelPool[this.labelIndex];
      label.setVisible(true);
      this.labelIndex++;
      return label;
    }
    const label = this.scene.add.text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(96);
    if (this.mainCamera) this.mainCamera.ignore(label);
    this.labelPool.push(label);
    this.labelIndex++;
    return label;
  }

  update(playerX: number, playerY: number, delta: number): void {
    this.graphics.clear();

    // Reset label pool
    this.labelIndex = 0;
    for (const label of this.labelPool) label.setVisible(false);

    const bodies = this.gravity.getBodies();

    if (bodies.length !== this.bodyInfoMap.size) {
      this.rebuildBodyInfo();
    }

    // Background
    this.graphics.fillStyle(0x0a0a1a, 0.85);
    this.graphics.fillRect(this.mapX, this.mapY, MAP_SIZE, MAP_SIZE);
    this.graphics.lineStyle(1, 0x4488cc, 0.6);
    this.graphics.strokeRect(this.mapX, this.mapY, MAP_SIZE, MAP_SIZE);

    // Adaptive view range
    const distances: number[] = [];
    for (const body of bodies) {
      distances.push(Phaser.Math.Distance.Between(playerX, playerY, body.x, body.y));
    }
    const targetRange = computeViewRange(distances);
    const lerpFactor = 1 - Math.exp(-2 * (delta / 1000));
    this.currentViewRange += (targetRange - this.currentViewRange) * lerpFactor;

    // Ghost markers (destroyed bodies)
    for (const ghost of this.ghosts) {
      const pos = worldToMinimap(
        ghost.x, ghost.y, playerX, playerY,
        this.currentViewRange, this.mapX, this.mapY, MAP_SIZE
      );
      this.graphics.fillStyle(ghost.color, 0.2);
      this.graphics.fillCircle(pos.x, pos.y, 3);
      this.graphics.lineStyle(1, ghost.color, 0.4);
      this.graphics.lineBetween(pos.x - 2, pos.y - 2, pos.x + 2, pos.y + 2);
      this.graphics.lineBetween(pos.x + 2, pos.y - 2, pos.x - 2, pos.y + 2);
    }

    // Live bodies
    for (const body of bodies) {
      const info = this.bodyInfoMap.get(body);
      if (!info) continue;

      const pos = worldToMinimap(
        body.x, body.y, playerX, playerY,
        this.currentViewRange, this.mapX, this.mapY, MAP_SIZE
      );

      const dotSize = Math.max(2, Math.min(20,
        info.visualRadius / this.currentViewRange * MAP_SIZE
      ));

      // Kill zone ring
      if (body.killRadius !== undefined) {
        const ringRadius = Math.max(dotSize + 1,
          body.killRadius / this.currentViewRange * (MAP_SIZE / 2)
        );
        this.graphics.lineStyle(1, 0xff3300, 0.35);
        this.graphics.strokeCircle(pos.x, pos.y, ringRadius);
      }

      // Body dot
      this.graphics.fillStyle(info.color, 1.0);
      this.graphics.fillCircle(pos.x, pos.y, dotSize);

      // Label
      if (dotSize > 4) {
        const abbrev = ABBREVS[info.name] ?? info.name.substring(0, 2);
        const label = this.getLabel();
        label.setText(abbrev);
        label.setPosition(pos.x, pos.y - dotSize - 2);
        label.setColor("#" + info.color.toString(16).padStart(6, "0"));
        label.setAlpha(0.7);
      }
    }

    // Player dot (always centered)
    const cx = this.mapX + MAP_SIZE / 2;
    const cy = this.mapY + MAP_SIZE / 2;
    this.graphics.fillStyle(COLORS.station, 0.4);
    this.graphics.fillCircle(cx, cy, 4);
    this.graphics.fillStyle(COLORS.station, 1.0);
    this.graphics.fillCircle(cx, cy, 2);
  }

  addGhost(x: number, y: number, color: number): void {
    this.ghosts.push({ x, y, color });
  }

  getObjects(): Phaser.GameObjects.GameObject[] {
    return [this.graphics, ...this.labelPool];
  }
}
