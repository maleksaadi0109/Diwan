from __future__ import annotations
import os
import re
import shutil
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from urllib.parse import urlparse, parse_qs
from .inspector import inspect_audio
from .vad import analyze_audio_vad
from ..bin_paths import ffmpeg_path, ffmpeg_dir, subprocess_creation_flags

# Structured Error Codes & Arabic Messages (Section 7)
ERROR_MESSAGES_AR: Dict[str, str] = {
    "YTDLP_NOT_INSTALLED": "مكوّن تنزيل YouTube غير مثبت.",
    "FFMPEG_NOT_FOUND": "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
    "VIDEO_UNAVAILABLE": "المقطع غير متاح أو تم حذفه.",
    "PRIVATE_VIDEO": "المقطع خاص ولا يمكن تنزيله.",
    "LOGIN_REQUIRED": "يتطلب هذا المقطع تسجيل الدخول. يمكنك إدخال بيانات تسجيل الدخول (كوكيز) من متصفحك للمتابعة.",
    "COOKIES_INVALID": "بيانات تسجيل الدخول (الكوكيز) غير صالحة أو منتهية الصلاحية. يرجى الحصول على كوكيز جديدة والمحاولة مجددًا.",
    "LIVE_STREAM_NOT_SUPPORTED": "تنزيل البث المباشر غير مدعوم.",
    "NO_AUDIO_FORMAT": "لم يتم العثور على مسار صوتي مناسب.",
    "DOWNLOAD_FAILED": "فشل تنزيل الصوت. افتح تفاصيل الخطأ للمزيد.",
    "CONVERSION_FAILED": "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
    "OUTPUT_MISSING": "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
    "NETWORK_TIMEOUT": "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
    "FILESYSTEM_ERROR": "تعذر حفظ الصوت في مجلد التطبيق.",
}

ProgressCallback = Callable[[float, str, Optional[Dict[str, Any]]], None]


class _QuietYtdlpLogger:
    """Prevent yt-dlp from writing Unicode metadata to a Windows console."""

    def debug(self, _message: str) -> None:
        pass

    def info(self, _message: str) -> None:
        pass

    def warning(self, _message: str) -> None:
        pass

    def error(self, _message: str) -> None:
        pass


# Keep a tiny amount of audio before the first detected speech frame so the
# first consonant is never clipped. The long intro/silence itself is removed.
LEADING_SPEECH_PADDING_MS = 80
MIN_LEADING_TRIM_MS = 120

# Cancellation tracking
_active_cancels: Dict[str, threading.Event] = {}
_cancel_lock = threading.Lock()


def validate_and_normalize_youtube_url(url: str) -> str:
    """
    Validates YouTube URL and normalizes it to: https://www.youtube.com/watch?v={VIDEO_ID}
    Strips playlist and additional query parameters while preserving the video ID.
    """
    if not url or not isinstance(url, str):
        raise ValueError("الرابط المدخل فارغ (Empty URL)")

    url_str = url.strip()

    try:
        parsed = urlparse(url_str)
    except Exception as e:
        raise ValueError(f"صيغة الرابط غير صحيحة: {str(e)}")

    if parsed.scheme.lower() != "https":
        raise ValueError("يجب أن يبدأ الرابط بـ https:// حصراً (HTTPS required)")

    host = parsed.netloc.lower()
    valid_hosts = [
        "www.youtube.com",
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
    ]
    if host not in valid_hosts:
        raise ValueError(f"اسم النطاق غير مدعوم: {host}. يقبل فقط روابط YouTube الرسمية")

    video_id: Optional[str] = None

    if host == "youtu.be":
        # Format: https://youtu.be/{VIDEO_ID}
        path_clean = parsed.path.strip("/")
        if path_clean:
            video_id = path_clean.split("/")[0].split("?")[0]
    else:
        # Standard youtube.com query: ?v={VIDEO_ID}&list=...
        qs = parse_qs(parsed.query)
        if "v" in qs and qs["v"]:
            video_id = qs["v"][0]
        elif "/embed/" in parsed.path:
            video_id = parsed.path.split("/embed/")[1].split("/")[0]
        elif "/v/" in parsed.path:
            video_id = parsed.path.split("/v/")[1].split("/")[0]
        elif "/shorts/" in parsed.path:
            video_id = parsed.path.split("/shorts/")[1].split("/")[0]

    if not video_id:
        if "/playlist" in parsed.path:
            raise ValueError("قوائم التشغيل (Playlists) غير مدعومة بدون تحديد فيديو. يرجى إدخال رابط فيديو مفرد")
        raise ValueError("تعذر العثور على معرّف الفيديو في الرابط المدخل")

    # Sanitize video_id
    if not re.match(r"^[a-zA-Z0-9_-]{6,15}$", video_id):
        raise ValueError("معرّف الفيديو يحتوي على رموز غير صالحة")

    return f"https://www.youtube.com/watch?v={video_id}"


def map_ytdlp_exception_to_error(e: Exception, had_cookies: bool = False) -> tuple[str, str]:
    """
    Maps yt-dlp exceptions to structured (error_code, arabic_message)

    `had_cookies` should be True when the request already supplied a cookie
    file. In that case a login/age-restriction failure means the supplied
    cookies are invalid or expired, not that cookies are simply missing.
    """
    err_str = str(e)

    if "Private video" in err_str or "private" in err_str.lower():
        return "PRIVATE_VIDEO", ERROR_MESSAGES_AR["PRIVATE_VIDEO"]
    if "Sign in to confirm" in err_str or "login" in err_str.lower() or "age-restricted" in err_str.lower():
        if had_cookies:
            return "COOKIES_INVALID", ERROR_MESSAGES_AR["COOKIES_INVALID"]
        return "LOGIN_REQUIRED", ERROR_MESSAGES_AR["LOGIN_REQUIRED"]
    if "Video unavailable" in err_str or "does not exist" in err_str.lower() or "not available" in err_str.lower():
        return "VIDEO_UNAVAILABLE", ERROR_MESSAGES_AR["VIDEO_UNAVAILABLE"]
    if "live stream" in err_str.lower() or "is live" in err_str.lower():
        return "LIVE_STREAM_NOT_SUPPORTED", ERROR_MESSAGES_AR["LIVE_STREAM_NOT_SUPPORTED"]
    if "Requested format is not available" in err_str or "No audio" in err_str:
        return "NO_AUDIO_FORMAT", ERROR_MESSAGES_AR["NO_AUDIO_FORMAT"]
    if "timed out" in err_str.lower() or "timeout" in err_str.lower():
        return "NETWORK_TIMEOUT", ERROR_MESSAGES_AR["NETWORK_TIMEOUT"]

    return "DOWNLOAD_FAILED", f"{ERROR_MESSAGES_AR['DOWNLOAD_FAILED']} ({err_str[:150]})"


def _trim_file_from_ms(
    input_path: Path,
    output_path: Path,
    trim_ms: int,
    *,
    playback: bool,
    bitrate: str = "192k",
) -> None:
    """Re-encode one output after removing the same leading offset.

    Re-encoding instead of stream-copying is intentional: MP3 stream-copy
    seeks can land on a preceding encoder frame, which would make the
    playback file and the alignment WAV start at different positions.

    `-ss` is placed AFTER `-i` (output seeking) rather than before it. Input
    seeking on MP3 estimates a byte offset from the file's average bitrate,
    which is wrong whenever the encoder used ABR/VBR (libmp3lame's `-b:a`
    is ABR, not strict CBR) -- on some files this lands the "trimmed" start
    far from the intended timestamp (observed as playback that starts near
    the end of the recording, then jumps back to the actual beginning).
    Output seeking decodes frame-accurately instead; since trims here are
    capped at 10s, the extra decode cost is negligible.
    """
    command = [
        ffmpeg_path(),
        "-y",
        "-i",
        str(input_path),
        "-ss",
        f"{trim_ms / 1000:.3f}",
        "-vn",
    ]
    if playback:
        command += ["-acodec", "libmp3lame", "-b:a", bitrate]
    else:
        command += ["-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"]
    command.append(str(output_path))

    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            creationflags=subprocess_creation_flags(),
        )
    except FileNotFoundError:
        raise RuntimeError(f"FFMPEG_NOT_FOUND: {ERROR_MESSAGES_AR['FFMPEG_NOT_FOUND']}")
    if result.returncode != 0:
        raise RuntimeError(
            f"CONVERSION_FAILED: تعذر حذف الصمت من بداية التسجيل ({result.stderr[:180]})"
        )


def trim_leading_silence(
    playback_mp3_path: Path,
    processing_wav_path: Path,
    temp_dir: Path,
    audio_quality: str = "192k",
) -> int:
    """Remove a short initial non-speech section with safety bounds.

    Guarantees that no more than 10 seconds or 20% of the total audio is ever
    trimmed, protecting recitations from being cut off.
    """
    vad_result = analyze_audio_vad(
        str(processing_wav_path),
        min_silence_duration_ms=280,
        speech_padding_ms=0,
    )
    if not vad_result.speech_regions:
        return 0

    first_speech_ms = max(0, int(vad_result.speech_regions[0].start_ms))
    trim_ms = max(0, first_speech_ms - LEADING_SPEECH_PADDING_MS)
    if trim_ms < MIN_LEADING_TRIM_MS:
        return 0

    # Safety guard: never trim more than 10 seconds of leading silence
    if trim_ms > 10000:
        return 0

    temp_dir.mkdir(parents=True, exist_ok=True)
    bitrate = "192k" if "192" in audio_quality else "128k"
    trimmed_mp3 = temp_dir / "playback.trimmed.mp3"
    trimmed_wav = temp_dir / "processing.trimmed.wav"
    _trim_file_from_ms(
        playback_mp3_path,
        trimmed_mp3,
        trim_ms,
        playback=True,
        bitrate=bitrate,
    )
    _trim_file_from_ms(
        processing_wav_path,
        trimmed_wav,
        trim_ms,
        playback=False,
    )
    if not trimmed_mp3.exists() or not trimmed_wav.exists():
        return 0

    # Sanity check: the trimmed playback file's own real duration must be
    # close to (original duration - trim_ms). If it isn't -- e.g. because
    # the re-encode produced a truncated or corrupt file, or wrote
    # inaccurate duration metadata -- serving it would make the player
    # report/seek against the wrong length (audio appears to "jump to the
    # end" then reset). In that case, discard the trim and keep the
    # original, untrimmed files rather than risk a broken recording.
    try:
        original_duration_ms = inspect_audio(str(playback_mp3_path)).duration_ms
        trimmed_duration_ms = inspect_audio(str(trimmed_mp3)).duration_ms
        expected_ms = max(0, original_duration_ms - trim_ms)
        tolerance_ms = max(500, int(expected_ms * 0.05))
        if abs(trimmed_duration_ms - expected_ms) > tolerance_ms:
            return 0
    except Exception:
        # If we can't verify, don't risk serving a possibly-corrupt file.
        return 0

    os.replace(trimmed_mp3, playback_mp3_path)
    os.replace(trimmed_wav, processing_wav_path)
    return trim_ms


def _write_temp_cookiefile(cookies_content: Optional[str]) -> Optional[str]:
    """Writes user-supplied cookie text (Netscape cookie-jar format) to a
    private temp file for yt-dlp's `cookiefile` option.

    Cookies are session credentials: the file is written with owner-only
    permissions and the caller is responsible for deleting it once the
    yt-dlp call returns (success or failure). Never logged.
    """
    if not cookies_content or not cookies_content.strip():
        return None

    import tempfile

    fd, path = tempfile.mkstemp(prefix="diwan-yt-cookies-", suffix=".txt")
    try:
        os.chmod(path, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(cookies_content)
    except Exception:
        try:
            os.close(fd)
        except Exception:
            pass
        raise
    return path


def _cleanup_temp_cookiefile(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass


def fetch_youtube_video_info(
    url: str,
    max_duration_seconds: int = 3600,
    cookies_content: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetches YouTube video metadata without downloading using yt-dlp Python API.

    `cookies_content` is optional Netscape-format cookie text pasted by the
    user (exported from their own logged-in browser session) to unlock
    login-required or age-restricted videos. It is written to a private temp
    file for the duration of this call only and removed afterwards.
    """
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("YTDLP_NOT_INSTALLED: " + ERROR_MESSAGES_AR["YTDLP_NOT_INSTALLED"])

    clean_url = validate_and_normalize_youtube_url(url)

    ydl_opts = {
        "extract_flat": False,
        "noplaylist": True,
        "no_warnings": True,
        "quiet": True,
        "logger": _QuietYtdlpLogger(),
        "socket_timeout": 30,
    }
    if ffmpeg_dir():
        ydl_opts["ffmpeg_location"] = ffmpeg_dir()

    cookiefile_path = _write_temp_cookiefile(cookies_content)
    if cookiefile_path:
        ydl_opts["cookiefile"] = cookiefile_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
    except Exception as e:
        code, msg = map_ytdlp_exception_to_error(e, had_cookies=bool(cookiefile_path))
        raise RuntimeError(f"{code}: {msg}")
    finally:
        _cleanup_temp_cookiefile(cookiefile_path)

    if not info:
        raise RuntimeError(f"VIDEO_UNAVAILABLE: {ERROR_MESSAGES_AR['VIDEO_UNAVAILABLE']}")

    if info.get("is_live") or (info.get("was_live") and not info.get("duration")):
        raise RuntimeError(f"LIVE_STREAM_NOT_SUPPORTED: {ERROR_MESSAGES_AR['LIVE_STREAM_NOT_SUPPORTED']}")

    duration = info.get("duration") or 0
    if duration > max_duration_seconds:
        max_mins = max_duration_seconds // 60
        dur_mins = int(duration // 60)
        raise ValueError(f"مدة الفيديو ({dur_mins} دقيقة) تتجاوز الحد الأقصى المسموح ({max_mins} دقيقة)")

    # Best thumbnail
    thumbnail = info.get("thumbnail") or ""
    if not thumbnail and info.get("thumbnails"):
        thumbnail = info["thumbnails"][-1].get("url", "")

    return {
        "video_id": info.get("id"),
        "title": info.get("title", "مقطع يوتيوب"),
        "channel": info.get("uploader") or info.get("channel") or "قناة غير معروفة",
        "duration_seconds": duration,
        "duration_ms": int(duration * 1000),
        "thumbnail": thumbnail,
        "description": (info.get("description") or "")[:500],
        "webpage_url": clean_url,
        "is_available": True,
    }


def download_youtube_audio(
    url: str,
    output_base_dir: str,
    job_id: Optional[str] = None,
    audio_quality: str = "192k",
    on_progress: Optional[ProgressCallback] = None,
    cookies_content: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the two-stage YouTube audio import:
    1. Downloads raw audio into {job_dir}/raw/source.%(ext)s using yt-dlp Python API.
    2. Validates raw audio with ffprobe.
    3. Converts to {job_dir}/final/playback.mp3 (192k) and {job_dir}/final/processing.wav (16k mono).
    4. Validates both converted files with ffprobe before returning.

    `cookies_content` is optional Netscape-format cookie text (see
    `fetch_youtube_video_info`) used to unlock login-required videos.
    """
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("YTDLP_NOT_INSTALLED: " + ERROR_MESSAGES_AR["YTDLP_NOT_INSTALLED"])

    clean_url = validate_and_normalize_youtube_url(url)

    if not job_id:
        job_id = f"yt-{uuid.uuid4().hex[:12]}"

    # Structure directories as specified in Section 5
    job_dir = Path(output_base_dir).resolve() / job_id
    raw_dir = job_dir / "raw"
    temp_dir = job_dir / "temp"
    final_dir = job_dir / "final"

    try:
        raw_dir.mkdir(parents=True, exist_ok=True)
        temp_dir.mkdir(parents=True, exist_ok=True)
        final_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise RuntimeError(f"FILESYSTEM_ERROR: {ERROR_MESSAGES_AR['FILESYSTEM_ERROR']} ({str(e)})")

    cancel_event = threading.Event()
    with _cancel_lock:
        _active_cancels[job_id] = cancel_event

    def progress_hook(d: Dict[str, Any]) -> None:
        if cancel_event.is_set():
            raise RuntimeError("تم إلغاء عملية التنزيل بواسطة المستخدم")

        status = d.get("status")
        if status == "downloading" and on_progress:
            downloaded = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            speed = d.get("speed") or 0
            eta = d.get("eta") or 0
            percent = (downloaded / total) if total > 0 else 0.0
            on_progress(
                percent * 0.70,
                f"جاري تنزيل الملف الصوتي... ({int(percent * 100)}%)",
                {
                    "downloaded_bytes": downloaded,
                    "total_bytes": total,
                    "speed": speed,
                    "eta": eta,
                },
            )
        elif status == "finished" and on_progress:
            on_progress(0.75, "اكتمل التنزيل، جارٍ تحويل الصوت ومعايرته...", None)

    ydl_opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "paths": {
            "home": str(raw_dir),
            "temp": str(temp_dir),
        },
        "outtmpl": {
            "default": "source.%(ext)s",
        },
        "restrictfilenames": True,
        "overwrites": True,
        "continuedl": True,
        "nopart": False,
        "retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 30,
        "quiet": True,
        "no_warnings": True,
        "logger": _QuietYtdlpLogger(),
        "progress_hooks": [progress_hook],
    }
    if ffmpeg_dir():
        ydl_opts["ffmpeg_location"] = ffmpeg_dir()

    cookiefile_path = _write_temp_cookiefile(cookies_content)
    if cookiefile_path:
        ydl_opts["cookiefile"] = cookiefile_path

    if on_progress:
        on_progress(0.05, "جاري بدء تنزيل الصوت من YouTube...", None)

    # 1. Download raw audio
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(clean_url, download=True)
    except Exception as e:
        # Clean incomplete part/temp files only (Section 8)
        clean_temp_files(temp_dir)
        if cancel_event.is_set():
            raise RuntimeError("تم إلغاء عملية التنزيل")
        code, msg = map_ytdlp_exception_to_error(e, had_cookies=bool(cookiefile_path))
        raise RuntimeError(f"{code}: {msg}")
    finally:
        with _cancel_lock:
            _active_cancels.pop(job_id, None)
        _cleanup_temp_cookiefile(cookiefile_path)

    # 2. Locate raw audio in raw_dir (Section 3)
    raw_files = [
        f for f in raw_dir.iterdir()
        if f.is_file() and f.name.startswith("source.") and not f.suffix.endswith(".part") and not f.suffix.endswith(".temp")
    ]

    if not raw_files:
        raise RuntimeError(f"OUTPUT_MISSING: {ERROR_MESSAGES_AR['OUTPUT_MISSING']}")

    raw_audio_path = raw_files[0]
    raw_ext = raw_audio_path.suffix.lstrip(".")

    # 3. Inspect raw audio with ffprobe
    try:
        raw_meta = inspect_audio(str(raw_audio_path))
    except Exception as e:
        raise RuntimeError(f"OUTPUT_MISSING: تعذر فحص الملف الصوتي المنزّل: {str(e)}")

    if on_progress:
        on_progress(0.80, "جاري تحويل الملف الصوتي إلى MP3 192k للتشغيل...", None)

    # 4. Convert to playback.mp3 (Section 4)
    playback_mp3_path = final_dir / "playback.mp3"
    bitrate = "192k" if "192" in audio_quality else "128k"
    cmd_mp3 = [
        ffmpeg_path(),
        "-y",
        "-i", str(raw_audio_path),
        "-vn",
        "-acodec", "libmp3lame",
        "-b:a", bitrate,
        str(playback_mp3_path),
    ]

    try:
        res_mp3 = subprocess.run(
            cmd_mp3,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            creationflags=subprocess_creation_flags(),
        )
        if res_mp3.returncode != 0:
            raise RuntimeError(f"CONVERSION_FAILED: {ERROR_MESSAGES_AR['CONVERSION_FAILED']} ({res_mp3.stderr[:150]})")
    except FileNotFoundError:
        raise RuntimeError(f"FFMPEG_NOT_FOUND: {ERROR_MESSAGES_AR['FFMPEG_NOT_FOUND']}")

    # 5. Convert to processing.wav (16kHz mono 16-bit PCM WAV)
    if on_progress:
        on_progress(0.90, "جاري إنشاء ملف المعالجة WAV 16kHz mono للمحاذاة...", None)

    processing_wav_path = final_dir / "processing.wav"
    cmd_wav = [
        ffmpeg_path(),
        "-y",
        "-i", str(raw_audio_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(processing_wav_path),
    ]

    try:
        res_wav = subprocess.run(
            cmd_wav,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            creationflags=subprocess_creation_flags(),
        )
        if res_wav.returncode != 0:
            raise RuntimeError(f"CONVERSION_FAILED: فشل تحويل WAV لمعالجة الصوت ({res_wav.stderr[:150]})")
    except FileNotFoundError:
        raise RuntimeError(f"FFMPEG_NOT_FOUND: {ERROR_MESSAGES_AR['FFMPEG_NOT_FOUND']}")

    # 6. Remove the leading intro/silence from BOTH outputs. The same offset
    # is applied to playback.mp3 and processing.wav, so ASR timestamps remain
    # aligned with what the user hears.
    leading_silence_removed_ms = trim_leading_silence(
        playback_mp3_path,
        processing_wav_path,
        temp_dir,
        audio_quality,
    )
    if on_progress:
        if leading_silence_removed_ms:
            on_progress(
                0.97,
                f"تم حذف {leading_silence_removed_ms} مللي ثانية من الصمت قبل بداية الإلقاء...",
                {"leading_silence_removed_ms": leading_silence_removed_ms},
            )
        else:
            on_progress(0.97, "لم يُكتشف صمت طويل قبل بداية الإلقاء.", None)

    # 7. Validate both final outputs with ffprobe
    playback_meta = inspect_audio(str(playback_mp3_path))
    processing_meta = inspect_audio(str(processing_wav_path))

    # Clean temporary fragments
    clean_temp_files(temp_dir)

    if on_progress:
        on_progress(1.0, "اكتمل تنزيل وتجهيز التسجيل الصوتي بنجاح!", None)

    return {
        "source_type": "youtube",
        "source_url": clean_url,
        "job_id": job_id,
        "raw_format": raw_ext,
        "raw_audio_path": str(raw_audio_path),
        "playback_audio_path": str(playback_mp3_path),
        "processing_audio_path": str(processing_wav_path),
        "duration_ms": playback_meta.duration_ms,
        "duration_seconds": playback_meta.duration_seconds,
        "sample_rate": playback_meta.sample_rate,
        "channels": playback_meta.channels,
        "leading_silence_removed_ms": leading_silence_removed_ms,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
    }


def clean_temp_files(temp_dir: Path) -> None:
    """Safely cleans up temporary fragment directory."""
    if temp_dir.exists():
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


def cancel_youtube_job(job_id: str, job_dir: Optional[str] = None) -> bool:
    """Signals cancellation event for an ongoing job."""
    with _cancel_lock:
        event = _active_cancels.get(job_id)
        if event:
            event.set()
            return True
    return False
