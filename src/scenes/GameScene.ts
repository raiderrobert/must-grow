import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "@/constants";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  update(_time: number, _delta: number): void {
    // Systems will be wired here
  }
}
