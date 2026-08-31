"""Resolves paths to external binaries (ffmpeg/ffprobe) the worker shells out to.

On Windows, the desktop build bundles its own ffmpeg/ffprobe binaries so the
app works without a system install. The Tauri host process sets
`DIWAN_FFMPEG_PATH` / `DIWAN_FFPROBE_PATH` environment variables to the
absolute bundled binary paths before spawning the worker; everywhere else
(dev sandbox, Linux/macOS, or a Windows dev machine with no bundled
binaries) these env vars are unset and we fall back to the bare command
name, resolved via PATH exactly as before.

Always import `ffmpeg_path()` / `ffprobe_path()` here instead of hardcoding
"ffmpeg"/"ffprobe" literals, so every call site benefits from bundled-path
resolution automatically.
"""
from __future__ import annotations
import os
from typing import Optional


def ffmpeg_path() -> str:
    return os.environ.get("DIWAN_FFMPEG_PATH") or "ffmpeg"


def ffprobe_path() -> str:
    return os.environ.get("DIWAN_FFPROBE_PATH") or "ffprobe"


def ffmpeg_dir() -> Optional[str]:
    """Directory containing the bundled ffmpeg/ffprobe binaries, if any.

    Used for yt-dlp's `ffmpeg_location` option so its own postprocessors
    (audio extraction/remux) also use the bundled binaries on Windows
    instead of searching PATH.
    """
    p = os.environ.get("DIWAN_FFMPEG_PATH")
    return os.path.dirname(p) if p else None
