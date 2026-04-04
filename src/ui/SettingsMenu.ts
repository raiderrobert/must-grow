import Phaser from "phaser";

export interface CheatCallbacks {
  setTier: (tier: number) => void;
  toggleGodMode: () => boolean;         // returns new state
  toggleInfiniteEnergy: () => boolean;  // returns new state
  teleportToPlanet: (name: string) => void;
  killAllDebris: () => void;
  setSpeedMultiplier: (mult: number) => void;
  spawnDebrisHere: () => void;
  destroyPlanet: (name: string) => void;
  getPlanetNames: () => string[];        // returns names of surviving planets
}

export class SettingsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private cheats: CheatCallbacks;
  private mainCam: Phaser.Cameras.Scene2D.Camera | null = null;

  // Cheat state
  private godMode: boolean = false;
  private infiniteEnergy: boolean = false;
  private currentSpeedMult: number = 1;

  constructor(scene: Phaser.Scene, cheats: CheatCallbacks) {
    this.scene = scene;
    this.cheats = cheats;
  }

  setMainCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCam = cam;
  }

  get visible(): boolean { return this.isVisible; }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.build();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.container?.destroy();
    this.container = null;
  }

  private build(): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // Dark overlay
    const overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setScrollFactor(0)
      .setDepth(700)
      .setInteractive(); // block clicks through to game
    objects.push(overlay);

    // Panel background
    const panelW = 400;
    const panelH = 500;
    const panelX = width / 2;
    const panelY = height / 2;
    objects.push(
      this.scene.add
        .rectangle(panelX, panelY, panelW, panelH, 0x111133, 0.95)
        .setStrokeStyle(2, 0x6c63ff, 0.6)
        .setScrollFactor(0)
        .setDepth(701)
    );

    // Title
    objects.push(
      this.scene.add.text(panelX, panelY - panelH / 2 + 20, "SETTINGS", {
        fontFamily: "monospace", fontSize: "22px", color: "#fff",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(702)
    );

    // Resume button
    objects.push(this.makeButton(panelX, panelY - panelH / 2 + 60, "Resume [ESC]", () => this.hide()));

    // ── Cheats section ──
    objects.push(
      this.scene.add.text(panelX, panelY - panelH / 2 + 100, "── CHEATS ──", {
        fontFamily: "monospace", fontSize: "12px", color: "#ffd93d",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(702)
    );

    let y = panelY - panelH / 2 + 130;
    const spacing = 32;

    // Set Tier
    for (let t = 1; t <= 5; t++) {
      objects.push(this.makeButton(
        panelX - 100 + (t - 1) * 50, y, `T${t}`,
        () => { this.cheats.setTier(t); this.rebuild(); }
      ));
    }
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Set Tier:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    y += spacing;

    // God Mode toggle
    objects.push(this.makeButton(panelX, y,
      `God Mode: ${this.godMode ? "ON" : "OFF"}`,
      () => { this.godMode = this.cheats.toggleGodMode(); this.rebuild(); }
    ));
    y += spacing;

    // Infinite Energy toggle
    objects.push(this.makeButton(panelX, y,
      `Infinite Energy: ${this.infiniteEnergy ? "ON" : "OFF"}`,
      () => { this.infiniteEnergy = this.cheats.toggleInfiniteEnergy(); this.rebuild(); }
    ));
    y += spacing;

    // Teleport to planet
    const planets = this.cheats.getPlanetNames();
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Teleport:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    const teleportPerRow = 3;
    for (let i = 0; i < planets.length; i++) {
      const col = i % teleportPerRow;
      const row = Math.floor(i / teleportPerRow);
      objects.push(this.makeButton(
        panelX - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.teleportToPlanet(planets[i]); this.hide(); },
        "10px"
      ));
    }
    y += Math.ceil(planets.length / teleportPerRow) * 24 + 10;

    // Kill all debris
    objects.push(this.makeButton(panelX, y, "Kill All Debris", () => {
      this.cheats.killAllDebris();
    }));
    y += spacing;

    // Speed multiplier
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Game Speed:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (const mult of [1, 2, 5, 10]) {
      objects.push(this.makeButton(
        panelX - 80 + [1, 2, 5, 10].indexOf(mult) * 55, y,
        `${mult}x${mult === this.currentSpeedMult ? " ●" : ""}`,
        () => { this.currentSpeedMult = mult; this.cheats.setSpeedMultiplier(mult); this.rebuild(); },
        "10px"
      ));
    }
    y += spacing;

    // Spawn debris here
    objects.push(this.makeButton(panelX, y, "Spawn 100 Debris Here", () => {
      this.cheats.spawnDebrisHere();
    }));
    y += spacing;

    // Destroy planet
    objects.push(
      this.scene.add.text(panelX - 180, y + 4, "Destroy:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (let i = 0; i < planets.length; i++) {
      const col = i % teleportPerRow;
      const row = Math.floor(i / teleportPerRow);
      objects.push(this.makeButton(
        panelX - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.destroyPlanet(planets[i]); this.rebuild(); },
        "10px"
      ));
    }

    this.container = this.scene.add.container(0, 0, objects).setDepth(700);
    if (this.mainCam) {
      this.mainCam.ignore(this.container);
    }
  }

  private rebuild(): void {
    this.container?.destroy();
    this.container = null;
    this.build();
  }

  private makeButton(
    x: number, y: number, label: string,
    onClick: () => void, fontSize: string = "12px"
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize,
        color: "#4ecdc4",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(703)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#fff"));
    btn.on("pointerout", () => btn.setColor("#4ecdc4"));
    btn.on("pointerdown", onClick);

    return btn;
  }
}
