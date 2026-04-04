/**
 * MusicSystem — procedural background music via Web Audio API oscillators.
 *
 * The .mid files shipped with the project can't play natively in browsers
 * (Chrome/Firefox dropped MIDI audio support). Instead we schedule note
 * sequences using AudioContext, matching the character of each MIDI track:
 *   ambient_space.mid  →  slow sine arpeggios, 80 BPM
 *   main_theme.mid     →  melodic triangle lead, 130 BPM
 *   boss_theme.mid     →  driving sawtooth, 165 BPM
 */

type TrackName = "ambient" | "main" | "boss";

interface TrackDef {
  bpm: number;
  /** Note names or "REST". Each step = one beat. */
  notes: string[];
  waveType: OscillatorType;
  /** Peak gain (volume) */
  gain: number;
  /** Fraction of a beat that the note sounds (0–1) */
  noteDuration: number;
}

const NOTE_FREQ: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.26,
  REST: 0,
};

const TRACKS: Record<TrackName, TrackDef> = {
  ambient: {
    bpm: 80,
    notes: [
      "C3", "REST", "G3", "REST",
      "A3", "G3", "REST", "E3",
      "REST", "C3", "REST", "REST",
    ],
    waveType: "sine",
    gain: 0.04,
    noteDuration: 0.75,
  },
  main: {
    bpm: 130,
    notes: [
      "C4", "E4", "G4", "E4",
      "D4", "F4", "A4", "F4",
      "E4", "G4", "B4", "G4",
      "C5", "REST", "REST", "REST",
    ],
    waveType: "triangle",
    gain: 0.05,
    noteDuration: 0.65,
  },
  boss: {
    bpm: 165,
    notes: [
      "C4", "C4", "E4", "REST",
      "G4", "REST", "Bb4", "REST",
      "A4", "G4", "E4", "REST",
      "C4", "REST", "REST", "REST",
    ],
    waveType: "sawtooth",
    gain: 0.04,
    noteDuration: 0.5,
  },
};

/** Look-ahead window for note scheduling (seconds). */
const LOOKAHEAD = 0.12;
/** How often the scheduler runs (ms). */
const SCHEDULE_INTERVAL = 30;

export class MusicSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTrack: TrackName = "ambient";
  private isPlaying: boolean = false;
  private muted: boolean = false;
  private schedulerHandle: ReturnType<typeof setTimeout> | null = null;
  private patternStep: number = 0;
  private nextNoteTime: number = 0;

  /** Start (or switch to) the given track. Safe to call before first user gesture. */
  play(track: TrackName = "ambient"): void {
    if (this.isPlaying && this.currentTrack === track) return;
    this.stop();
    this.currentTrack = track;
    this.isPlaying = true;
    this.patternStep = 0;

    this.initContext().then(() => {
      if (!this.ctx || !this.isPlaying) return;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.scheduleLoop();
    });
  }

  stop(): void {
    this.isPlaying = false;
    if (this.schedulerHandle !== null) {
      clearTimeout(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx!.currentTime, 0.1);
    }
  }

  /** Switch music based on tier. Call from GameScene when tier changes. */
  onTierChange(tier: number): void {
    if (tier >= 4) {
      this.play("boss");
    } else if (tier >= 2) {
      this.play("main");
    } else {
      this.play("ambient");
    }
  }

  private async initContext(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  private scheduleLoop(): void {
    if (!this.ctx || !this.isPlaying) return;

    const track = TRACKS[this.currentTrack];
    const beatDuration = 60 / track.bpm;

    while (this.nextNoteTime < this.ctx.currentTime + LOOKAHEAD) {
      const noteKey = track.notes[this.patternStep % track.notes.length];
      const freq = NOTE_FREQ[noteKey] ?? 0;

      if (freq > 0) {
        this.scheduleNote(freq, this.nextNoteTime, beatDuration * track.noteDuration, track);
      }

      this.nextNoteTime += beatDuration;
      this.patternStep++;
    }

    this.schedulerHandle = setTimeout(() => this.scheduleLoop(), SCHEDULE_INTERVAL);
  }

  private scheduleNote(
    freq: number,
    startTime: number,
    duration: number,
    track: TrackDef
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = track.waveType;
    osc.frequency.value = freq;

    // Simple ADSR envelope
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(track.gain, startTime + 0.01);
    gainNode.gain.setValueAtTime(track.gain, startTime + duration - 0.04);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
