import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "@/constants";
import { createStarfield } from "@/entities/Starfield";
import { PlayerStation } from "@/entities/PlayerStation";

export class GameScene extends Phaser.Scene {
  player!: PlayerStation;

  constructor() {
    super({ key: "GameScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    createStarfield(this);
    this.player = new PlayerStation(this);
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
  }
}
