import { GRAVITY_CONSTANT } from "@/constants";

export interface TrajectoryPoint {
  x: number;
  y: number;
}

/**
 * Predict future trajectory points via Euler integration through the gravity field.
 * Pure function — no Phaser dependency, fully unit-testable.
 */
export function predictTrajectory(
  px: number, py: number,
  vx: number, vy: number,
  bodies: readonly { x: number; y: number; gravityMass: number }[],
  steps: number,
  durationSec: number,
  gravityScale: number
): TrajectoryPoint[] {
  if (steps <= 0) return [];

  const dt = durationSec / steps;
  const points: TrajectoryPoint[] = [];
  let x = px, y = py;
  let velX = vx, velY = vy;

  for (let i = 0; i < steps; i++) {
    for (const body of bodies) {
      const dx = body.x - x;
      const dy = body.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 20 * 20) continue;
      const dist = Math.sqrt(distSq);
      const force = (GRAVITY_CONSTANT * body.gravityMass) / distSq;
      velX += (dx / dist) * force * dt * gravityScale;
      velY += (dy / dist) * force * dt * gravityScale;
    }
    x += velX * dt;
    y += velY * dt;
    points.push({ x, y });
  }

  return points;
}
