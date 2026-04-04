import Phaser from "phaser";
import { BootScene } from "@/scenes/BootScene";
import { GameScene } from "@/scenes/GameScene";

const dpr = window.devicePixelRatio || 1;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth * dpr,
  height: window.innerHeight * dpr,
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1 / dpr,
  },
};

new Phaser.Game(config);
