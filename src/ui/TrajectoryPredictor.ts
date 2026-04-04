import Phaser from "phaser";
import { TRAJECTORY_STEPS, TRAJECTORY_DURATION, GRAVITY_SCALE, COLORS } from "@/constants";
import type { GravitySystem } from "@/systems/GravitySystem";
import { predictTrajectory } from "@/ui/TrajectoryMath";

// Re-export pure function so callers can import from either file
export { predictTrajectory } from "@/ui/TrajectoryMath";
export type { TrajectoryPoint } from "@/ui/TrajectoryMath";

export class TrajectoryPredictor {
  private graphics: Phaser.GameObjects.Graphics;
  private gravity: GravitySystem;

  constructor(scene: Phaser.Scene, gravity: GravitySystem) {
    this.graphics = scene.add.graphics().setDepth(4);
    this.gravity = gravity;
  }

  update(playerX: number, playerY: number, velocityX: number, velocityY: number): void {
    this.graphics.clear();

    const bodies = this.gravity.getBodies();
    const points = predictTrajectory(
      playerX, playerY,
      velocityX, velocityY,
      bodies,
      TRAJECTORY_STEPS,
      TRAJECTORY_DURATION,
      GRAVITY_SCALE
    );

    for (let i = 0; i < points.length; i++) {
      const t = i / points.length;
      const alpha = 0.6 * (1 - t);
      const radius = Math.max(1, 3 - t * 2);
      this.graphics.fillStyle(COLORS.station, alpha);
      this.graphics.fillCircle(points[i].x, points[i].y, radius);
    }
  }

  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }
}
