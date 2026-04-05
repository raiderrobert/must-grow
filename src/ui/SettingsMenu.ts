import Phaser from "phaser";
import type { AudioManager } from "@/systems/AudioManager";
import type { InputManager } from "@/systems/InputManager";

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

const SECTIONS = ["Controls", "Audio", "Cheats"] as const;
type Section = typeof SECTIONS[number];

export class SettingsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private cheats: CheatCallbacks;
  private audio: AudioManager;
  private inputManager: InputManager | null = null;
  private mainCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private onHide?: () => void;
  private currentSection: Section = "Controls";

  // Gamepad navigation
  private focusableButtons: { btn: Phaser.GameObjects.Text; action: () => void }[] = [];
  private focusIndex: number = 0;
  private stickCooldown: number = 0;
  private gamepadPollTimer?: Phaser.Time.TimerEvent;

  // Cheat state
  private godMode: boolean = false;
  private infiniteEnergy: boolean = false;
  private currentSpeedMult: number = 1;

  constructor(scene: Phaser.Scene, cheats: CheatCallbacks, audio: AudioManager) {
    this.scene = scene;
    this.cheats = cheats;
    this.audio = audio;
  }

  setMainCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.mainCam = cam;
  }

  setInputManager(input: InputManager): void {
    this.inputManager = input;
  }

  setOnHide(cb: () => void): void {
    this.onHide = cb;
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
    this.currentSection = "Controls";
    this.stickCooldown = 0;
    this.build();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.container?.destroy();
    this.container = null;
    this.focusableButtons = [];
    this.onHide?.();
  }

  // ── Build ────────────────────────────────────────────────────────

  private build(): void {
    const { width, height } = this.scene.scale;
    const objects: Phaser.GameObjects.GameObject[] = [];
    this.focusableButtons = [];
    this.focusIndex = 0;

    // Dark overlay
    objects.push(
      this.scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
        .setScrollFactor(0)
        .setDepth(700)
        .setInteractive()
    );

    const cx = width / 2;
    let y = 30;

    // Title + resume
    objects.push(
      this.scene.add.text(cx, y, "PAUSED", {
        fontFamily: "monospace", fontSize: "22px", color: "#fff",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(702)
    );
    y += 36;

    this.addFocusable(objects, cx, y, "Resume  [ESC]", () => this.hide());
    y += 40;

    // ── Tab bar ──
    const tabY = y;
    for (let i = 0; i < SECTIONS.length; i++) {
      const section = SECTIONS[i];
      const tabX = cx + (i - 1) * 120;
      const isActive = section === this.currentSection;

      const tab = this.scene.add.text(tabX, tabY, section, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: isActive ? "#fff" : "#555",
        backgroundColor: isActive ? "#2a2a4e" : "#111133",
        padding: { x: 12, y: 6 },
      })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(703)
        .setInteractive({ useHandCursor: true });

      tab.on("pointerdown", () => {
        this.currentSection = section;
        this.rebuild();
      });
      objects.push(tab);
    }
    y = tabY + 38;

    // Divider
    objects.push(
      this.scene.add
        .rectangle(cx, y, Math.min(400, width - 80), 1, 0x6c63ff, 0.4)
        .setScrollFactor(0).setDepth(702)
    );
    y += 16;

    // ── Section content ──
    switch (this.currentSection) {
      case "Controls": this.buildControls(objects, cx, y); break;
      case "Audio":    this.buildAudio(objects, cx, y); break;
      case "Cheats":   this.buildCheats(objects, cx, y, width, height); break;
    }

    this.container = this.scene.add.container(0, 0, objects).setDepth(700);
    if (this.mainCam) {
      this.mainCam.ignore(this.container);
    }

    this.updateFocus();
    this.startGamepadPoll();
  }

  // ── Controls ─────────────────────────────────────────────────────

  private buildControls(objects: Phaser.GameObjects.GameObject[], cx: number, y: number): void {
    const controls = [
      ["Move",        "WASD / Left Stick"],
      ["Burst Fire",  "SPACE / A"],
      ["Boost",       "SHIFT / RT"],
      ["Pause",       "ESC / Start"],
    ];

    for (const [action, keys] of controls) {
      objects.push(
        this.scene.add.text(cx - 160, y, action, {
          fontFamily: "monospace", fontSize: "14px", color: "#999",
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
      );
      objects.push(
        this.scene.add.text(cx + 160, y, keys, {
          fontFamily: "monospace", fontSize: "14px", color: "#4ecdc4",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(702)
      );
      y += 28;
    }
  }

  // ── Audio ────────────────────────────────────────────────────────

  private buildAudio(objects: Phaser.GameObjects.GameObject[], cx: number, y: number): void {
    this.addFocusable(objects, cx, y,
      `Sound: ${this.audio.isMuted ? "OFF" : "ON"}`,
      () => { this.audio.toggleMute(); this.rebuild(); }
    );
  }

  // ── Cheats ───────────────────────────────────────────────────────

  private buildCheats(objects: Phaser.GameObjects.GameObject[], cx: number, y: number, _width: number, _height: number): void {
    const spacing = 32;

    // Set Tier
    objects.push(
      this.scene.add.text(cx - 180, y + 4, "Set Tier:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (let t = 1; t <= 5; t++) {
      this.addFocusable(objects,
        cx - 100 + (t - 1) * 50, y, `T${t}`,
        () => { this.cheats.setTier(t); this.rebuild(); }
      );
    }
    y += spacing;

    // God Mode toggle
    this.addFocusable(objects, cx, y,
      `God Mode: ${this.godMode ? "ON" : "OFF"}`,
      () => { this.godMode = this.cheats.toggleGodMode(); this.rebuild(); }
    );
    y += spacing;

    // Infinite Energy toggle
    this.addFocusable(objects, cx, y,
      `Infinite Energy: ${this.infiniteEnergy ? "ON" : "OFF"}`,
      () => { this.infiniteEnergy = this.cheats.toggleInfiniteEnergy(); this.rebuild(); }
    );
    y += spacing;

    // Teleport to planet
    const planets = this.cheats.getPlanetNames();
    objects.push(
      this.scene.add.text(cx - 180, y + 4, "Teleport:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    const perRow = 3;
    for (let i = 0; i < planets.length; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      this.addFocusable(objects,
        cx - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.teleportToPlanet(planets[i]); this.hide(); },
        "10px"
      );
    }
    y += Math.ceil(planets.length / perRow) * 24 + 10;

    // Kill all debris
    this.addFocusable(objects, cx, y, "Kill All Debris", () => {
      this.cheats.killAllDebris();
    });
    y += spacing;

    // Speed multiplier
    objects.push(
      this.scene.add.text(cx - 180, y + 4, "Game Speed:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (const mult of [1, 2, 5, 10]) {
      this.addFocusable(objects,
        cx - 80 + [1, 2, 5, 10].indexOf(mult) * 55, y,
        `${mult}x${mult === this.currentSpeedMult ? " ●" : ""}`,
        () => { this.currentSpeedMult = mult; this.cheats.setSpeedMultiplier(mult); this.rebuild(); },
        "10px"
      );
    }
    y += spacing;

    // Spawn debris here
    this.addFocusable(objects, cx, y, "Spawn 100 Debris Here", () => {
      this.cheats.spawnDebrisHere();
    });
    y += spacing;

    // Destroy planet
    objects.push(
      this.scene.add.text(cx - 180, y + 4, "Destroy:", {
        fontFamily: "monospace", fontSize: "11px", color: "#aaa",
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(702)
    );
    for (let i = 0; i < planets.length; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      this.addFocusable(objects,
        cx - 80 + col * 90, y + row * 24, planets[i],
        () => { this.cheats.destroyPlanet(planets[i]); this.rebuild(); },
        "10px"
      );
    }
  }

  // ── Gamepad navigation ───────────────────────────────────────────

  private startGamepadPoll(): void {
    this.gamepadPollTimer?.remove();
    // Don't reset stickCooldown here — preserve it across rebuilds
    this.gamepadPollTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.pollGamepad(),
    });
  }

  private pollGamepad(): void {
    if (!this.isVisible || !this.inputManager) return;
    if (this.focusableButtons.length === 0) return;

    this.stickCooldown = Math.max(0, this.stickCooldown - 16);

    const my = this.inputManager.moveY;
    const mx = this.inputManager.moveX;

    // Up/down navigates focusable buttons
    if (this.stickCooldown <= 0 && Math.abs(my) > 0.5) {
      if (my > 0 && this.focusIndex < this.focusableButtons.length - 1) {
        this.focusIndex++;
        this.updateFocus();
        this.stickCooldown = 200;
      } else if (my < 0 && this.focusIndex > 0) {
        this.focusIndex--;
        this.updateFocus();
        this.stickCooldown = 200;
      }
    }

    // Left/right switches tabs
    if (this.stickCooldown <= 0 && Math.abs(mx) > 0.5) {
      const idx = SECTIONS.indexOf(this.currentSection);
      if (mx > 0 && idx < SECTIONS.length - 1) {
        this.currentSection = SECTIONS[idx + 1];
        this.stickCooldown = 250;
        this.rebuild();
        return;
      } else if (mx < 0 && idx > 0) {
        this.currentSection = SECTIONS[idx - 1];
        this.stickCooldown = 250;
        this.rebuild();
        return;
      }
    }

    // A button confirms
    const pad = this.inputManager.gamepad;
    if (pad?.buttons[0]?.pressed) {
      this.stickCooldown = 300;
      this.focusableButtons[this.focusIndex]?.action();
    }
  }

  private updateFocus(): void {
    for (let i = 0; i < this.focusableButtons.length; i++) {
      const { btn } = this.focusableButtons[i];
      if (i === this.focusIndex) {
        btn.setColor("#fff");
        btn.setBackgroundColor("#2a2a4e");
      } else {
        btn.setColor("#4ecdc4");
        btn.setBackgroundColor("#1a1a2e");
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private rebuild(): void {
    this.gamepadPollTimer?.remove();
    this.gamepadPollTimer = undefined;
    this.container?.destroy();
    this.container = null;
    this.build();
  }

  private addFocusable(
    objects: Phaser.GameObjects.GameObject[],
    x: number, y: number, label: string,
    onClick: () => void, fontSize: string = "12px"
  ): void {
    const btn = this.makeButton(x, y, label, onClick, fontSize);
    objects.push(btn);
    this.focusableButtons.push({ btn, action: onClick });
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

    btn.on("pointerover", () => {
      const idx = this.focusableButtons.findIndex(f => f.btn === btn);
      if (idx >= 0) {
        this.focusIndex = idx;
        this.updateFocus();
      }
    });
    btn.on("pointerout", () => btn.setColor("#4ecdc4"));
    btn.on("pointerdown", onClick);

    return btn;
  }
}
