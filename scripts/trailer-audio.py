#!/usr/bin/env python3
"""Generate the original CyberBase trailer ambience.

The sound is synthesized from deterministic noise, oscillators, and impulses;
it does not depend on recorded or downloaded audio.
"""

from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 48_000
DURATION = 48.0
SEED = 0xC7B45E


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    u = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def shaped_noise(
    rng: np.random.Generator,
    count: int,
    low_hz: float,
    high_hz: float,
    slope: float = 0.0,
) -> np.ndarray:
    """Band-limit white noise in the frequency domain with soft shoulders."""
    freqs = np.fft.rfftfreq(count, 1.0 / SAMPLE_RATE)
    spectrum = np.fft.rfft(rng.standard_normal(count))
    low = np.ones_like(freqs) if low_hz <= 0 else 1.0 - np.exp(-((freqs / low_hz) ** 4))
    high = np.exp(-((freqs / high_hz) ** 4))
    tilt = np.ones_like(freqs)
    if slope:
        tilt[1:] = np.power(np.maximum(freqs[1:], 20.0) / 1000.0, slope)
    signal = np.fft.irfft(spectrum * low * high * tilt, n=count)
    rms = np.sqrt(np.mean(signal * signal))
    return signal / max(rms, 1e-12)


def impulse_texture(
    rng: np.random.Generator,
    count: int,
    events_per_second: float,
    decay_seconds: float,
    low_hz: float,
    high_hz: float,
) -> np.ndarray:
    impulses = np.zeros(count, dtype=np.float64)
    event_count = int(DURATION * events_per_second)
    indices = rng.integers(0, count, event_count)
    impulses[indices] = rng.uniform(0.25, 1.0, event_count) * rng.choice((-1.0, 1.0), event_count)
    kernel_count = max(8, int(decay_seconds * SAMPLE_RATE))
    kt = np.arange(kernel_count) / SAMPLE_RATE
    kernel = np.exp(-kt / decay_seconds) * np.sin(2.0 * np.pi * rng.uniform(low_hz, high_hz) * kt)
    padded = count + kernel_count - 1
    result = np.fft.irfft(np.fft.rfft(impulses, padded) * np.fft.rfft(kernel, padded), padded)[:count]
    rms = np.sqrt(np.mean(result * result))
    return result / max(rms, 1e-12)


def pan_mono(signal: np.ndarray, pan: np.ndarray | float) -> np.ndarray:
    """Equal-power pan, where -1 is left and +1 is right."""
    angle = (np.asarray(pan) + 1.0) * (math.pi / 4.0)
    return np.column_stack((signal * np.cos(angle), signal * np.sin(angle)))


def build_mix() -> np.ndarray:
    rng = np.random.default_rng(SEED)
    count = int(DURATION * SAMPLE_RATE)
    t = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    mix = np.zeros((count, 2), dtype=np.float64)

    # Rain: wide airborne hiss, heavier road wash, and scattered nearby drops.
    early_rain = 1.0 - smoothstep(36.0, 37.4, t)
    base_return = smoothstep(41.4, 42.6, t) * (1.0 - smoothstep(45.6, 46.4, t))
    rain_env = np.clip(early_rain + base_return, 0.0, 1.0)
    rain_env *= 0.72 + 0.10 * np.sin(2 * np.pi * 0.071 * t)
    rain_l = shaped_noise(rng, count, 900.0, 15_500.0, -0.18)
    rain_r = shaped_noise(rng, count, 900.0, 15_500.0, -0.18)
    road_l = shaped_noise(rng, count, 100.0, 2400.0, -0.30)
    road_r = shaped_noise(rng, count, 100.0, 2400.0, -0.30)
    drops_l = impulse_texture(rng, count, 24.0, 0.008, 1700.0, 5200.0)
    drops_r = impulse_texture(rng, count, 23.0, 0.009, 1600.0, 5000.0)
    mix[:, 0] += rain_env * (0.070 * rain_l + 0.038 * road_l + 0.018 * drops_l)
    mix[:, 1] += rain_env * (0.070 * rain_r + 0.038 * road_r + 0.018 * drops_r)

    # A restrained, uneasy synth bed with slowly shifting stereo harmonics.
    synth_env = smoothstep(0.0, 4.0, t) * (1.0 - smoothstep(46.0, 48.0, t))
    drift = 0.30 * np.sin(2 * np.pi * 0.019 * t)
    synth = np.zeros(count)
    for frequency, amplitude, modulation in ((43.65, 0.55, 0.07), (65.41, 0.23, 0.11), (87.31, 0.13, 0.17)):
        phase = 2 * np.pi * frequency * t + modulation * np.sin(2 * np.pi * 0.043 * t)
        synth += amplitude * (np.sin(phase) + 0.18 * np.sin(2.003 * phase))
    synth *= 0.042 * synth_env * (0.88 + 0.12 * np.sin(2 * np.pi * 0.097 * t))
    mix += pan_mono(synth, drift)

    # Train approaches from the left, crosses near camera, and recedes right.
    train_env = smoothstep(18.5, 23.2, t) * (1.0 - smoothstep(28.0, 33.0, t))
    near = np.exp(-0.5 * ((t - 26.0) / 2.05) ** 2)
    train_env *= 0.34 + 0.66 * near
    train_pan = np.clip((t - 25.7) / 4.1, -1.0, 1.0) * 0.88
    rumble = shaped_noise(rng, count, 17.0, 175.0, -0.75)
    rail_grind = shaped_noise(rng, count, 210.0, 2700.0, -0.45)
    train_tone = (
        np.sin(2 * np.pi * (35.0 * t + 0.52 * np.sin(2 * np.pi * 0.15 * t)))
        + 0.34 * np.sin(2 * np.pi * 71.3 * t)
    )
    train = train_env * (0.145 * rumble + 0.025 * rail_grind + 0.045 * train_tone)
    mix += pan_mono(train, train_pan)

    # Rail-joint clacks accelerate toward the crossing and trail away.
    clacks = np.zeros(count)
    event_time = 21.7
    while event_time < 30.1:
        distance = abs(event_time - 26.0)
        interval = 0.205 + 0.072 * min(distance, 4.3) / 4.3
        start = int(event_time * SAMPLE_RATE)
        length = int(0.085 * SAMPLE_RATE)
        ct = np.arange(length) / SAMPLE_RATE
        transient = np.exp(-ct / 0.018) * (
            np.sin(2 * np.pi * 118.0 * ct) + 0.42 * np.sin(2 * np.pi * 310.0 * ct)
        )
        end = min(start + length, count)
        clacks[start:end] += transient[: end - start]
        event_time += interval
    clack_env = np.exp(-0.5 * ((t - 26.0) / 2.35) ** 2)
    mix += pan_mono(0.115 * clacks * clack_env, train_pan)

    # After the train and rain, exposed industrial wind opens into a darker beat.
    wind_env = smoothstep(35.6, 36.8, t) * (1.0 - smoothstep(41.4, 42.7, t))
    wind_l = shaped_noise(rng, count, 38.0, 980.0, -0.72)
    wind_r = shaped_noise(rng, count, 38.0, 980.0, -0.72)
    gust = 0.48 + 0.28 * np.sin(2 * np.pi * 0.083 * t) + 0.15 * np.sin(2 * np.pi * 0.173 * t + 1.2)
    mix[:, 0] += 0.085 * wind_env * gust * wind_l
    mix[:, 1] += 0.085 * wind_env * np.roll(gust, 5300) * wind_r
    industrial = np.sin(2 * np.pi * 29.2 * t + 0.8 * np.sin(2 * np.pi * 0.11 * t))
    mix += pan_mono(0.038 * wind_env * industrial, -0.18 + 0.25 * np.sin(2 * np.pi * 0.04 * t))

    # Required entrance/exit fades and a gentle safety limiter.
    master_fade = smoothstep(0.0, 2.0, t) * (1.0 - smoothstep(46.0, 48.0, t))
    mix *= master_fade[:, None]
    mix = np.tanh(mix * 1.15) / 1.15
    peak = float(np.max(np.abs(mix)))
    if peak > 0.84:
        mix *= 0.84 / peak
    return mix


def write_wav(path: Path, mix: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.round(np.clip(mix, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output/trailer/cyberbase-ambience.wav"),
        help="destination WAV path",
    )
    args = parser.parse_args()
    mix = build_mix()
    write_wav(args.output, mix)
    peak = float(np.max(np.abs(mix)))
    rms = np.sqrt(np.mean(mix * mix, axis=0))
    print(f"Wrote {args.output}: {DURATION:.3f}s, {SAMPLE_RATE} Hz, stereo PCM16")
    print(f"Peak: {peak:.6f} ({20 * np.log10(max(peak, 1e-12)):.2f} dBFS)")
    print(f"RMS L/R: {rms[0]:.6f}/{rms[1]:.6f} "
          f"({20*np.log10(rms[0]):.2f}/{20*np.log10(rms[1]):.2f} dBFS)")


if __name__ == "__main__":
    main()
