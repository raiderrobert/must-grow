import Phaser from "phaser";
import { drawCards, type UpgradeCard } from "@/data/upgrades";
import type { CombatSystem } from "@/systems/CombatSystem";
import type { ResourceManager } from "@/systems/ResourceManager";
import type { PlayerStation } from "@/entities/PlayerStation";
import type { AudioManager } from "@/systems/AudioManager";

const RARITY_COLORS: Record<string, string> = {
  common: "#4ecdc4",
  uncommon: "#6c63ff",
  rare: "#ffd93d",
};

export class UpgradeScreen {
  private scene: Phaser.Scene;
  private combat: CombatSystem;
  private resources: ResourceManager;
  private player: PlayerStation;
  private audio: AudioManager | null;
  private container: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private onClose?: () => void;
  private mainCam: Phaser.Cameras.Scene2D.Camera | null = null;

  constructor(
    scene: Phaser.Scene,
    combat: CombatSystem,
    resources: ResourceManager,
    player: PlayerStation,
    audio: AudioManager | null = null
  ) {
    this.scene = scene;
    this.combat = combat;
    this.resources = resources;
    this.player = player;
    this.audio = audio;
  }

  /** Pass main camera so upgrade screen overlay is ignored by it (rendered only by uiCam). */
  setMainCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCam = cam;
  }

  /** Show the screen with 3 random cards. Calls onClose when a card is picked. */
  show(onClose: () => void): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.onClose = onClose;
    this.build(drawCards(3));
  }

  private build(cards: UpgradeCard[]): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Dark overlay
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(500);
    objects.push(overlay);

    // Title
    objects.push(
      this.scene.add.text(width / 2, height * 0.12, "CHOOSE AN UPGRADE", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Subtitle
    objects.push(
      this.scene.add.text(width / 2, height * 0.12 + 40, "Press 1 · 2 · 3  or  click a card", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Cards
    const cardW = Math.min(260, (width - 120) / 3);
    const cardH = 220;
    const spacing = cardW + 30;
    const startX = width / 2 - spacing;

    const keyObjects: Phaser.Input.Keyboard.Key[] = [];
    const keyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
    ];

    for (let i = 0; i < cards.length; i++) {
      const cx = startX + i * spacing;
      const cy = height * 0.5;
      const cardObjs = this.buildCard(cards[i], cx, cy, cardW, cardH, i + 1);
      objects.push(...cardObjs);

      const key = this.scene.input.keyboard!.addKey(keyCodes[i]);
      keyObjects.push(key);
      const cardIndex = i;
      key.once("down", () => {
        if (this.isVisible) this.pick(cards[cardIndex], keyObjects);
      });
    }

    this.container = this.scene.add.container(0, 0, objects);
    this.container.setDepth(500);

    // Main camera should not render this at variable zoom — uiCam handles it
    if (this.mainCam) {
      this.mainCam.ignore(this.container);
    }
  }

  private buildCard(
    card: UpgradeCard,
    cx: number,
    cy: number,
    w: number,
    h: number,
    keyNumber: number
  ): Phaser.GameObjects.GameObject[] {
    const color = RARITY_COLORS[card.rarity] ?? "#ccc";
    const colorHex = parseInt(color.replace("#", ""), 16);
    const objects: Phaser.GameObjects.GameObject[] = [];

    const bg = this.scene.add
      .rectangle(cx, cy, w, h, 0x111133, 1)
      .setStrokeStyle(2, colorHex, 0.9)
      .setScrollFactor(0)
      .setDepth(501)
      .setInteractive({ useHandCursor: true });
    objects.push(bg);

    bg.on("pointerover", () => bg.setFillStyle(0x222255));
    bg.on("pointerout", () => bg.setFillStyle(0x111133));
    bg.on("pointerdown", () => this.pick(card, []));

    objects.push(
      this.scene.add.text(cx, cy - h / 2 + 20, `[${keyNumber}]`, {
        fontFamily: "monospace", fontSize: "18px", color: "#fff",
      }).setOrigin(0.5).setAlpha(0.5).setScrollFactor(0).setDepth(502)
    );

    objects.push(
      this.scene.add.text(cx, cy - h / 2 + 44, card.rarity.toUpperCase(), {
        fontFamily: "monospace", fontSize: "11px", color,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    objects.push(
      this.scene.add.text(cx, cy - 10, card.name, {
        fontFamily: "monospace", fontSize: "17px", color: "#fff",
        wordWrap: { width: w - 20 }, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    objects.push(
      this.scene.add.text(cx, cy + 40, card.description, {
        fontFamily: "monospace", fontSize: "13px", color: "#bbb",
        wordWrap: { width: w - 24 }, align: "center",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(502)
    );

    return objects;
  }

  private pick(card: UpgradeCard, keys: Phaser.Input.Keyboard.Key[]): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    for (const key of keys) key.removeAllListeners();

    card.apply(this.combat, this.resources, this.player);
    this.audio?.play("sfx_upgrade");

    this.container?.destroy();
    this.container = null;

    this.onClose?.();
  }
}
