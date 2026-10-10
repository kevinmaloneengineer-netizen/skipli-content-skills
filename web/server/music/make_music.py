#!/usr/bin/env python3
"""Upbeat instrumental background track, synthesized from scratch (no samples, no licence to worry about).

Ukulele-like strummed chords (Karplus-Strong), bass, kick, clap, shaker and a glockenspiel motif.
The seed picks the key, tempo, chord progression and melody, so every video gets its own tune.

  python3 make_music.py out.wav --seconds 32 --seed 7
  python3 make_music.py out.wav --seconds 15 --mood soft   # light: slower, no drums, arpeggios over a warm pad
"""

import argparse
import wave

import numpy as np

SR = 44100
KEYS = {"C": 60, "D": 62, "F": 65, "G": 67, "A": 57}
# Major-key progressions as (scale degree, minor?) per bar.
PROGRESSIONS = [
    [(0, 0), (4, 0), (5, 1), (3, 0)],  # I V vi IV
    [(0, 0), (5, 1), (3, 0), (4, 0)],  # I vi IV V
    [(3, 0), (4, 0), (0, 0), (5, 1)],  # IV V I vi
    [(0, 0), (3, 0), (4, 0), (3, 0)],  # I IV V IV
]
MAJOR = [0, 2, 4, 5, 7, 9, 11]
STRUM = [1, 0, 1, 1, 0, 1, 1, 1]  # 8th notes: D - D U - U D U
STRUM_DIR = [1, 0, 1, -1, 0, -1, 1, -1]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


_pluck_cache = {}


def pluck(midi, seconds=1.4):
    """Karplus-Strong string: a noise burst through a damped delay line (cached per pitch)."""
    if midi in _pluck_cache:
        return _pluck_cache[midi]
    n = int(SR * seconds)
    period = int(round(SR / hz(midi)))
    rng = np.random.default_rng(midi)
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for start in range(0, n, period):  # vectorised per period: each cycle averages the previous one
        k = min(period, n - start)
        out[start:start + k] = buf[:k]
        buf = 0.996 * 0.5 * (buf + np.roll(buf, -1))
    out *= np.exp(-np.linspace(0, 3.2, n))
    _pluck_cache[midi] = out
    return out


def env(n, attack=0.005, decay=6.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-decay * t)


def add(track, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(track):
        return
    k = min(len(sig), len(track) - i)
    track[i:i + k] += gain * sig[:k]


def chord_notes(root, minor):
    third = 3 if minor else 4
    return [root, root + 7, root + 12, root + 12 + third]  # ukulele-ish voicing around middle C


def build_soft(seconds, seed):
    """Light background: picked arpeggios over a slow pad, a quiet bell melody, no drums."""
    rng = np.random.default_rng(seed)
    key = KEYS[list(KEYS)[seed % len(KEYS)]]
    bpm = int(rng.integers(78, 92))
    prog = PROGRESSIONS[int(rng.integers(len(PROGRESSIONS)))]
    beat = 60.0 / bpm
    bar = 4 * beat
    total = int(SR * (seconds + 3))
    music = np.zeros(total)
    penta = [0, 2, 4, 7, 9, 12]
    motif = [int(x) for x in rng.choice(penta, 4)]
    bars = int(np.ceil(seconds / bar)) + 1
    for b in range(bars):
        start = b * bar
        degree, minor = prog[b % len(prog)]
        root = key + MAJOR[degree]
        notes = chord_notes(root, minor)
        # pad: soft sines with a slow swell across the bar
        n = int(SR * bar * 1.15)
        tt = np.arange(n) / SR
        swell = np.minimum(1, tt / 0.6) * np.exp(-0.5 * tt)
        pad = sum(np.sin(2 * np.pi * hz(m - 12) * tt) + 0.2 * np.sin(4 * np.pi * hz(m - 12) * tt) for m in notes)
        add(music, pad * swell, start, 0.045)
        # arpeggio: up and down the chord in 8th notes
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for s_, k in enumerate(pattern):
            add(music, pluck(notes[k]), start + s_ * beat / 2, 0.17 if s_ % 2 == 0 else 0.12)
        # bass on the first beat
        nb = int(SR * bar)
        tb = np.arange(nb) / SR
        add(music, np.sin(2 * np.pi * hz(root - 24) * tb) * env(nb, 0.01, 1.6), start, 0.18)
        # bell: a 4-note phrase on beats, every other bar
        if b % 2 == 1:
            for q, step in enumerate(motif):
                m = key + 12 + step
                nn = int(SR * 0.9)
                t2 = np.arange(nn) / SR
                bell = (np.sin(2 * np.pi * hz(m) * t2) + 0.2 * np.sin(2 * np.pi * hz(m) * 2.76 * t2)) * env(nn, 0.003, 4)
                add(music, bell, start + q * beat, 0.07)
    # a little room: two quiet echoes
    for delay, g in ((0.23, 0.25), (0.47, 0.12)):
        d = int(SR * delay)
        music[d:] += g * music[:-d].copy()
    return finish_mix(music, seconds)


def finish_mix(mix, seconds):
    n = int(SR * seconds)
    mix = mix[:n].copy()
    fade = int(SR * min(2.0, seconds / 5))
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix[: int(SR * 0.4)] *= np.linspace(0, 1, int(SR * 0.4))
    mix = np.tanh(1.3 * mix / (np.max(np.abs(mix)) + 1e-9)) * 0.8
    return np.stack([mix, mix], axis=1)


def build(seconds, seed):
    rng = np.random.default_rng(seed)
    key = KEYS[list(KEYS)[seed % len(KEYS)]]
    bpm = int(rng.integers(104, 124))
    prog = PROGRESSIONS[int(rng.integers(len(PROGRESSIONS)))]
    beat = 60.0 / bpm
    bar = 4 * beat
    total = int(SR * (seconds + 2))
    music, drums = np.zeros(total), np.zeros(total)

    t = np.arange(int(SR * 0.35)) / SR
    kick = np.sin(2 * np.pi * (50 * t + 70 / 18 * (1 - np.exp(-18 * t)))) * np.exp(-9 * t)
    noise = np.random.default_rng(seed + 1).uniform(-1, 1, int(SR * 0.25))
    clap = np.diff(noise, prepend=0) * env(len(noise), 0.001, 38)
    shaker = np.diff(np.diff(noise[: int(SR * 0.06)], prepend=0), prepend=0) * env(int(SR * 0.06), 0.002, 60)

    # Glockenspiel motif: 8 eighth notes from the major pentatonic, repeated with small changes.
    penta = [0, 2, 4, 7, 9, 12, 14, 16]
    motif = [int(x) for x in rng.choice(penta, 8)]
    rests = rng.random(8) < 0.3

    bars = int(np.ceil(seconds / bar)) + 1
    for b in range(bars):
        start = b * bar
        degree, minor = prog[b % len(prog)]
        root = key + MAJOR[degree]
        notes = chord_notes(root, minor)
        for s in range(8):  # strum
            if not STRUM[s]:
                continue
            order = notes if STRUM_DIR[s] >= 0 else notes[::-1]
            for j, m in enumerate(order):
                add(music, pluck(m), start + s * beat / 2 + j * 0.012, 0.22 if STRUM_DIR[s] >= 0 else 0.15)
        for q in range(4):  # bass: root, fifth
            m = root - 24 + (7 if q % 2 else 0)
            n = int(SR * beat * 0.9)
            tt = np.arange(n) / SR
            add(music, (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(4 * np.pi * hz(m) * tt)) * env(n, 0.004, 3.5), start + q * beat, 0.35)
        if b % 2 == 1 or b > 3:  # melody joins after the intro
            for s in range(8):
                if rests[s] or (b % 4 == 3 and s > 5):
                    continue
                m = key + 12 + motif[s] + (2 if b % 4 == 2 and s == 7 else 0)
                n = int(SR * 0.5)
                tt = np.arange(n) / SR
                bell = (np.sin(2 * np.pi * hz(m) * tt) + 0.25 * np.sin(2 * np.pi * hz(m) * 2.76 * tt)) * env(n, 0.002, 7)
                add(music, bell, start + s * beat / 2, 0.12)
        if b >= 1:  # drums after the first bar
            for q in range(4):
                if q in (0, 2):
                    add(drums, kick, start + q * beat, 0.45)
                else:
                    add(drums, clap, start + q * beat, 0.16)
            for s in range(8):
                add(drums, shaker, start + s * beat / 2, 0.10 if s % 2 else 0.05)

    mix = music + drums
    n = int(SR * seconds)
    mix = mix[:n]
    fade = int(SR * 1.5)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix[: int(SR * 0.3)] *= np.linspace(0, 1, int(SR * 0.3))
    mix = np.tanh(1.4 * mix / (np.max(np.abs(mix)) + 1e-9)) * 0.85  # gentle limiter
    return np.stack([mix, mix], axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--seconds", type=float, default=30)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--mood", choices=["upbeat", "soft"], default="upbeat")
    a = ap.parse_args()
    make = build_soft if a.mood == "soft" else build
    data = (make(max(4.0, a.seconds), a.seed) * 32767).astype("<i2")
    with wave.open(a.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(a.out)


if __name__ == "__main__":
    main()
