from __future__ import annotations
import json
import os
import subprocess
from dataclasses import dataclass
from typing import Optional, Dict, Any
from ..bin_paths import ffprobe_path, subprocess_creation_flags

MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB limit

@dataclass
class AudioMetadata:
    duration_ms: int
    duration_seconds: float
    channels: int
    sample_rate: int
    codec: str
    format_name: str
    size_bytes: int
    bit_rate: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "duration_ms": self.duration_ms,
            "duration_seconds": self.duration_seconds,
            "channels": self.channels,
            "sample_rate": self.sample_rate,
            "codec": self.codec,
            "format_name": self.format_name,
            "size_bytes": self.size_bytes,
            "bit_rate": self.bit_rate,
        }

def inspect_audio(file_path: str) -> AudioMetadata:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")
    if not os.path.isfile(file_path):
        raise ValueError(f"Path is not a regular file: {file_path}")

    size = os.path.getsize(file_path)
    if size == 0:
        raise ValueError("Audio file is empty (0 bytes)")
    if size > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"Audio file exceeds maximum size limit of {MAX_FILE_SIZE_BYTES} bytes")

    cmd = [
        ffprobe_path(),
        "-v", "error",
        "-show_entries", "format=duration,size,bit_rate,format_name:stream=codec_name,sample_rate,channels",
        "-of", "json",
        file_path,
    ]

    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=True,
            creationflags=subprocess_creation_flags(),
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffprobe failed to inspect file: {e.stderr.strip()}") from e
    except subprocess.TimeoutExpired as e:
        raise TimeoutError("ffprobe inspection timed out") from e

    try:
        data = json.loads(res.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError("ffprobe returned invalid JSON output") from e

    fmt = data.get("format", {})
    streams = data.get("streams", [])
    audio_stream = next((s for s in streams if s.get("codec_name")), streams[0] if streams else {})

    duration_sec = float(fmt.get("duration") or audio_stream.get("duration") or 0.0)
    if duration_sec <= 0.0:
        raise ValueError("Could not determine valid positive duration for audio file")

    duration_ms = int(round(duration_sec * 1000))
    channels = int(audio_stream.get("channels") or 1)
    sample_rate = int(audio_stream.get("sample_rate") or 16000)
    codec = str(audio_stream.get("codec_name") or "unknown")
    format_name = str(fmt.get("format_name") or "unknown")
    bit_rate = int(fmt.get("bit_rate")) if fmt.get("bit_rate") else None

    return AudioMetadata(
        duration_ms=duration_ms,
        duration_seconds=duration_sec,
        channels=channels,
        sample_rate=sample_rate,
        codec=codec,
        format_name=format_name,
        size_bytes=size,
        bit_rate=bit_rate,
    )
