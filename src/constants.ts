// Physics
export const GRAVITY_CONSTANT = 250;
export const EARTH_GRAVITY_MASS = 500;
export const EARTH_GRAVITY_PULL = 30; // constant downward pull in Tier 1 (pixels/sec²)

// Player
export const PLAYER_START_X = 400;
export const PLAYER_START_Y = 300;
export const PLAYER_BASE_SPEED = 150;
export const PLAYER_BASE_THRUST = 50; // base upward thrust against gravity
export const PLAYER_START_SIZE = 16;

// Resources
export const STARTING_MASS = 0;
export const STARTING_ENERGY = 50;
export const STARTING_BATTERY_CAPACITY = 100;
export const ENERGY_PER_MANUAL_CLICK = 5;
export const ENERGY_FROM_DESTROY_BASE = 3;
export const MASS_FROM_DESTROY_MULTIPLIER = 1.0;

// Upgrades
export const UPGRADE_COST_SCALING = 1.5;

// Visual
export const COLORS = {
  station: 0x6c63ff,
  stationGlow: 0x8b83ff,
  beam: 0xff6b6b,
  energy: 0xffd93d,
  mass: 0x4ecdc4,
  dangerRed: 0xff4444,
  dangerYellow: 0xffaa44,
  dangerGreen: 0x44ff44,
  background: 0x0a0a1a,
  starfield: 0xffffff,
} as const;

// Game
export const WORLD_WIDTH = 400_000;
export const WORLD_HEIGHT = 400_000;

// Convenience aliases for world center
export const WORLD_CENTER_X = WORLD_WIDTH / 2;
export const WORLD_CENTER_Y = WORLD_HEIGHT / 2;

// Solar system distances from world center (proportionally compressed)
export const SOLAR_DISTANCES = {
  mercury:       12_000,
  venus:         22_000,
  earth:              0,
  mars:          30_000,
  asteroidBelt: [48_000, 72_000] as [number, number],
  jupiter:       95_000,
  saturn:       140_000,
  uranus:       175_000,
  neptune:      200_000,
  sun:          240_000,
} as const;

export const GRAVITY_SCALE = 0.08;
