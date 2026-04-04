import { GRAVITY_CONSTANT, SOI_MULTIPLIER } from "@/constants";

export interface TrajectoryPoint {
  x: number;
  y: number;
}

type Body = { x: number; y: number; gravityMass: number; killRadius?: number };

/** Find the dominant body at a position using SOI rules (mirrors GravitySystem). */
function findDominantBody(bodies: readonly Body[], px: number, py: number): Body | null {
  let dominantBody: Body | null = null;
  let smallestSOI = Infinity;
  let fallbackBody: Body | null = null;
  let fallbackMass = 0;

  for (const body of bodies) {
    if (body.killRadius !== undefined && body.killRadius > 0) {
      const soi = body.killRadius * SOI_MULTIPLIER;
      const dx = body.x - px;
      const dy = body.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < soi && soi < smallestSOI) {
        dominantBody = body;
        smallestSOI = soi;
      }
    }
    if (body.gravityMass > fallbackMass) {
      fallbackMass = body.gravityMass;
      fallbackBody = body;
    }
  }
  return dominantBody ?? fallbackBody;
}

/**
 * Predict future trajectory points via Euler integration using sphere-of-influence gravity.
 * Pure function — no Phaser dependency, fully unit-testable.
 */
export function predictTrajectory(
  px: number, py: number,
  vx: number, vy: number,
  bodies: readonly Body[],
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
    const body = findDominantBody(bodies, x, y);
    if (body) {
      const dx = body.x - x;
      const dy = body.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= 20 * 20) {
        const dist = Math.sqrt(distSq);
        const force = (GRAVITY_CONSTANT * body.gravityMass) / distSq;
        velX += (dx / dist) * force * dt * gravityScale;
        velY += (dy / dist) * force * dt * gravityScale;
      }
    }
    x += velX * dt;
    y += velY * dt;
    points.push({ x, y });
  }

  return points;
}
