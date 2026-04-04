import Phaser from "phaser";
import { WORLD_CENTER_X, WORLD_CENTER_Y } from "@/constants";
import { SpaceObject, type SpaceObjectConfig } from "@/entities/SpaceObject";

export interface PlanetDef {
  name: string;
  distance: number;
  angle: number;          // radians from center
  visualRadius: number;   // display radius in world pixels
  color: number;
  atmosphereColor: number;
  config: Omit<SpaceObjectConfig, "x" | "y" | "size" | "color" | "name">;
}

export const PLANET_DEFS: PlanetDef[] = [
  {
    name: "Mercury", distance: 12_000, angle: 0.8,
    visualRadius: 400, color: 0x9b8b78, atmosphereColor: 0x7a6b5c,
    config: { health: 2_000, massYield: 800, energyYield: 200, gravityMass: 800, biteRadius: 440 },
  },
  {
    name: "Venus", distance: 22_000, angle: 2.1,
    visualRadius: 900, color: 0xe8b84b, atmosphereColor: 0xd4983a,
    config: { health: 5_000, massYield: 2_000, energyYield: 500, gravityMass: 2_000, biteRadius: 990 },
  },
  {
    name: "Mars", distance: 30_000, angle: 3.9,
    visualRadius: 700, color: 0xc1440e, atmosphereColor: 0xa03308,
    config: { health: 3_000, massYield: 1_200, energyYield: 300, gravityMass: 1_200, biteRadius: 770 },
  },
  {
    name: "Jupiter", distance: 95_000, angle: 1.2,
    visualRadius: 8_000, color: 0xc88b3a, atmosphereColor: 0xaa7230,
    config: { health: 50_000, massYield: 20_000, energyYield: 5_000, gravityMass: 20_000, biteRadius: 8_800 },
  },
  {
    name: "Saturn", distance: 140_000, angle: 4.5,
    visualRadius: 6_500, color: 0xe4d090, atmosphereColor: 0xc8b86a,
    config: { health: 40_000, massYield: 16_000, energyYield: 4_000, gravityMass: 16_000, biteRadius: 7_150 },
  },
  {
    name: "Uranus", distance: 175_000, angle: 0.3,
    visualRadius: 3_500, color: 0x7de8e8, atmosphereColor: 0x5cc8c8,
    config: { health: 25_000, massYield: 10_000, energyYield: 2_500, gravityMass: 10_000, biteRadius: 3_850 },
  },
  {
    name: "Neptune", distance: 200_000, angle: 2.8,
    visualRadius: 3_200, color: 0x3f54ba, atmosphereColor: 0x2d3d9a,
    config: { health: 22_000, massYield: 9_000, energyYield: 2_200, gravityMass: 9_000, biteRadius: 3_520 },
  },
];

export function createPlanet(scene: Phaser.Scene, def: PlanetDef): SpaceObject {
  const x = WORLD_CENTER_X + Math.cos(def.angle) * def.distance;
  const y = WORLD_CENTER_Y + Math.sin(def.angle) * def.distance;

  const r = def.visualRadius;
  const texKey = `planet_${def.name}`;

  if (!scene.textures.exists(texKey)) {
    const g = scene.add.graphics();
    // Atmosphere glow
    g.fillStyle(def.atmosphereColor, 0.2);
    g.fillCircle(r + 20, r + 20, r + 20);
    // Body
    g.fillStyle(def.color, 1.0);
    g.fillCircle(r + 20, r + 20, r);
    // Highlight
    g.fillStyle(0xffffff, 0.08);
    g.fillCircle(r + 20 - r * 0.3, r + 20 - r * 0.3, r * 0.5);
    // Outline
    g.lineStyle(Math.max(2, r * 0.01), 0xffffff, 0.15);
    g.strokeCircle(r + 20, r + 20, r);
    g.generateTexture(texKey, (r + 20) * 2, (r + 20) * 2);
    g.destroy();
  }

  const spaceObj = new SpaceObject(scene, {
    x, y,
    size: r,
    color: def.color,
    name: def.name,
    ...def.config,
  });

  // Override with detailed texture
  spaceObj.sprite.setTexture(texKey);
  spaceObj.sprite.setDisplaySize(r * 2, r * 2);

  // Label
  const labelSize = Math.max(24, r * 0.08);
  scene.add.text(x, y + r + labelSize * 2, def.name, {
    fontFamily: "monospace",
    fontSize: `${labelSize}px`,
    color: "#" + def.color.toString(16).padStart(6, "0"),
  }).setOrigin(0.5).setDepth(1).setAlpha(0.8);

  // Saturn rings
  if (def.name === "Saturn") {
    const rings = scene.add.graphics().setDepth(0);
    rings.lineStyle(r * 0.08, def.atmosphereColor, 0.5);
    rings.strokeEllipse(x, y, r * 3.2, r * 0.5);
    rings.lineStyle(r * 0.04, def.color, 0.3);
    rings.strokeEllipse(x, y, r * 2.8, r * 0.4);
  }

  spaceObj.sprite.setVelocity(0, 0);

  return spaceObj;
}
