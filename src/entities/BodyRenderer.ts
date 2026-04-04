import Phaser from "phaser";
import { DEBUG_KILL_ZONES } from "@/constants";

// ── Visual Primitive Types ──────────────────────────────────────────

export type VisualPrimitive =
  | { type: "atmosphereGlow"; layers: { radiusMult: number; color: number; alpha: number }[] }
  | { type: "solidBody"; color: number; alpha: number }
  | { type: "highlight"; offsetX: number; offsetY: number; radiusMult: number; alpha: number }
  | { type: "outline"; thicknessMult: number; color: number; alpha: number }
  | { type: "landmasses"; patches: { x: number; y: number; w: number; h: number; color: number; alpha: number }[] }
  | { type: "corona"; layers: { radiusMult: number; alpha: number; color: number }[] }
  | { type: "brightCore"; radiusMult: number; alpha: number }
  | { type: "rings"; layers: { widthMult: number; radiusMult: number; heightMult: number; color: number; alpha: number }[] }
  | { type: "surfaceBands"; bands: { yOffset: number; height: number; color: number; alpha: number }[] }
  | { type: "iceCap"; position: "north" | "south"; sizeMult: number; color: number; alpha: number }
  | { type: "spots"; patches: { x: number; y: number; r: number; color: number; alpha: number }[] };

// ── Primitive Renderers ─────────────────────────────────────────────

function drawAtmosphereGlow(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { radiusMult: number; color: number; alpha: number }[]): void {
  for (const layer of layers) { g.fillStyle(layer.color, layer.alpha); g.fillCircle(x, y, r * layer.radiusMult); }
}

function drawSolidBody(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  color: number, alpha: number): void {
  g.fillStyle(color, alpha); g.fillCircle(x, y, r);
}

function drawHighlight(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  offsetX: number, offsetY: number, radiusMult: number, alpha: number): void {
  g.fillStyle(0xffffff, alpha); g.fillCircle(x + r * offsetX, y + r * offsetY, r * radiusMult);
}

function drawOutline(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  thicknessMult: number, color: number, alpha: number): void {
  g.lineStyle(Math.max(2, r * thicknessMult), color, alpha); g.strokeCircle(x, y, r);
}

function drawLandmasses(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  patches: { x: number; y: number; w: number; h: number; color: number; alpha: number }[]): void {
  for (const p of patches) { g.fillStyle(p.color, p.alpha); g.fillEllipse(x + p.x * r, y + p.y * r, p.w * r, p.h * r); }
}

function drawCorona(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { radiusMult: number; alpha: number; color: number }[]): void {
  for (const layer of layers) { g.fillStyle(layer.color, layer.alpha); g.fillCircle(x, y, r * layer.radiusMult); }
}

function drawBrightCore(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  radiusMult: number, alpha: number): void {
  g.fillStyle(0xffffff, alpha); g.fillCircle(x, y, r * radiusMult);
}

function drawRings(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  layers: { widthMult: number; radiusMult: number; heightMult: number; color: number; alpha: number }[]): void {
  for (const ring of layers) {
    g.lineStyle(r * ring.widthMult, ring.color, ring.alpha);
    g.strokeEllipse(x, y, r * ring.radiusMult, r * ring.heightMult);
  }
}

function drawSurfaceBands(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  bands: { yOffset: number; height: number; color: number; alpha: number }[]): void {
  for (const band of bands) { g.fillStyle(band.color, band.alpha); g.fillEllipse(x, y + band.yOffset * r, r * 2, band.height * r); }
}

function drawIceCap(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  position: "north" | "south", sizeMult: number, color: number, alpha: number): void {
  const capY = position === "north" ? y - r * 0.85 : y + r * 0.85;
  g.fillStyle(color, alpha); g.fillEllipse(x, capY, r * sizeMult, r * sizeMult * 0.3);
}

function drawSpots(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  patches: { x: number; y: number; r: number; color: number; alpha: number }[]): void {
  for (const s of patches) { g.fillStyle(s.color, s.alpha); g.fillCircle(x + s.x * r, y + s.y * r, s.r * r); }
}

// ── Compositor ──────────────────────────────────────────────────────

export interface RenderedBody {
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  debugRing?: Phaser.GameObjects.Graphics;
}

export function renderBody(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  killRadius: number,
  name: string,
  color: number,
  visual: VisualPrimitive[],
  depth: number = 0
): RenderedBody {
  const g = scene.add.graphics().setDepth(depth);

  for (const prim of visual) {
    switch (prim.type) {
      case "atmosphereGlow": drawAtmosphereGlow(g, x, y, radius, prim.layers); break;
      case "solidBody":      drawSolidBody(g, x, y, radius, prim.color, prim.alpha); break;
      case "highlight":      drawHighlight(g, x, y, radius, prim.offsetX, prim.offsetY, prim.radiusMult, prim.alpha); break;
      case "outline":        drawOutline(g, x, y, radius, prim.thicknessMult, prim.color, prim.alpha); break;
      case "landmasses":     drawLandmasses(g, x, y, radius, prim.patches); break;
      case "corona":         drawCorona(g, x, y, radius, prim.layers); break;
      case "brightCore":     drawBrightCore(g, x, y, radius, prim.radiusMult, prim.alpha); break;
      case "rings":          drawRings(g, x, y, radius, prim.layers); break;
      case "surfaceBands":   drawSurfaceBands(g, x, y, radius, prim.bands); break;
      case "iceCap":         drawIceCap(g, x, y, radius, prim.position, prim.sizeMult, prim.color, prim.alpha); break;
      case "spots":          drawSpots(g, x, y, radius, prim.patches); break;
    }
  }

  const fontSize = Math.max(24, Math.min(radius * 0.12, 400));
  const label = scene.add
    .text(x, y + radius + fontSize * 1.5, name, {
      fontFamily: "monospace",
      fontSize: `${Math.round(fontSize)}px`,
      color: "#" + color.toString(16).padStart(6, "0"),
    })
    .setOrigin(0.5)
    .setDepth(depth + 1)
    .setAlpha(0.85);

  let debugRing: Phaser.GameObjects.Graphics | undefined;
  if (DEBUG_KILL_ZONES) {
    debugRing = scene.add.graphics().setDepth(10);
    debugRing.lineStyle(8, 0xff0000, 1.0);
    debugRing.strokeCircle(x, y, killRadius);
  }

  return { graphics: g, label, debugRing };
}
