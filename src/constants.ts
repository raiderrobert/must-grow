// Physics
export const GRAVITY_CONSTANT = 800;
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

// Tiers
export const TIER_THRESHOLDS = [0, 100, 500, 2000, 10000, 50000] as const;
export const TIER_NAMES = [
  "Satellite",
  "Space Station",
  "Mega Station",
  "Planet Eater",
  "Star Killer",
] as const;

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
export const WORLD_WIDTH = 8000;
export const WORLD_HEIGHT = 8000;
