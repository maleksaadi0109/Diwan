from __future__ import annotations
import os
import sys
import shutil
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from diwan_worker.audio.youtube import (
    validate_and_normalize_youtube_url,
    fetch_youtube_video_info,
    download_youtube_audio,
    cancel_youtube_job,
    map_ytdlp_exception_to_error,
    ERROR_MESSAGES_AR,
)


def test_validate_and_normalize_url_normal_watch():
    u = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert validate_and_normalize_youtube_url(u) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_validate_and_normalize_url_youtu_be():
    u = "https://youtu.be/dQw4w9WgXcQ"
    assert validate_and_normalize_youtube_url(u) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_validate_and_normalize_url_music():
    u = "https://music.youtube.com/watch?v=dQw4w9WgXcQ"
    assert validate_and_normalize_youtube_url(u) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_validate_and_normalize_url_with_playlist_params():
    # Watch URL containing both v and list parameters must preserve the video ID
    u = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAl_oo6NvlT0_09eGf9bH-L_WJkQp7XU&index=3"
    assert validate_and_normalize_youtube_url(u) == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_validate_and_normalize_url_invalid():
    # Empty
    with pytest.raises(ValueError, match="الرابط المدخل فارغ"):
        validate_and_normalize_youtube_url("")

    # Non-HTTPS
    with pytest.raises(ValueError, match="HTTPS required"):
        validate_and_normalize_youtube_url("http://www.youtube.com/watch?v=dQw4w9WgXcQ")

    # Invalid Domain
    with pytest.raises(ValueError, match="اسم النطاق غير مدعوم"):
        validate_and_normalize_youtube_url("https://vimeo.com/12345678")

    # Pure playlist
    with pytest.raises(ValueError, match="قوائم التشغيل"):
        validate_and_normalize_youtube_url("https://www.youtube.com/playlist?list=PLrAl_oo6NvlT0")


def test_error_mapping_dictionary():
    assert "YTDLP_NOT_INSTALLED" in ERROR_MESSAGES_AR
    assert "FFMPEG_NOT_FOUND" in ERROR_MESSAGES_AR
    assert "VIDEO_UNAVAILABLE" in ERROR_MESSAGES_AR
    assert "PRIVATE_VIDEO" in ERROR_MESSAGES_AR
    assert "LOGIN_REQUIRED" in ERROR_MESSAGES_AR
    assert "LIVE_STREAM_NOT_SUPPORTED" in ERROR_MESSAGES_AR
    assert "NO_AUDIO_FORMAT" in ERROR_MESSAGES_AR
    assert "DOWNLOAD_FAILED" in ERROR_MESSAGES_AR
    assert "CONVERSION_FAILED" in ERROR_MESSAGES_AR
    assert "OUTPUT_MISSING" in ERROR_MESSAGES_AR
    assert "NETWORK_TIMEOUT" in ERROR_MESSAGES_AR
    assert "FILESYSTEM_ERROR" in ERROR_MESSAGES_AR

    code, _ = map_ytdlp_exception_to_error(Exception("Private video. Sign in if you've been granted access"))
    assert code == "PRIVATE_VIDEO"

    code2, _ = map_ytdlp_exception_to_error(Exception("Sign in to confirm you’re not a bot"))
    assert code2 == "LOGIN_REQUIRED"

    code3, _ = map_ytdlp_exception_to_error(Exception("Video unavailable: This video has been removed"))
    assert code3 == "VIDEO_UNAVAILABLE"


def test_fetch_metadata_mocked():
    mock_info = {
        "id": "dQw4w9WgXcQ",
        "title": "قصيدة أراك عصي الدمع",
        "uploader": "ديوان الشعر",
        "duration": 240,
        "thumbnail": "https://example.com/thumb.jpg",
        "description": "تسجيل تراثي",
    }

    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.return_value = mock_info

        info = fetch_youtube_video_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert info["video_id"] == "dQw4w9WgXcQ"
        assert info["title"] == "قصيدة أراك عصي الدمع"
        assert info["duration_seconds"] == 240
        assert info["duration_ms"] == 240000
        assert info["channel"] == "ديوان الشعر"


def test_fetch_metadata_reject_live_stream():
    mock_info = {
        "id": "live12345",
        "title": "بث مباشر للشعر",
        "is_live": True,
        "duration": None,
    }

    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.return_value = mock_info

        with pytest.raises(RuntimeError, match="LIVE_STREAM_NOT_SUPPORTED"):
            fetch_youtube_video_info("https://www.youtube.com/watch?v=live12345")


def test_download_audio_raw_webm(tmp_path: Path):
    """Tests two-stage workflow where yt-dlp outputs a raw .webm audio file."""
    output_dir = tmp_path / "recordings"

    def mock_extract(url, download=True):
        # Create mock source.webm inside raw/
        raw_dir = output_dir / "job_webm" / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        # Create a real small WAV file with webm extension for ffmpeg inspection
        wav_path = raw_dir / "source.webm"
        _create_dummy_wav(wav_path)
        return {"id": "test_id"}

    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.side_effect = mock_extract

        res = download_youtube_audio(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            output_base_dir=str(output_dir),
            job_id="job_webm",
            audio_quality="192k",
        )

        assert res["raw_format"] == "webm"
        assert os.path.exists(res["playback_audio_path"])
        assert os.path.exists(res["processing_audio_path"])
        assert res["playback_audio_path"].endswith("playback.mp3")
        assert res["processing_audio_path"].endswith("processing.wav")


def test_download_audio_raw_m4a(tmp_path: Path):
    """Tests two-stage workflow where yt-dlp outputs a raw .m4a audio file."""
    output_dir = tmp_path / "recordings"

    def mock_extract(url, download=True):
        raw_dir = output_dir / "job_m4a" / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        wav_path = raw_dir / "source.m4a"
        _create_dummy_wav(wav_path)
        return {"id": "test_id"}

    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.side_effect = mock_extract

        res = download_youtube_audio(
            url="https://youtu.be/dQw4w9WgXcQ",
            output_base_dir=str(output_dir),
            job_id="job_m4a",
            audio_quality="128k",
        )

        assert res["raw_format"] == "m4a"
        assert os.path.exists(res["playback_audio_path"])
        assert os.path.exists(res["processing_audio_path"])


def test_download_audio_with_arabic_path_and_spaces(tmp_path: Path):
    """Tests download into directories containing spaces and Arabic unicode characters."""
    output_dir = tmp_path / "مجلد التطبيق ديوان" / "تسجيلات 2026"

    def mock_extract(url, download=True):
        raw_dir = output_dir / "job_arabic" / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        wav_path = raw_dir / "source.opus"
        _create_dummy_wav(wav_path)
        return {"id": "test_id"}

    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.side_effect = mock_extract

        res = download_youtube_audio(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            output_base_dir=str(output_dir),
            job_id="job_arabic",
        )

        assert os.path.exists(res["playback_audio_path"])
        assert os.path.exists(res["processing_audio_path"])


def test_download_audio_conversion_failure_preserves_raw_file(tmp_path: Path):
    """If ffmpeg conversion fails, the downloaded raw audio must be preserved (Section 8)."""
    output_dir = tmp_path / "recordings"

    def mock_extract(url, download=True):
        raw_dir = output_dir / "job_conv_fail" / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        wav_path = raw_dir / "source.webm"
        _create_dummy_wav(wav_path)
        return {"id": "test_id"}

    import subprocess as real_subprocess
    orig_run = real_subprocess.run

    def mock_run_fn(cmd, *args, **kwargs):
        if len(cmd) > 0 and cmd[0] == "ffmpeg":
            return MagicMock(returncode=1, stderr="Mocked FFmpeg conversion error")
        return orig_run(cmd, *args, **kwargs)

    with patch("yt_dlp.YoutubeDL") as mock_ydl, patch("subprocess.run", side_effect=mock_run_fn):
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.side_effect = mock_extract

        with pytest.raises(RuntimeError, match="CONVERSION_FAILED"):
            download_youtube_audio(
                url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                output_base_dir=str(output_dir),
                job_id="job_conv_fail",
            )

        raw_file = output_dir / "job_conv_fail" / "raw" / "source.webm"
        assert raw_file.exists()


def _create_dummy_wav(path: Path) -> None:
    """Helper to generate a valid minimal 1-second 16kHz mono WAV file."""
    import wave
    import struct
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        # 1 second of silent samples
        data = struct.pack("<16000h", *([0] * 16000))
        wf.writeframes(data)
