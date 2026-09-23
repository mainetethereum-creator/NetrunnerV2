#!/usr/bin/env python3
"""Validate and encode the 48-second CyberBase Nightfall trailer."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import wave
from pathlib import Path

from PIL import Image


FPS = 30
SIZE = (1920, 1080)
SHOT_SECONDS = (6, 6, 5, 5, 7, 7, 6, 6)
TOTAL_SECONDS = sum(SHOT_SECONDS)
DEFAULT_FFMPEG = Path(r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe")
REPO_ROOT = Path(__file__).resolve().parent.parent


def validate_frames(frames_root: Path) -> list[Path]:
    shot_dirs: list[Path] = []
    for shot_index, seconds in enumerate(SHOT_SECONDS):
        shot_dir = frames_root / f"shot{shot_index}"
        expected_count = seconds * FPS
        expected_names = [f"{number:04d}.jpg" for number in range(expected_count)]
        if not shot_dir.is_dir():
            raise ValueError(f"missing frame directory: {shot_dir}")

        actual_names = sorted(path.name for path in shot_dir.glob("*.jpg"))
        if actual_names != expected_names:
            missing = sorted(set(expected_names) - set(actual_names))
            extra = sorted(set(actual_names) - set(expected_names))
            details = []
            if missing:
                details.append(f"missing {len(missing)} (first: {missing[0]})")
            if extra:
                details.append(f"extra {len(extra)} (first: {extra[0]})")
            raise ValueError(
                f"shot{shot_index}: expected {expected_count} contiguous frames; "
                + ", ".join(details)
            )

        for name in expected_names:
            frame = shot_dir / name
            try:
                with Image.open(frame) as image:
                    if image.size != SIZE:
                        raise ValueError(
                            f"{frame}: expected {SIZE[0]}x{SIZE[1]}, "
                            f"found {image.size[0]}x{image.size[1]}"
                        )
                    image.verify()
            except (OSError, SyntaxError) as error:
                raise ValueError(f"invalid JPEG {frame}: {error}") from error

        print(f"validated shot{shot_index}: {expected_count} frames ({seconds}s)")
        shot_dirs.append(shot_dir)
    return shot_dirs


def validate_audio(audio_path: Path) -> None:
    if not audio_path.is_file():
        raise ValueError(f"missing soundtrack: {audio_path}")
    with wave.open(str(audio_path), "rb") as audio:
        channels = audio.getnchannels()
        sample_rate = audio.getframerate()
        frames = audio.getnframes()
        sample_width = audio.getsampwidth()
    duration = frames / sample_rate
    if channels != 2 or sample_rate != 48_000 or sample_width != 2:
        raise ValueError(
            f"soundtrack must be stereo 48 kHz PCM16; found "
            f"{channels}ch, {sample_rate} Hz, {sample_width * 8}-bit"
        )
    if frames != TOTAL_SECONDS * sample_rate:
        raise ValueError(f"soundtrack must be exactly {TOTAL_SECONDS}s; found {duration:.6f}s")
    print(f"validated audio: {duration:.3f}s, stereo 48 kHz PCM16")


def validate_ffmpeg(ffmpeg: Path) -> str:
    if not ffmpeg.is_file():
        raise ValueError(f"FFmpeg not found: {ffmpeg}")
    probe = subprocess.run(
        [str(ffmpeg), "-hide_banner", "-encoders"],
        check=True,
        capture_output=True,
        text=True,
    )
    if " aac " not in probe.stdout:
        raise ValueError(f"{ffmpeg} does not include the AAC encoder")
    if " libx264 " in probe.stdout:
        print("video encoder: libx264, CRF 17, preset medium")
        return "libx264"
    if " libopenh264 " in probe.stdout:
        print("video encoder: libopenh264, 24 Mbps high profile")
        return "libopenh264"
    raise ValueError(f"{ffmpeg} has neither libx264 nor libopenh264")


def build_command(
    ffmpeg: Path,
    video_encoder: str,
    shot_dirs: list[Path],
    audio_path: Path,
    temporary_output: Path,
) -> list[str]:
    command = [
        str(ffmpeg),
        "-hide_banner",
        "-y",
        "-filter_threads",
        "4",
        "-filter_complex_threads",
        "4",
    ]
    for shot_dir in shot_dirs:
        command.extend(
            [
                "-framerate",
                str(FPS),
                "-start_number",
                "0",
                "-threads",
                "4",
                "-i",
                str(shot_dir / "%04d.jpg"),
            ]
        )
    command.extend(["-i", str(audio_path)])

    normalized = [f"[{index}:v]setpts=PTS-STARTPTS,fps={FPS}[s{index}]" for index in range(8)]
    streams = "".join(f"[s{index}]" for index in range(8))
    concat = (
        f"{streams}concat=n=8:v=1:a=0,"
        "fade=t=in:st=0:d=1.2,fade=t=out:st=46.8:d=1.2,"
        "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p[v]"
    )
    command.extend(["-filter_complex", ";".join(normalized + [concat]), "-map", "[v]", "-map", "8:a:0"])
    if video_encoder == "libx264":
        command.extend(["-c:v", "libx264", "-preset", "medium", "-crf", "17"])
    else:
        command.extend(
            [
                "-c:v",
                "libopenh264",
                "-b:v",
                "24M",
                "-maxrate",
                "32M",
                "-bufsize",
                "48M",
                "-profile:v",
                "high",
                "-coder",
                "cabac",
                "-rc_mode",
                "bitrate",
            ]
        )
    command.extend(
        [
            "-pix_fmt",
            "yuv420p",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-colorspace",
            "bt709",
            "-c:a",
            "aac",
            "-b:a",
            "320k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-t",
            str(TOTAL_SECONDS),
            "-movflags",
            "+faststart",
            "-threads",
            "4",
            str(temporary_output),
        ]
    )
    return command


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate inputs without encoding")
    parser.add_argument("--ffmpeg", type=Path, default=DEFAULT_FFMPEG)
    parser.add_argument("--frames", type=Path, default=REPO_ROOT / "output/trailer/frames")
    parser.add_argument(
        "--audio", type=Path, default=REPO_ROOT / "output/trailer/cyberbase-ambience.wav"
    )
    parser.add_argument(
        "--output", type=Path, default=REPO_ROOT / "output/trailer/CyberBase-Nightfall-1080p.mp4"
    )
    args = parser.parse_args()

    try:
        shot_dirs = validate_frames(args.frames.resolve())
        validate_audio(args.audio.resolve())
        if args.check:
            print(f"all inputs ready: {TOTAL_SECONDS}s, {FPS} fps, {SIZE[0]}x{SIZE[1]}")
            return 0
        video_encoder = validate_ffmpeg(args.ffmpeg.resolve())

        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary_output = output.with_name(f".{output.stem}.encoding{output.suffix}")
        if temporary_output.exists():
            temporary_output.unlink()
        print("encoding one-generation H.264 master with eight hard-cut image sequences")
        subprocess.run(
            build_command(
                args.ffmpeg.resolve(),
                video_encoder,
                shot_dirs,
                args.audio.resolve(),
                temporary_output,
            ),
            check=True,
        )
        os.replace(temporary_output, output)
        print(f"wrote {output}")
        return 0
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
