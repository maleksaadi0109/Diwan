from __future__ import annotations
import json
import os
import sys
import subprocess

# Disable noisy Hugging Face symlink warnings on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
from typing import NoReturn
from . import __version__
from .schemas.protocol import (
    WorkerRequest,
    WorkerResponse,
    WorkerProgressEvent,
    ErrorCode,
)
from .audio.inspector import inspect_audio
from .audio.converter import convert_to_playback_wav, convert_to_wav_16k_mono
from .audio.vad import detect_speech_regions
from .bin_paths import ffmpeg_path, ffprobe_path, subprocess_creation_flags

def configure_utf8_stdio() -> None:
    """Keep JSON protocol and worker logs safe for Unicode on Windows pipes."""
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        try:
            stream.reconfigure(
                encoding="utf-8",
                errors="strict" if stream is sys.stdin else "backslashreplace",
            )
        except (AttributeError, OSError, ValueError):
            # Test doubles and unusual embedded streams may not support
            # reconfigure; the normal Python streams do.
            pass

def _write_utf8(stream: object, text: str) -> None:
    """Write a protocol/log line without relying on Windows console encoding."""
    line = (text + "\n").encode("utf-8")
    buffer = getattr(stream, "buffer", None)
    if buffer is not None:
        buffer.write(line)
        buffer.flush()
        return

    # StringIO and simple test doubles do not expose a binary buffer.
    stream.write(text + "\n")  # type: ignore[attr-defined]
    stream.flush()  # type: ignore[attr-defined]

def log(msg: str) -> None:
    """All logging goes strictly to stderr to preserve stdout for JSON protocol."""
    _write_utf8(sys.stderr, f"[diwan-worker] {msg}")

def emit_event(event: WorkerProgressEvent) -> None:
    _write_utf8(sys.stdout, event.to_json())

def emit_response(resp: WorkerResponse) -> None:
    _write_utf8(sys.stdout, resp.to_json())

def handle_health(req: WorkerRequest) -> None:
    # Check ffmpeg / ffprobe availability
    ffmpeg_version = "unavailable"
    ffprobe_version = "unavailable"
    ytdlp_version = None
    ytdlp_path = None

    try:
        res = subprocess.run([ffmpeg_path(), "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", timeout=5, creationflags=subprocess_creation_flags())
        if res.returncode == 0:
            ffmpeg_version = res.stdout.split("\n")[0]
    except Exception:
        pass

    try:
        res = subprocess.run([ffprobe_path(), "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", timeout=5, creationflags=subprocess_creation_flags())
        if res.returncode == 0:
            ffprobe_version = res.stdout.split("\n")[0]
    except Exception:
        pass

    try:
        import yt_dlp
        ytdlp_version = getattr(getattr(yt_dlp, "version", None), "__version__", "unknown")
        ytdlp_path = getattr(yt_dlp, "__file__", None)
    except ImportError:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="YTDLP_NOT_INSTALLED",
                error_message="مكوّن تنزيل YouTube غير مثبت في بيئة التطبيق",
                data={
                    "python_executable": sys.executable,
                },
            )
        )
        return

    emit_response(
        WorkerResponse(
            id=req.id,
            success=True,
            data={
                "worker_version": __version__,
                "python_version": sys.version.split()[0],
                "python_executable": sys.executable,
                "ytdlp_version": ytdlp_version,
                "ytdlp_path": ytdlp_path,
                "ffmpeg": ffmpeg_version,
                "ffprobe": ffprobe_version,
                "status": "ready",
            },
        )
    )

def handle_inspect_audio(req: WorkerRequest) -> None:
    file_path = req.payload.get("file_path")
    if not file_path or not isinstance(file_path, str):
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing or invalid 'file_path' in payload",
            )
        )
        return

    try:
        meta = inspect_audio(file_path)
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data=meta.to_dict(),
            )
        )
    except FileNotFoundError as e:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="FILE_NOT_FOUND",
                error_message=str(e),
            )
        )
    except ValueError as e:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INSPECTION_FAILED",
                error_message=str(e),
            )
        )
    except Exception as e:
        log(f"Inspection error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=f"Failed to inspect audio: {str(e)}",
            )
        )

def handle_convert_audio(req: WorkerRequest) -> None:
    input_path = req.payload.get("input_path")
    output_path = req.payload.get("output_path")
    profile = req.payload.get("profile", "processing")

    if not input_path or not output_path:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="'input_path' and 'output_path' are required",
            )
        )
        return

    def on_prog(pct: float, msg: str) -> None:
        emit_event(WorkerProgressEvent(id=req.id, stage="converting", progress=pct, message=msg))

    try:
        if profile == "playback":
            meta = convert_to_playback_wav(input_path, output_path, on_progress=on_prog)
        else:
            meta = convert_to_wav_16k_mono(input_path, output_path, on_progress=on_prog)
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data={
                    "output_path": output_path,
                    "metadata": meta.to_dict(),
                },
            )
        )
    except FileNotFoundError as e:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="FILE_NOT_FOUND",
                error_message=str(e),
            )
        )
    except Exception as e:
        log(f"Conversion error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="CONVERSION_FAILED",
                error_message=f"Conversion failed: {str(e)}",
            )
        )

def handle_detect_speech(req: WorkerRequest) -> None:
    wav_path = req.payload.get("wav_path")
    if not wav_path or not isinstance(wav_path, str):
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing 'wav_path' in payload",
            )
        )
        return

    if not os.path.exists(wav_path):
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="FILE_NOT_FOUND",
                error_message=f"WAV file not found: {wav_path}",
            )
        )
        return

    try:
        emit_event(WorkerProgressEvent(id=req.id, stage="vad", progress=0.2, message="جاري تحليل المناطق الصوتية..."))
        intervals = detect_speech_regions(wav_path)
        emit_event(WorkerProgressEvent(id=req.id, stage="vad", progress=1.0, message="اكتمل كشف المناطق الصوتية بنجاح"))

        total_speech_ms = sum(i.end_ms - i.start_ms for i in intervals)
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data={
                    "intervals": [i.to_dict() for i in intervals],
                    "speech_count": len(intervals),
                    "total_speech_duration_ms": total_speech_ms,
                },
            )
        )
    except Exception as e:
        log(f"VAD error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="VAD_FAILED",
                error_message=f"Speech detection failed: {str(e)}",
            )
        )

def handle_transcribe(req: WorkerRequest) -> None:
    audio_path = req.payload.get("audio_path")
    model_size = req.payload.get("model_size", "tiny")
    device = req.payload.get("device", "cpu")
    compute_type = req.payload.get("compute_type", "default")
    output_json_path = req.payload.get("output_json_path")
    mock = bool(req.payload.get("mock", False))

    if not audio_path or not isinstance(audio_path, str):
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing or invalid 'audio_path' in payload",
            )
        )
        return

    def on_prog(pct: float, msg: str) -> None:
        emit_event(WorkerProgressEvent(id=req.id, stage="transcribing", progress=pct, message=msg))

    try:
        from .asr.transcriber import transcribe_arabic_audio
        transcript = transcribe_arabic_audio(
            audio_path=audio_path,
            model_size=model_size,
            device=device,
            compute_type=compute_type,
            on_progress=on_prog,
            mock=mock,
        )

        if output_json_path and isinstance(output_json_path, str):
            out_dir = os.path.dirname(output_json_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
            transcript.save_to_file(output_json_path)

        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data={
                    "transcript": transcript.to_dict(),
                    "output_json_path": output_json_path,
                },
            )
        )
    except FileNotFoundError as e:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="FILE_NOT_FOUND",
                error_message=str(e),
            )
        )
    except Exception as e:
        log(f"Transcription error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=f"Transcription failed: {str(e)}",
            )
        )

def handle_align(req: WorkerRequest) -> None:
    audio_path = req.payload.get("audio_path")
    verses = req.payload.get("verses", [])
    transcript_payload = req.payload.get("transcript")
    poem_id = req.payload.get("poem_id", "poem")
    recording_id = req.payload.get("recording_id", "rec")
    mock = bool(req.payload.get("mock", False))

    if not audio_path or not isinstance(audio_path, str):
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing 'audio_path' in payload",
            )
        )
        return

    def on_prog(pct: float, msg: str) -> None:
        emit_event(WorkerProgressEvent(id=req.id, stage="aligning", progress=pct, message=msg))

    try:
        from .alignment.aligner import align_transcript_to_verses
        from .asr.transcriber import transcribe_arabic_audio
        from .audio.vad import analyze_audio_vad
        from .schemas.transcript import TranscriptResult

        on_prog(0.2, "جاري استخراج الكلمات والتفريغ الصوتي...")
        if transcript_payload:
            transcript = TranscriptResult.from_json(
                json.dumps(transcript_payload) if isinstance(transcript_payload, dict) else transcript_payload
            )
        else:
            transcript = transcribe_arabic_audio(
                audio_path=audio_path,
                on_progress=lambda p, m: on_prog(0.2 + (p * 0.4), m),
                mock=mock,
            )

        on_prog(0.7, "جاري فحص فترات الصمت ونقاط التوقف (VAD Silence Analysis)...")
        silence_regions = []
        try:
            vad_res = analyze_audio_vad(audio_path)
            silence_regions = vad_res.silence_regions
        except Exception as e_vad:
            log(f"VAD warning (falling back to ASR): {e_vad}")

        on_prog(0.85, "جاري مطابقة الأبيات مع الطوابع الصوتية (Forced Alignment)...")
        alignment_res = align_transcript_to_verses(
            verses=verses,
            transcript_words=transcript.words,
            audio_duration_ms=transcript.duration_ms,
            poem_id=poem_id,
            recording_id=recording_id,
            silence_regions=silence_regions,
        )

        on_prog(1.0, "اكتملت المحاذاة الدقيقة بنجاح!")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data=alignment_res.to_dict(),
            )
        )
    except Exception as e:
        log(f"Alignment error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=f"Alignment failed: {str(e)}",
            )
        )

def handle_segment_audio(req: WorkerRequest) -> None:
    input_path = req.payload.get("input_path")
    output_dir = req.payload.get("output_dir")
    segments = req.payload.get("segments", [])
    output_format = req.payload.get("output_format", "wav")

    if not input_path or not output_dir or not segments:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="'input_path', 'output_dir', and 'segments' are required",
            )
        )
        return

    def on_prog(pct: float, msg: str) -> None:
        emit_event(WorkerProgressEvent(id=req.id, stage="segmenting", progress=pct, message=msg))

    try:
        from .audio.segmenter import segment_audio_clips
        files = segment_audio_clips(
            input_path=input_path,
            output_dir=output_dir,
            segments=segments,
            output_format=output_format,
            on_progress=on_prog,
        )

        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data={
                    "generated_files": files,
                    "count": len(files),
                },
            )
        )
    except Exception as e:
        log(f"Segmentation error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INTERNAL_ERROR",
                error_message=f"Segmentation failed: {str(e)}",
            )
        )

def handle_youtube_info(req: WorkerRequest) -> None:
    url = req.payload.get("url")
    max_duration = req.payload.get("max_duration_seconds", 3600)
    cookies_content = req.payload.get("cookies_content")

    if not url:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing 'url' in payload",
            )
        )
        return

    try:
        from .audio.youtube import fetch_youtube_video_info
        info = fetch_youtube_video_info(url=url, max_duration_seconds=max_duration, cookies_content=cookies_content)
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data=info,
            )
        )
    except ValueError as ve:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_URL",
                error_message=str(ve),
            )
        )
    except Exception as e:
        log(f"YouTube info error: {e}")
        err_msg = str(e)
        code = "INTERNAL_ERROR"
        if ":" in err_msg:
            parts = err_msg.split(":", 1)
            prefix = parts[0].strip()
            if prefix.isupper() or "_" in prefix:
                code = prefix
                err_msg = parts[1].strip()

        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code=code,
                error_message=err_msg,
            )
        )

def handle_youtube_download(req: WorkerRequest) -> None:
    url = req.payload.get("url")
    output_dir = req.payload.get("output_dir")
    job_id = req.payload.get("job_id")
    quality = req.payload.get("quality", "192k")
    cookies_content = req.payload.get("cookies_content")

    if not url or not output_dir:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="'url' and 'output_dir' are required in payload",
            )
        )
        return

    def on_prog(pct: float, msg: str, details: Optional[dict] = None) -> None:
        emit_event(WorkerProgressEvent(id=req.id, stage="downloading", progress=pct, message=msg, details=details))

    try:
        from .audio.youtube import download_youtube_audio
        result = download_youtube_audio(
            url=url,
            output_base_dir=output_dir,
            job_id=job_id,
            audio_quality=quality,
            on_progress=on_prog,
            cookies_content=cookies_content,
        )
        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data=result,
            )
        )
    except ValueError as ve:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_URL",
                error_message=str(ve),
            )
        )
    except Exception as e:
        log(f"YouTube download error: {e}")
        err_msg = str(e)
        code = "DOWNLOAD_FAILED"
        if ":" in err_msg:
            parts = err_msg.split(":", 1)
            prefix = parts[0].strip()
            if prefix.isupper() or "_" in prefix:
                code = prefix
                err_msg = parts[1].strip()

        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code=code,
                error_message=err_msg,
            )
        )

def handle_youtube_cancel(req: WorkerRequest) -> None:
    job_id = req.payload.get("job_id")
    job_dir = req.payload.get("job_dir")

    if not job_id:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing 'job_id' in payload",
            )
        )
        return

    from .audio.youtube import cancel_youtube_job
    cancelled = cancel_youtube_job(job_id=job_id, job_dir=job_dir)
    emit_response(
        WorkerResponse(
            id=req.id,
            success=True,
            data={"cancelled": cancelled, "job_id": job_id},
        )
    )

def handle_fetch_url(req: WorkerRequest) -> None:
    url = req.payload.get("url")
    headers = req.payload.get("headers") or {}
    timeout = req.payload.get("timeout_seconds", 30)

    if not url:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message="Missing 'url' in payload",
            )
        )
        return

    import urllib.request
    import urllib.error
    import ssl

    req_headers = {
        "User-Agent": "DiwanDesktop/1.0 (Arabic Poetic Audio Sync; +https://github.com/diwan/diwan)",
        "Accept": "application/json",
        **headers,
    }

    try:
        req_obj = urllib.request.Request(url, headers=req_headers)
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req_obj, timeout=timeout, context=ctx) as resp:
            data = resp.read().decode("utf-8")
            status = resp.status
            content_type = resp.headers.get("Content-Type", "")

        emit_response(
            WorkerResponse(
                id=req.id,
                success=True,
                data={
                    "status": status,
                    "content_type": content_type,
                    "text": data,
                },
            )
        )
    except urllib.error.HTTPError as he:
        err_body = ""
        try:
            err_body = he.read().decode("utf-8", errors="ignore")
        except Exception:
            pass
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code=f"HTTP_{he.code}",
                error_message=f"HTTP {he.code}: {he.reason}",
                data={"status": he.code, "text": err_body},
            )
        )
    except Exception as e:
        log(f"Fetch URL error: {e}")
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="NETWORK_ERROR",
                error_message=str(e),
            )
        )

def process_line(line: str) -> None:
    line = line.strip()
    if not line:
        return

    try:
        req = WorkerRequest.from_json(line)
    except Exception as e:
        emit_response(
            WorkerResponse(
                id="unknown",
                success=False,
                error_code="MALFORMED_JSON",
                error_message=f"Invalid JSON request: {str(e)}",
            )
        )
        return

    if req.command == "health":
        handle_health(req)
    elif req.command == "inspect_audio":
        handle_inspect_audio(req)
    elif req.command == "convert_audio":
        handle_convert_audio(req)
    elif req.command == "detect_speech":
        handle_detect_speech(req)
    elif req.command == "transcribe":
        handle_transcribe(req)
    elif req.command == "align":
        handle_align(req)
    elif req.command == "segment_audio":
        handle_segment_audio(req)
    elif req.command == "youtube_info":
        handle_youtube_info(req)
    elif req.command == "youtube_download":
        handle_youtube_download(req)
    elif req.command == "youtube_cancel":
        handle_youtube_cancel(req)
    elif req.command == "fetch_url":
        handle_fetch_url(req)
    else:
        emit_response(
            WorkerResponse(
                id=req.id,
                success=False,
                error_code="INVALID_COMMAND",
                error_message=f"Unknown command: '{req.command}'",
            )
        )

def main() -> None:
    configure_utf8_stdio()
    log(f"Starting Diwan Worker v{__version__}...")
    for line in sys.stdin:
        process_line(line)
    log("Worker received EOF, shutting down cleanly.")

    # Heavy ML dependencies used for transcription (faster-whisper/CTranslate2)
    # can leave non-daemon background threads running on Windows even after
    # the response has been sent, which prevents a normal process exit from
    # ever completing. Since this process handles exactly one request per
    # spawn (the host closes stdin after writing its request), a hard exit
    # here is safe: all output has already been flushed, and it avoids the
    # host seeing "the job never finished" while the real answer is sitting
    # in its stdout buffer.
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)

if __name__ == "__main__":
    main()
