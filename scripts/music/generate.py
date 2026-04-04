"""
Must Grow — 8-bit style MIDI music and sound effects generator.

Generates:
  - Main theme (loopable background track)
  - Boss theme (intense, for Sun fight)
  - Tier-up fanfare (short jingle)
  - Sound effects: zap, explosion, pickup, power_up, power_down, upgrade, game_over
"""

from midiutil import MIDIFile
import os
import struct
import wave
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "audio")


def ensure_output_dir():
    os.makedirs(OUT_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# WAV-based 8-bit sound effects (no MIDI needed — pure synthesis)
# ---------------------------------------------------------------------------

SAMPLE_RATE = 22050


def write_wav(filename: str, samples: list[int], sample_rate: int = SAMPLE_RATE):
    """Write 8-bit unsigned PCM samples to a WAV file."""
    path = os.path.join(OUT_DIR, filename)
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(1)
        f.setframerate(sample_rate)
        f.writeframes(bytes(max(0, min(255, s)) for s in samples))
    print(f"  wrote {path}")


def square_wave(freq: float, duration: float, volume: float = 0.5, duty: float = 0.5) -> list[float]:
    """Generate square wave samples as floats in [-1, 1]."""
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        phase = (t * freq) % 1.0
        val = volume if phase < duty else -volume
        samples.append(val)
    return samples


def noise(duration: float, volume: float = 0.5) -> list[float]:
    """Generate pseudo-random noise."""
    import random
    random.seed(42)
    n = int(SAMPLE_RATE * duration)
    return [random.uniform(-volume, volume) for _ in range(n)]


def sine_wave(freq: float, duration: float, volume: float = 0.5) -> list[float]:
    n = int(SAMPLE_RATE * duration)
    return [volume * math.sin(2 * math.pi * freq * i / SAMPLE_RATE) for i in range(n)]


def triangle_wave(freq: float, duration: float, volume: float = 0.5) -> list[float]:
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        phase = (t * freq) % 1.0
        val = volume * (4 * abs(phase - 0.5) - 1)
        samples.append(val)
    return samples


def mix(*tracks: list[float]) -> list[float]:
    """Mix multiple float sample tracks together."""
    length = max(len(t) for t in tracks)
    result = [0.0] * length
    for t in tracks:
        for i, s in enumerate(t):
            result[i] += s
    # Normalize if clipping
    peak = max(abs(s) for s in result) if result else 1.0
    if peak > 1.0:
        result = [s / peak for s in result]
    return result


def to_8bit(samples: list[float]) -> list[int]:
    """Convert float [-1,1] samples to unsigned 8-bit [0,255]."""
    return [int((s * 0.8 + 1.0) * 127.5) for s in samples]


def fade_out(samples: list[float], fade_samples: int = 2000) -> list[float]:
    result = list(samples)
    start = len(result) - fade_samples
    for i in range(fade_samples):
        if start + i >= 0:
            result[start + i] *= 1.0 - (i / fade_samples)
    return result


def fade_in(samples: list[float], fade_samples: int = 500) -> list[float]:
    result = list(samples)
    for i in range(min(fade_samples, len(result))):
        result[i] *= i / fade_samples
    return result


def pitch_sweep(start_freq: float, end_freq: float, duration: float, volume: float = 0.5, wave_type: str = "square") -> list[float]:
    """Generate a frequency sweep."""
    n = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(n):
        t = i / n
        freq = start_freq + (end_freq - start_freq) * t
        phase = (i / SAMPLE_RATE * freq) % 1.0
        if wave_type == "square":
            val = volume if phase < 0.5 else -volume
        else:
            val = volume * math.sin(2 * math.pi * phase)
        samples.append(val)
    return samples


# --- Sound Effects ---

def sfx_zap():
    """Laser zap — descending square wave sweep."""
    sweep = pitch_sweep(1200, 200, 0.15, volume=0.6)
    return fade_out(sweep, 1000)


def sfx_explosion():
    """Explosion — noise burst with low rumble."""
    n = noise(0.4, volume=0.7)
    rumble = square_wave(60, 0.4, volume=0.4)
    mixed = mix(n, rumble)
    return fade_out(mixed, 4000)


def sfx_pickup():
    """Resource pickup — quick ascending arpeggio."""
    notes = [523, 659, 784]  # C5, E5, G5
    samples: list[float] = []
    for freq in notes:
        samples.extend(square_wave(freq, 0.06, volume=0.4))
    return fade_out(samples, 500)


def sfx_power_up():
    """Power button click / energy generated."""
    sweep = pitch_sweep(200, 800, 0.1, volume=0.5)
    tail = square_wave(800, 0.05, volume=0.3)
    return fade_out(sweep + tail, 500)


def sfx_power_down():
    """System shutting down — descending sad tone."""
    sweep = pitch_sweep(600, 100, 0.5, volume=0.5)
    return fade_out(sweep, 3000)


def sfx_upgrade():
    """Upgrade purchased — triumphant ascending sweep + chord."""
    sweep = pitch_sweep(300, 900, 0.2, volume=0.4)
    # Major chord
    c = square_wave(523, 0.3, volume=0.25)
    e = square_wave(659, 0.3, volume=0.25)
    g = square_wave(784, 0.3, volume=0.25)
    chord = mix(c, e, g)
    combined = sweep + chord
    return fade_out(combined, 2000)


def sfx_game_over():
    """Game over — descending minor arpeggio."""
    notes = [440, 392, 349, 330, 262]  # A4, G4, F4, E4, C4
    samples: list[float] = []
    for freq in notes:
        samples.extend(triangle_wave(freq, 0.2, volume=0.5))
    return fade_out(samples, 3000)


def sfx_tier_up():
    """Tier evolution — epic ascending fanfare."""
    # Ascending power notes
    notes = [262, 330, 392, 523, 659, 784]  # C4 E4 G4 C5 E5 G5
    samples: list[float] = []
    for i, freq in enumerate(notes):
        dur = 0.12 if i < 4 else 0.25
        samples.extend(square_wave(freq, dur, volume=0.4))
    # Final sustained chord
    c = square_wave(523, 0.6, volume=0.3)
    e = square_wave(659, 0.6, volume=0.3)
    g = square_wave(784, 0.6, volume=0.3)
    c_high = square_wave(1047, 0.6, volume=0.2)
    chord = mix(c, e, g, c_high)
    combined = samples + chord
    return fade_out(combined, 4000)


# ---------------------------------------------------------------------------
# MIDI music tracks
# ---------------------------------------------------------------------------

def make_main_theme():
    """
    Main background theme — driving 8-bit space exploration feel.
    Loopable, 16 bars at 130 BPM. Three channels: bass, lead, arp.
    """
    midi = MIDIFile(3)
    tempo = 130
    for ch in range(3):
        midi.addTempo(ch, 0, tempo)
        midi.addProgramChange(ch, ch, 0, 80 if ch == 0 else 81)  # Square lead / Sawtooth

    # Channel 0: Bass line (low octave, driving pulse)
    bass_pattern = [
        (36, 1.0), (36, 0.5), (39, 0.5), (41, 1.0), (43, 0.5), (41, 0.5),  # C2 Eb2 F2 G2
        (36, 1.0), (36, 0.5), (43, 0.5), (41, 1.0), (39, 0.5), (36, 0.5),
    ]
    t = 0
    for _ in range(4):  # Repeat pattern 4 times = 16 bars
        for note, dur in bass_pattern:
            midi.addNote(0, 0, note, t, dur * 0.9, 100)
            t += dur

    # Channel 1: Lead melody (call and response, space-y)
    lead_phrases = [
        # Phrase A — ascending, hopeful
        [(60, 0.5), (63, 0.5), (65, 1.0), (67, 0.5), (70, 0.5), (72, 1.5), (-1, 0.5)],
        # Phrase B — descending, mysterious
        [(72, 0.5), (70, 0.5), (67, 1.0), (65, 0.5), (63, 0.5), (60, 1.5), (-1, 0.5)],
        # Phrase C — rhythmic, driving
        [(60, 0.25), (60, 0.25), (63, 0.5), (65, 0.5), (67, 0.25), (67, 0.25), (70, 0.5), (72, 1.0), (-1, 0.5)],
        # Phrase D — resolution
        [(72, 0.5), (75, 0.5), (72, 1.0), (70, 0.5), (67, 0.5), (65, 1.0), (60, 1.5)],
    ]
    t = 0
    for _ in range(2):  # Play through twice
        for phrase in lead_phrases:
            for note, dur in phrase:
                if note > 0:
                    midi.addNote(1, 1, note, t, dur * 0.85, 90)
                t += dur

    # Channel 2: Arpeggiated chords (shimmering background)
    arp_chords = [
        [48, 55, 60, 63],  # Cm
        [48, 55, 60, 63],  # Cm
        [53, 58, 60, 65],  # F
        [55, 58, 62, 67],  # G
    ]
    t = 0
    arp_dur = 0.25
    for _ in range(4):
        for chord in arp_chords:
            for beat in range(8):  # 2 bars per chord
                note = chord[beat % len(chord)]
                midi.addNote(2, 2, note + 12, t, arp_dur * 0.8, 60)
                t += arp_dur

    path = os.path.join(OUT_DIR, "main_theme.mid")
    with open(path, "wb") as f:
        midi.writeFile(f)
    print(f"  wrote {path}")


def make_boss_theme():
    """
    Boss / Sun fight theme — intense, fast, aggressive.
    160 BPM, minor key, heavy bass, frantic arpeggios.
    """
    midi = MIDIFile(3)
    tempo = 160
    for ch in range(3):
        midi.addTempo(ch, 0, tempo)
        midi.addProgramChange(ch, ch, 0, 81)  # Sawtooth

    # Driving bass — eighth note pulse
    bass_notes = [33, 33, 36, 33, 38, 36, 33, 31]  # A1 C2 D2 G1 — aggressive
    t = 0
    for _ in range(8):
        for note in bass_notes:
            midi.addNote(0, 0, note, t, 0.4, 110)
            t += 0.5

    # Aggressive lead — short staccato bursts
    lead = [
        (69, 0.25), (72, 0.25), (69, 0.25), (65, 0.25),
        (69, 0.25), (72, 0.25), (76, 0.5),
        (75, 0.25), (72, 0.25), (69, 0.5),
        (72, 0.25), (69, 0.25), (65, 0.25), (64, 0.25),
        (65, 0.5), (69, 0.5), (72, 1.0),
    ]
    t = 0
    for _ in range(4):
        for note, dur in lead:
            midi.addNote(1, 1, note, t, dur * 0.7, 100)
            t += dur

    # Frantic arpeggio
    arp_chords = [
        [57, 60, 64, 69],  # Am
        [57, 60, 64, 69],  # Am
        [53, 57, 60, 65],  # F
        [52, 55, 59, 64],  # E
    ]
    t = 0
    for _ in range(4):
        for chord in arp_chords:
            for beat in range(16):  # Sixteenth note arps
                note = chord[beat % len(chord)]
                midi.addNote(2, 2, note + 12, t, 0.1, 70)
                t += 0.125

    path = os.path.join(OUT_DIR, "boss_theme.mid")
    with open(path, "wb") as f:
        midi.writeFile(f)
    print(f"  wrote {path}")


def make_ambient_space():
    """
    Ambient space track — slow, atmospheric, for menus or quiet moments.
    80 BPM, sparse, reverb-y feel with long sustained notes.
    """
    midi = MIDIFile(2)
    tempo = 80
    for ch in range(2):
        midi.addTempo(ch, 0, tempo)
        midi.addProgramChange(ch, ch, 0, 89)  # Pad (warm)

    # Long sustained pads
    pad_chords = [
        ([48, 55, 60], 4.0),  # Cm
        ([48, 53, 60], 4.0),  # Fm/C
        ([46, 55, 58], 4.0),  # Bb
        ([43, 55, 60], 4.0),  # G/C
    ]
    t = 0
    for _ in range(4):
        for notes, dur in pad_chords:
            for n in notes:
                midi.addNote(0, 0, n, t, dur * 0.95, 50)
            t += dur

    # Sparse melodic fragments — like distant signals
    melody = [
        (72, 1.0), (-1, 1.0), (75, 0.5), (72, 1.5),
        (-1, 2.0), (67, 1.0), (70, 1.0),
        (-1, 1.0), (72, 2.0), (-1, 1.0),
        (75, 0.5), (77, 0.5), (75, 1.0), (-1, 2.0),
    ]
    t = 0
    for _ in range(4):
        for note, dur in melody:
            if note > 0:
                midi.addNote(1, 1, note, t, dur * 0.9, 40)
            t += dur

    path = os.path.join(OUT_DIR, "ambient_space.mid")
    with open(path, "wb") as f:
        midi.writeFile(f)
    print(f"  wrote {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ensure_output_dir()

    print("Generating MIDI tracks...")
    make_main_theme()
    make_boss_theme()
    make_ambient_space()

    print("\nGenerating 8-bit sound effects...")
    effects = {
        "sfx_zap.wav": sfx_zap,
        "sfx_explosion.wav": sfx_explosion,
        "sfx_pickup.wav": sfx_pickup,
        "sfx_power_up.wav": sfx_power_up,
        "sfx_power_down.wav": sfx_power_down,
        "sfx_upgrade.wav": sfx_upgrade,
        "sfx_game_over.wav": sfx_game_over,
        "sfx_tier_up.wav": sfx_tier_up,
    }
    for filename, generator in effects.items():
        samples = to_8bit(generator())
        write_wav(filename, samples)

    print(f"\nDone! All files in {OUT_DIR}")


if __name__ == "__main__":
    main()
