import Phaser from "phaser";

/**
 * Drag-anywhere virtual joystick for mobile.
 * Only renders when touch is active in the left zone.
 * Use: new MobileControls(scene). Then in update(), call .update().
 */
export class MobileControls {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private outerRing!: Phaser.GameObjects.Arc;
  private innerThumb!: Phaser.GameObjects.Arc;

  private touchActive: boolean = false;
  private touchOriginX: number = 0;
  private touchOriginY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;

  private readonly OUTER_RADIUS = 60;
  private readonly THUMB_RADIUS = 20;
  private readonly MAX_CLAMP = 50;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createGraphics();
    this.setupPointerListeners();
  }

  private createGraphics(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(500);
    this.container.setVisible(false);

    // Outer ring
    this.outerRing = this.scene.add.circle(0, 0, this.OUTER_RADIUS, 0x4ecdc4, 0.3);
    this.outerRing.setStrokeStyle(2, 0x4ecdc4, 0.6);
    this.container.add(this.outerRing);

    // Inner thumb
    this.innerThumb = this.scene.add.circle(0, 0, this.THUMB_RADIUS, 0x4ecdc4, 0.6);
    this.container.add(this.innerThumb);
  }

  private setupPointerListeners(): void {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < this.scene.scale.width / 2) {
        // Left zone - joystick
        this.show(pointer.x, pointer.y);
        this.touchOriginX = pointer.x;
        this.touchOriginY = pointer.y;
        this.touchActive = true;
      } else {
        // Right zone - attack
        this.scene.events.emit("touchAttack");
      }
    });

    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.touchActive && pointer.isDown) {
        this.currentX = pointer.x;
        this.currentY = pointer.y;
        this.updateThumb();
      }
    });

    this.scene.input.on("pointerup", () => {
      if (this.touchActive) {
        this.hide();
        this.touchActive = false;
      }
    });
  }

  private show(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this.innerThumb.setPosition(0, 0);
  }

  private hide(): void {
    this.container.setVisible(false);
  }

  private updateThumb(): void {
    const dx = this.currentX - this.touchOriginX;
    const dy = this.currentY - this.touchOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp thumb to max radius
    const clampDist = Math.min(dist, this.MAX_CLAMP);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampDist;
    const thumbY = Math.sin(angle) * clampDist;
    this.innerThumb.setPosition(thumbX, thumbY);
  }

  /** Returns -1 to 1 for X axis based on joystick displacement */
  get moveX(): number {
    if (!this.touchActive) return 0;
    const dx = this.currentX - this.touchOriginX;
    return Math.max(-1, Math.min(1, dx / this.MAX_CLAMP));
  }

  /** Returns -1 to 1 for Y axis based on joystick displacement */
  get moveY(): number {
    if (!this.touchActive) return 0;
    const dy = this.currentY - this.touchOriginY;
    return Math.max(-1, Math.min(1, dy / this.MAX_CLAMP));
  }

  get isActive(): boolean {
    return this.touchActive;
  }

  destroy(): void {
    this.container.destroy();
  }
}
