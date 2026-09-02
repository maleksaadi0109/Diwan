from __future__ import annotations
import os
import sys
import shutil
import math
import struct
import wave
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
    trim_leading_silence,
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


def test_error_mapping_cookies_invalid_when_cookies_supplied():
    # A login/age-restriction failure with no cookies supplied is a normal LOGIN_REQUIRED
    code, _ = map_ytdlp_exception_to_error(Exception("Sign in to confirm you're not a bot"))
    assert code == "LOGIN_REQUIRED"

    # The same failure after cookies were already supplied means the cookies
    # themselves are invalid/expired, not that login is simply unsupported.
    code2, _ = map_ytdlp_exception_to_error(
        Exception("Sign in to confirm you're not a bot"), had_cookies=True
    )
    assert code2 == "COOKIES_INVALID"
    assert "COOKIES_INVALID" in ERROR_MESSAGES_AR


def test_fetch_metadata_with_cookies_writes_and_cleans_up_cookiefile():
    """cookies_content should be written to a temp cookiefile passed to yt-dlp,
    and the temp file must be removed after the call regardless of outcome."""
    mock_info = {
        "id": "dQw4w9WgXcQ",
        "title": "قصيدة",
        "uploader": "قناة",
        "duration": 120,
    }

    captured_opts = {}

    def fake_ydl(opts):
        captured_opts.update(opts)
        instance = MagicMock()
        instance.extract_info.return_value = mock_info
        instance.__enter__.return_value = instance
        instance.__exit__.return_value = False
        return instance

    with patch("yt_dlp.YoutubeDL", side_effect=fake_ydl):
        fetch_youtube_video_info(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            cookies_content="# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tNAME\tvalue\n",
        )

    assert "cookiefile" in captured_opts
    cookiefile_path = captured_opts["cookiefile"]
    # The temp cookiefile must be cleaned up after the call
    assert not os.path.exists(cookiefile_path)


def test_fetch_metadata_without_cookies_has_no_cookiefile():
    mock_info = {"id": "abc", "title": "t", "duration": 10}
    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.return_value = mock_info
        fetch_youtube_video_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        opts_arg = mock_ydl.call_args[0][0]
        assert "cookiefile" not in opts_arg


def test_fetch_metadata_with_emojis_and_unicode():
    """Verify video title with emoji \U0001f31f (🌟) and Arabic is safely parsed and returned."""
    mock_info = {
        "id": "dQw4w9WgXcQ",
        "title": "🌟 قصيدة المتنبي \U0001f31f بصوت رائع 🎵",
        "uploader": "قناة الأدب العربي 📚",
        "duration": 180,
        "description": "وصف الفيديو مع إيموجي ✨",
    }
    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.return_value = mock_info
        res = fetch_youtube_video_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert "🌟" in res["title"]
        assert "\U0001f31f" in res["title"]
        assert "📚" in res["channel"]
        assert res["duration_seconds"] == 180



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


def test_trim_leading_silence_uses_same_offset_for_playback_and_alignment(tmp_path: Path):
    """A long intro is removed from both outputs with one shared offset."""
    from unittest.mock import call
    import diwan_worker.audio.youtube as youtube

    processing = tmp_path / "processing.wav"
    playback = tmp_path / "playback.mp3"
    temp_dir = tmp_path / "temp"

    sample_rate = 16000
    silence_samples = sample_rate * 2
    speech_samples = sample_rate
    samples = [0] * silence_samples
    samples.extend(
        int(12000 * math.sin(2 * math.pi * 350 * i / sample_rate))
        for i in range(speech_samples)
    )
    with wave.open(str(processing), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    playback.write_bytes(b"source-mp3-placeholder")

    calls = []

    def fake_trim(input_path, output_path, trim_ms, **kwargs):
        calls.append((input_path, output_path, trim_ms, kwargs["playback"]))
        shutil.copyfile(input_path, output_path)

    # The playback file is a placeholder (not real audio), so ffprobe can't
    # read its duration. Mock inspect_audio for the sanity check added to
    # trim_leading_silence: report a duration consistent with the expected
    # 1920ms trim so the check passes and doesn't mask the real assertion
    # this test is after (offset propagation to both outputs).
    from diwan_worker.audio.inspector import AudioMetadata

    def fake_inspect(path):
        common = dict(channels=1, sample_rate=44100, codec="mp3", format_name="mp3", size_bytes=1000)
        if "trimmed" in str(path):
            return AudioMetadata(duration_ms=1080, duration_seconds=1.08, **common)
        return AudioMetadata(duration_ms=3000, duration_seconds=3.0, **common)

    with patch.object(youtube, "_trim_file_from_ms", side_effect=fake_trim), patch.object(
        youtube, "inspect_audio", side_effect=fake_inspect
    ):
        removed_ms = trim_leading_silence(playback, processing, temp_dir)

    # VAD frames begin speech at 2000ms; the configured 80ms safety margin is
    # retained, so both files use the same 1920ms cut.
    assert removed_ms == 1920
    assert [c[2] for c in calls] == [1920, 1920]
    assert [c[3] for c in calls] == [True, False]
    assert playback.read_bytes() == b"source-mp3-placeholder"


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
        if len(cmd) > 0 and ("ffmpeg" in str(cmd[0]).lower()):
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
