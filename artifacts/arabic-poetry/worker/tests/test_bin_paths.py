import os
import pytest
from diwan_worker.bin_paths import ffmpeg_path, ffprobe_path, ffmpeg_dir


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("DIWAN_FFMPEG_PATH", raising=False)
    monkeypatch.delenv("DIWAN_FFPROBE_PATH", raising=False)


def test_defaults_to_bare_command_names():
    assert ffmpeg_path() == "ffmpeg"
    assert ffprobe_path() == "ffprobe"
    assert ffmpeg_dir() is None


def test_uses_bundled_paths_when_env_vars_set(monkeypatch, tmp_path):
    bundled_ffmpeg = tmp_path / "bin" / "ffmpeg.exe"
    bundled_ffprobe = tmp_path / "bin" / "ffprobe.exe"
    monkeypatch.setenv("DIWAN_FFMPEG_PATH", str(bundled_ffmpeg))
    monkeypatch.setenv("DIWAN_FFPROBE_PATH", str(bundled_ffprobe))

    assert ffmpeg_path() == str(bundled_ffmpeg)
    assert ffprobe_path() == str(bundled_ffprobe)
    assert ffmpeg_dir() == str(bundled_ffmpeg.parent)


def test_ignores_empty_string_env_vars(monkeypatch):
    monkeypatch.setenv("DIWAN_FFMPEG_PATH", "")
    monkeypatch.setenv("DIWAN_FFPROBE_PATH", "")

    assert ffmpeg_path() == "ffmpeg"
    assert ffprobe_path() == "ffprobe"
    assert ffmpeg_dir() is None
