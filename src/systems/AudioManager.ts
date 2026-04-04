import Phaser from "phaser";

export class AudioManager {
  private scene: Phaser.Scene;
  private muted: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  play(key: string, volumeScale: number = 1): void {
    if (this.muted) return;
    try {
      this.scene.sound.play(key, { volume: 0.5 * volumeScale });
    } catch {
      // Audio may not be loaded yet
    }
  }

  playWithVariation(key: string, volumeScale: number = 1): void {
    if (this.muted) return;
    const detune = (Math.random() - 0.5) * 200;
    try {
      this.scene.sound.play(key, { volume: 0.5 * volumeScale, detune });
    } catch {
      // Audio may not be loaded yet
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.scene.sound.mute = this.muted;
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
