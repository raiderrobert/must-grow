import Phaser from "phaser";
import { drawCards, type UpgradeCard } from "@/data/upgrades";
import type { CombatSystem } from "@/systems/CombatSystem";
import type { ResourceManager } from "@/systems/ResourceManager";
import type { PlayerStation } from "@/entities/PlayerStation";
import type { AudioManager } from "@/systems/AudioManager";
import type { InputManager } from "@/systems/InputManager";

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
  private inputManager: InputManager | null;
  private container: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private onClose?: () => void;
  private mainCam: Phaser.Cameras.Scene2D.Camera | null = null;

  // Selection state
  private selectedIndex: number = 0;
  private cardBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private currentCards: UpgradeCard[] = [];
  private keyObjects: Phaser.Input.Keyboard.Key[] = [];
  private gamepadPollTimer?: Phaser.Time.TimerEvent;
  private stickCooldown: number = 0;
  private inputReady: boolean = false;

  constructor(
    scene: Phaser.Scene,
    combat: CombatSystem,
    resources: ResourceManager,
    player: PlayerStation,
    audio: AudioManager | null = null,
    inputManager: InputManager | null = null
  ) {
    this.scene = scene;
    this.combat = combat;
    this.resources = resources;
    this.player = player;
    this.audio = audio;
    this.inputManager = inputManager;
  }

  setMainCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCam = cam;
  }

  show(onClose: () => void, currentAct: number = 5): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.onClose = onClose;
    this.build(drawCards(3, currentAct));
  }

  private build(cards: UpgradeCard[]): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];
    this.currentCards = cards;
    this.selectedIndex = 0;
    this.cardBackgrounds = [];
    this.keyObjects = [];
    this.stickCooldown = 0;

    // Dark overlay
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(500);
    objects.push(overlay);

    // Title
    objects.push(
      this.scene.add.text(width / 2, height * 0.12, "CHOOSE AN UPGRADE", {
        fontFamily: "monospace", fontSize: "28px", color: "#ffffff",
        stroke: "#000", strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Subtitle — adapts to input type
    const isGamepad = this.inputManager?.isGamepad ?? false;
    const subtitleText = isGamepad
      ? "D-pad/stick select  ·  A confirm"
      : "Press 1 · 2 · 3  or  click a card";
    objects.push(
      this.scene.add.text(width / 2, height * 0.12 + 40, subtitleText, {
        fontFamily: "monospace", fontSize: "14px", color: "#888",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(501)
    );

    // Cards
    const cardW = Math.min(260, (width - 120) / 3);
    const cardH = 220;
    const spacing = cardW + 30;
    const startX = width / 2 - spacing;

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
      this.keyObjects.push(key);
      const cardIndex = i;
      key.once("down", () => {
        if (this.isVisible && this.inputReady) this.pick(cards[cardIndex]);
      });
    }

    this.container = this.scene.add.container(0, 0, objects);
    this.container.setDepth(500);
    if (this.mainCam) this.mainCam.ignore(this.container);

    // Guard: dim everything, ignore input for 800ms
    this.inputReady = false;
    this.container.setAlpha(0.4);
    this.scene.time.delayedCall(800, () => {
      if (!this.isVisible) return;
      this.inputReady = true;
      this.container?.setAlpha(1.0);
      this.updateHighlight();
    });

    // Poll gamepad at ~60fps
    this.gamepadPollTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.pollGamepad(),
    });
  }

  private buildCard(
    card: UpgradeCard,
    cx: number, cy: number,
    w: number, h: number,
    keyNumber: number
  ): Phaser.GameObjects.GameObject[] {
    const color = RARITY_COLORS[card.rarity] ?? "#ccc";
    const colorHex = parseInt(color.replace("#", ""), 16);
    const objects: Phaser.GameObjects.GameObject[] = [];

    const bg = this.scene.add
      .rectangle(cx, cy, w, h, 0x111133, 1)
      .setStrokeStyle(2, colorHex, 0.9)
      .setScrollFactor(0).setDepth(501)
      .setInteractive({ useHandCursor: true });
    objects.push(bg);
    this.cardBackgrounds.push(bg); // tracked for highlight

    bg.on("pointerover", () => { if (bg.fillColor !== 0x222255) bg.setFillStyle(0x1a1a44); });
    bg.on("pointerout", () => { if (this.cardBackgrounds.indexOf(bg) !== this.selectedIndex) bg.setFillStyle(0x111133); });
    bg.on("pointerdown", () => { if (this.inputReady) this.pick(card); });

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

  private updateHighlight(): void {
    for (let i = 0; i < this.cardBackgrounds.length; i++) {
      const bg = this.cardBackgrounds[i];
      if (i === this.selectedIndex) {
        bg.setFillStyle(0x222255);
        bg.setStrokeStyle(3, 0xffffff, 1.0);
      } else {
        bg.setFillStyle(0x111133);
        const color = RARITY_COLORS[this.currentCards[i].rarity] ?? "#ccc";
        bg.setStrokeStyle(2, parseInt(color.replace("#", ""), 16), 0.9);
      }
    }
  }

  private pollGamepad(): void {
    if (!this.isVisible || !this.inputManager || !this.inputReady) return;

    this.stickCooldown = Math.max(0, this.stickCooldown - 16);

    const mx = this.inputManager.moveX;
    if (this.stickCooldown <= 0 && Math.abs(mx) > 0.5) {
      if (mx > 0 && this.selectedIndex < this.currentCards.length - 1) {
        this.selectedIndex++;
        this.updateHighlight();
        this.stickCooldown = 200;
      } else if (mx < 0 && this.selectedIndex > 0) {
        this.selectedIndex--;
        this.updateHighlight();
        this.stickCooldown = 200;
      }
    }

    // A button confirms selection
    const pad = this.inputManager.gamepad;
    if (pad?.buttons[0]?.pressed) {
      this.pick(this.currentCards[this.selectedIndex]);
    }
  }

  forceClose(): void {
    this.isVisible = false;
    this.inputReady = false;
    this.onClose = undefined;
    for (const key of this.keyObjects) key.removeAllListeners();
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.cardBackgrounds = [];
    this.currentCards = [];
    this.keyObjects = [];
    if (this.container) {
      this.container.destroy(true); // true = destroy children too
      this.container = null;
    }
  }

  private pick(card: UpgradeCard): void {
    if (!this.isVisible) return;
    this.isVisible = false;

    for (const key of this.keyObjects) key.removeAllListeners();
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.cardBackgrounds = [];
    this.currentCards = [];
    this.keyObjects = [];

    card.apply(this.combat, this.resources, this.player);
    this.audio?.play("sfx_upgrade");

    this.container?.destroy();
    this.container = null;

    this.onClose?.();
  }
}
