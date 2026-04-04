/**
 * Orbital physics: Kepler-ish circular orbits around parent bodies.
 * Pure functions are exported for unit testing.
 */

export interface OrbitStepResult {
  angle: number;
  x: number;
  y: number;
}

export interface OrbitState {
  bodyName: string;
  parentName: string;
  distance: number;
  orbitSpeed: number;
  currentAngle: number;
}

/**
 * Compute angular speed (rad/s) for a circular orbit at a given distance.
 * Tuned so Mercury (12,000px) orbits in ~60 seconds at ORBIT_SPEED_SCALE=1.
 * Period scales as distance^1.5 (Kepler's third law, compressed).
 */
export function computeOrbitSpeed(distance: number): number {
  if (distance <= 0) return 0;
  // Mercury at 12,000px → period 60s → C = 60 / 12000^1.5
  const C = 60 / Math.pow(12_000, 1.5);
  const period = C * Math.pow(distance, 1.5);
  return (2 * Math.PI) / period;
}

/**
 * Step one orbit forward by deltaMs milliseconds.
 * Returns the new angle (wrapped to [0, 2π)) and world position.
 */
export function stepOrbit(
  currentAngle: number,
  distance: number,
  orbitSpeed: number,
  deltaMs: number,
  speedScale: number,
  parentX: number,
  parentY: number
): OrbitStepResult {
  let angle = currentAngle + orbitSpeed * speedScale * (deltaMs / 1000);
  angle = angle % (Math.PI * 2);
  if (angle < 0) angle += Math.PI * 2;

  return {
    angle,
    x: parentX + Math.cos(angle) * distance,
    y: parentY + Math.sin(angle) * distance,
  };
}

/**
 * Build runtime orbit states from body definitions.
 * Bodies with orbitParent === null (the Sun) are skipped.
 */
export function createOrbitStates(
  bodies: { name: string; distance: number; angle: number; orbitParent: string | null }[]
): OrbitState[] {
  return bodies
    .filter(b => b.orbitParent !== null)
    .map(b => ({
      bodyName: b.name,
      parentName: b.orbitParent!,
      distance: b.distance,
      orbitSpeed: computeOrbitSpeed(b.distance),
      currentAngle: b.angle,
    }));
}
