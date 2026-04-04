import { GRAVITY_CONSTANT } from "@/constants";
import Phaser from "phaser";

export interface GravityBody {
  x: number;
  y: number;
  gravityMass: number;
  killRadius?: number;   // explicit surface radius; overrides the calculated default
  name?: string;        // for identification (e.g., "Earth", "Sun")
  velocityX?: number;   // current velocity — updated each frame by orbit system
  velocityY?: number;
}

export interface GravityPull {
  x: number;
  y: number;
  magnitude: number;
}

export type DangerLevel = "safe" | "warning" | "deadly";

export class GravitySystem {
  private bodies: GravityBody[] = [];
  private graphics?: Phaser.GameObjects.Graphics;

  addBody(body: GravityBody): void {
    this.bodies.push(body);
  }

  removeBody(body: GravityBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
  }

  getBodies(): readonly GravityBody[] {
    return this.bodies;
  }

  calculatePull(
    body: GravityBody,
    playerX: number,
    playerY: number
  ): GravityPull {
    const dx = body.x - playerX;
    const dy = body.y - playerY;
    const distSq = dx * dx + dy * dy;
    const minDist = 20;

    if (distSq < minDist * minDist) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    const dist = Math.sqrt(distSq);
    const force = (GRAVITY_CONSTANT * body.gravityMass) / distSq;

    return {
      x: (dx / dist) * force,
      y: (dy / dist) * force,
      magnitude: force,
    };
  }

  /** Calculate total gravity pull from all bodies on a point. */
  calculateTotalPull(playerX: number, playerY: number): GravityPull {
    let totalX = 0;
    let totalY = 0;

    for (const body of this.bodies) {
      const pull = this.calculatePull(body, playerX, playerY);
      totalX += pull.x;
      totalY += pull.y;
    }

    return {
      x: totalX,
      y: totalY,
      magnitude: Math.sqrt(totalX * totalX + totalY * totalY),
    };
  }

  getDangerLevel(
    body: GravityBody,
    playerX: number,
    playerY: number,
    playerThrust: number
  ): DangerLevel {
    const pull = this.calculatePull(body, playerX, playerY);
    const ratio = pull.magnitude / Math.max(playerThrust, 1);

    if (ratio > 1.5) return "deadly";
    if (ratio > 0.7) return "warning";
    return "safe";
  }

  initGraphics(scene: Phaser.Scene): void {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(-5);
  }

  getGraphics(): Phaser.GameObjects.Graphics | undefined {
    return this.graphics;
  }

  /** Returns true if the player should die from gravity (too close to a deadly body). */
  isInLethalZone(
    playerX: number,
    playerY: number,
    playerThrust: number
  ): boolean {
    for (const body of this.bodies) {
      const dx = body.x - playerX;
      const dy = body.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Explicit kill radius — pure distance check, no danger level gating
      if (body.killRadius !== undefined) {
        if (dist < body.killRadius) return true;
        continue;
      }

      // Fallback: gravity-based calculation for bodies without explicit radius
      if (this.getDangerLevel(body, playerX, playerY, playerThrust) === "deadly") {
        if (dist < Math.sqrt(body.gravityMass) * 2) return true;
      }
    }
    return false;
  }

  /**
   * Returns 0 (fully safe) to 1 (at kill zone surface) based on proximity
   * to the nearest body that has an explicit killRadius.
   * Warning band starts at killRadius * warningBandMult outside the kill surface.
   */
  getApproachFactor(
    playerX: number,
    playerY: number,
    warningBandMult: number = 1.2
  ): number {
    let maxFactor = 0;
    for (const body of this.bodies) {
      if (body.killRadius === undefined) continue;
      const dx = body.x - playerX;
      const dy = body.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const warningRadius = body.killRadius * warningBandMult;
      if (dist < warningRadius) {
        const factor = (warningRadius - dist) / (warningRadius - body.killRadius);
        maxFactor = Math.max(maxFactor, Math.min(1, Math.max(0, factor)));
      }
    }
    return maxFactor;
  }

  renderDangerZones(
    playerX: number,
    playerY: number,
    playerThrust: number
  ): void {
    if (!this.graphics) return;
    this.graphics.clear();

    for (const body of this.bodies) {
      const dangerLevel = this.getDangerLevel(body, playerX, playerY, playerThrust);
      if (dangerLevel === "safe") continue;

      const radius = Math.sqrt(
        (GRAVITY_CONSTANT * body.gravityMass) / (playerThrust * 0.7)
      );
      const color = dangerLevel === "deadly" ? 0xff4444 : 0xffaa44;
      const alpha = dangerLevel === "deadly" ? 0.15 : 0.08;

      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(body.x, body.y, radius);
      this.graphics.lineStyle(1, color, 0.3);
      this.graphics.strokeCircle(body.x, body.y, radius);
    }
  }
}
