import Phaser from "phaser";

export type InputType = "keyboard" | "gamepad";

/**
 * Single source of truth for all player input.
 * Owns all key bindings and gamepad polling.
 * Everything else reads from here — nothing registers its own keys.
 *
 * Bindings:
 *   Move:   WASD / Arrow keys  |  Left stick
 *   Burst:  Space / J          |  A (button 0)
 *   Boost:  Shift              |  RB (button 7)
 */
export class InputManager {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private attackKeys: Phaser.Input.Keyboard.Key[];
  private boostKey: Phaser.Input.Keyboard.Key;
  private pad: Phaser.Input.Gamepad.Gamepad | null = null;
  private scene: Phaser.Scene;

  private _lastInputType: InputType = "keyboard";
  private _attackJustPressed: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Movement
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Actions
    this.attackKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J),
    ];
    this.boostKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    // Keyboard activity → mark as keyboard
    scene.input.keyboard!.on("keydown", () => {
      this._lastInputType = "keyboard";
    });

    // Gamepad
    if (scene.input.gamepad) {
      scene.input.gamepad.once(
        "connected",
        (pad: Phaser.Input.Gamepad.Gamepad) => {
          this.pad = pad;
          this._lastInputType = "gamepad";
        },
      );
      scene.input.gamepad.on(
        "down",
        (
          _pad: Phaser.Input.Gamepad.Gamepad,
          button: Phaser.Input.Gamepad.Button,
        ) => {
          this._lastInputType = "gamepad";
          if (button.index === 0) this._attackJustPressed = true;
        },
      );
    }
  }

  /** Call once per frame at the start of update(). */
  update(): void {
    // Refresh gamepad reference if connected after scene start
    if (!this.pad && (this.scene.input.gamepad?.total ?? 0) > 0) {
      this.pad = this.scene.input.gamepad!.getPad(0);
    }

    // Stick movement counts as gamepad input
    if (Math.abs(this.moveX) > 0.2 || Math.abs(this.moveY) > 0.2) {
      if (this.pad) this._lastInputType = "gamepad";
    }

    // Keyboard attack keys
    if (this.attackKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
      this._attackJustPressed = true;
      this._lastInputType = "keyboard";
    }
  }

  // ── Movement ──────────────────────────────────────────────────────

  /** Horizontal axis: -1 (left) to +1 (right), 0 when idle. */
  get moveX(): number {
    const stick = this.pad?.axes[0]?.getValue() ?? 0;
    if (Math.abs(stick) > 0.2) return stick;
    if (this.cursors.left.isDown || this.wasd.A.isDown) return -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) return 1;
    return 0;
  }

  /** Vertical axis: -1 (up) to +1 (down), 0 when idle. */
  get moveY(): number {
    const stick = this.pad?.axes[1]?.getValue() ?? 0;
    if (Math.abs(stick) > 0.2) return stick;
    if (this.cursors.up.isDown || this.wasd.W.isDown) return -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) return 1;
    return 0;
  }

  get isMoving(): boolean {
    return Math.abs(this.moveX) > 0.01 || Math.abs(this.moveY) > 0.01;
  }

  // ── Actions ───────────────────────────────────────────────────────

  /**
   * True if burst was pressed this frame (Space/J or gamepad A).
   * Clears itself after being read — call at most once per frame.
   */
  consumeAttack(): boolean {
    const pressed = this._attackJustPressed;
    this._attackJustPressed = false;
    return pressed;
  }

  /** True while boost is held (Shift or gamepad RB). */
  get isBoostHeld(): boolean {
    return this.boostKey.isDown || (this.pad?.buttons[7]?.pressed ?? false);
  }

  // ── Input type ────────────────────────────────────────────────────

  get lastInputType(): InputType {
    return this._lastInputType;
  }
  get isGamepad(): boolean {
    return this._lastInputType === "gamepad";
  }
  get isKeyboard(): boolean {
    return this._lastInputType === "keyboard";
  }
}
