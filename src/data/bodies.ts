import type { VisualPrimitive } from "@/entities/BodyRenderer";

export interface BodyDef {
  name: string;
  distance: number;
  angle: number;
  visualRadius: number;
  killRadius: number;
  color: number;
  gravityMass: number;
  health: number;
  massYield: number;
  energyYield: number;
  visual: VisualPrimitive[];
  orbitParent: string | null; // body this orbits, null = fixed (Sun)
}

export const BODY_DEFS: BodyDef[] = [
  // ── Sun ───────────────────────────────────────────────────────────
  {
    name: "Sun",
    distance: 0, angle: 0,
    visualRadius: 25_000, killRadius: 25_000,
    color: 0xffdd00, gravityMass: 50_000,
    health: 500_000, massYield: 200_000, energyYield: 50_000,
    visual: [
      { type: "corona", layers: [
        { radiusMult: 2.6, alpha: 0.016, color: 0xffaa00 },
        { radiusMult: 2.3, alpha: 0.024, color: 0xffaa00 },
        { radiusMult: 2.0, alpha: 0.032, color: 0xffaa00 },
        { radiusMult: 1.7, alpha: 0.040, color: 0xffaa00 },
      ]},
      { type: "solidBody", color: 0xffdd00, alpha: 1.0 },
      { type: "brightCore", radiusMult: 0.5, alpha: 0.4 },
    ],
    orbitParent: null,
  },

  // ── Earth ─────────────────────────────────────────────────────────
  {
    name: "Earth",
    distance: 35_000, angle: Math.PI / 2,
    visualRadius: 3_000, killRadius: 3_000,
    color: 0x1a4a8a, gravityMass: 500,
    health: 100_000, massYield: 50_000, energyYield: 10_000,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.20, color: 0x1a3a5c, alpha: 0.15 },
        { radiusMult: 1.07, color: 0x2255aa, alpha: 0.25 },
      ]},
      { type: "solidBody", color: 0x1a4a8a, alpha: 0.95 },
      { type: "landmasses", patches: [
        { x: -0.17, y: -0.13, w: 0.40, h: 0.30, color: 0x2d6e2d, alpha: 0.85 },
        { x:  0.23, y:  0.10, w: 0.30, h: 0.37, color: 0x2d6e2d, alpha: 0.85 },
        { x: -0.07, y:  0.23, w: 0.27, h: 0.17, color: 0x2d6e2d, alpha: 0.85 },
        { x:  0.10, y: -0.27, w: 0.20, h: 0.13, color: 0x2d6e2d, alpha: 0.85 },
      ]},
      { type: "highlight", offsetX: 0, offsetY: 0, radiusMult: 1.0, alpha: 0.08 },
      { type: "outline", thicknessMult: 0.01, color: 0x4488cc, alpha: 0.3 },
    ],
    orbitParent: "Sun",
  },

  // ── Mercury ───────────────────────────────────────────────────────
  {
    name: "Mercury",
    distance: 12_000, angle: 0.8,
    visualRadius: 400, killRadius: 400,
    color: 0x9b8b78, gravityMass: 800,
    health: 2_000, massYield: 800, energyYield: 200,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0x7a6b5c, alpha: 0.15 }]},
      { type: "solidBody", color: 0x9b8b78, alpha: 1.0 },
      { type: "spots", patches: [
        { x: -0.2, y: -0.1, r: 0.12, color: 0x7a6b5c, alpha: 0.4 },
        { x:  0.3, y:  0.2, r: 0.08, color: 0x6a5b4c, alpha: 0.35 },
        { x:  0.0, y:  0.3, r: 0.10, color: 0x8a7b6c, alpha: 0.3 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Venus ─────────────────────────────────────────────────────────
  {
    name: "Venus",
    distance: 22_000, angle: 2.1,
    visualRadius: 900, killRadius: 900,
    color: 0xe8b84b, gravityMass: 2_000,
    health: 5_000, massYield: 2_000, energyYield: 500,
    visual: [
      { type: "atmosphereGlow", layers: [
        { radiusMult: 1.25, color: 0xd4983a, alpha: 0.20 },
        { radiusMult: 1.12, color: 0xe8c84b, alpha: 0.15 },
      ]},
      { type: "solidBody", color: 0xe8b84b, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.3, height: 0.15, color: 0xd4983a, alpha: 0.25 },
        { yOffset:  0.1, height: 0.20, color: 0xc8882a, alpha: 0.20 },
        { yOffset:  0.4, height: 0.12, color: 0xd4983a, alpha: 0.15 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Mars ──────────────────────────────────────────────────────────
  {
    name: "Mars",
    distance: 30_000, angle: 3.9,
    visualRadius: 700, killRadius: 700,
    color: 0xc1440e, gravityMass: 1_200,
    health: 3_000, massYield: 1_200, energyYield: 300,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0xa03308, alpha: 0.15 }]},
      { type: "solidBody", color: 0xc1440e, alpha: 1.0 },
      { type: "iceCap", position: "north", sizeMult: 0.4, color: 0xffffff, alpha: 0.6 },
      { type: "iceCap", position: "south", sizeMult: 0.3, color: 0xeeeeff, alpha: 0.5 },
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Jupiter ───────────────────────────────────────────────────────
  {
    name: "Jupiter",
    distance: 95_000, angle: 1.2,
    visualRadius: 8_000, killRadius: 8_000,
    color: 0xc88b3a, gravityMass: 20_000,
    health: 50_000, massYield: 20_000, energyYield: 5_000,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0xaa7230, alpha: 0.15 }]},
      { type: "solidBody", color: 0xc88b3a, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.6, height: 0.10, color: 0xb07830, alpha: 0.3 },
        { yOffset: -0.3, height: 0.15, color: 0xd4a050, alpha: 0.25 },
        { yOffset:  0.0, height: 0.12, color: 0xb07830, alpha: 0.3 },
        { yOffset:  0.3, height: 0.18, color: 0xd4a050, alpha: 0.25 },
        { yOffset:  0.6, height: 0.10, color: 0xb07830, alpha: 0.3 },
      ]},
      { type: "spots", patches: [
        { x: 0.3, y: 0.2, r: 0.10, color: 0xcc4422, alpha: 0.6 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Saturn ────────────────────────────────────────────────────────
  {
    name: "Saturn",
    distance: 140_000, angle: 4.5,
    visualRadius: 6_500, killRadius: 6_500,
    color: 0xe4d090, gravityMass: 16_000,
    health: 40_000, massYield: 16_000, energyYield: 4_000,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0xc8b86a, alpha: 0.15 }]},
      { type: "solidBody", color: 0xe4d090, alpha: 1.0 },
      { type: "surfaceBands", bands: [
        { yOffset: -0.4, height: 0.12, color: 0xc8b86a, alpha: 0.2 },
        { yOffset:  0.1, height: 0.15, color: 0xd4c480, alpha: 0.15 },
        { yOffset:  0.5, height: 0.10, color: 0xc8b86a, alpha: 0.2 },
      ]},
      { type: "rings", layers: [
        { widthMult: 0.07, radiusMult: 3.2, heightMult: 0.45, color: 0xc8b86a, alpha: 0.45 },
        { widthMult: 0.035, radiusMult: 2.8, heightMult: 0.38, color: 0xe4d090, alpha: 0.25 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Uranus ────────────────────────────────────────────────────────
  {
    name: "Uranus",
    distance: 175_000, angle: 0.3,
    visualRadius: 3_500, killRadius: 3_500,
    color: 0x7de8e8, gravityMass: 10_000,
    health: 25_000, massYield: 10_000, energyYield: 2_500,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0x5cc8c8, alpha: 0.15 }]},
      { type: "solidBody", color: 0x7de8e8, alpha: 1.0 },
      { type: "rings", layers: [
        { widthMult: 0.02, radiusMult: 2.0, heightMult: 1.8, color: 0x5cc8c8, alpha: 0.2 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },

  // ── Neptune ───────────────────────────────────────────────────────
  {
    name: "Neptune",
    distance: 200_000, angle: 2.8,
    visualRadius: 3_200, killRadius: 3_200,
    color: 0x3f54ba, gravityMass: 9_000,
    health: 22_000, massYield: 9_000, energyYield: 2_200,
    visual: [
      { type: "atmosphereGlow", layers: [{ radiusMult: 1.15, color: 0x2d3d9a, alpha: 0.15 }]},
      { type: "solidBody", color: 0x3f54ba, alpha: 1.0 },
      { type: "spots", patches: [
        { x: -0.2, y: -0.1, r: 0.12, color: 0x1a2a6a, alpha: 0.5 },
        { x:  0.3, y:  0.3, r: 0.06, color: 0x2a3a8a, alpha: 0.4 },
      ]},
      { type: "highlight", offsetX: -0.3, offsetY: -0.3, radiusMult: 0.5, alpha: 0.07 },
      { type: "outline", thicknessMult: 0.008, color: 0xffffff, alpha: 0.12 },
    ],
    orbitParent: "Sun",
  },
];
