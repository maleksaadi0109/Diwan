from __future__ import annotations
import json
import os
import sys
import subprocess
from typing import NoReturn
from . import __version__
from .schemas.protocol import (
    WorkerRequest,
    WorkerResponse,
    WorkerProgressEvent,
    ErrorCode,
)
from .audio.inspector import inspect_audio
from .audio.converter import convert_to_wav_16k_mono
from .audio.vad import detect_speech_regions

def log(msg: str) -> None:
    """All logging goes strictly to stderr to preserve stdout for JSON protocol."""
    sys.stderr.write(f"[diwan-worker] {msg}\n")
    sys.stderr.flush()

def emit_event(event: WorkerProgressEvent) -> None:
    sys.stdout.write(event.to_json() + "\n")
    sys.stdout.flush()

def emit_response(resp: WorkerResponse) -> None:
    sys.stdout.write(resp.to_json() + "\n")
    sys.stdout.flush()

def handle_health(req: WorkerRequest) -> None:
    # Check ffmpeg / ffprobe availability
    ffmpeg_version = "unavailable"
    ffprobe_version = "unavailable"

    try:
        res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            ffmpeg_version = res.stdout.split("\n")[0]
    except Exception:
        pass

    try:
        res = subprocess.run(["ffprobe", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            ffprobe_version = res.stdout.split("\n")[0]
    except Exception:
        pass

    emit_response(
        WorkerResponse(
            id=req.id,
            success=True,
            data={
                "worker_version": __version__,
                "python_version": sys.version.split()[0],
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
    model_size = req.payload.get("model_size", "small")
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
        from .schemas.transcript import TranscriptResult

        on_prog(0.2, "جاري استخراج الكلمات والتفريغ الصوتي...")
        if transcript_payload:
            transcript = TranscriptResult.from_json(
                json.dumps(transcript_payload) if isinstance(transcript_payload, dict) else transcript_payload
            )
        else:
            transcript = transcribe_arabic_audio(
                audio_path=audio_path,
                on_progress=lambda p, m: on_prog(0.2 + (p * 0.5), m),
                mock=mock,
            )

        on_prog(0.8, "جاري مطابقة الأبيات مع الطوابع الصوتية (Forced Alignment)...")
        alignment_res = align_transcript_to_verses(
            verses=verses,
            transcript_words=transcript.words,
            audio_duration_ms=transcript.duration_ms,
            poem_id=poem_id,
            recording_id=recording_id,
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
    log(f"Starting Diwan Worker v{__version__}...")
    for line in sys.stdin:
        process_line(line)
    log("Worker received EOF, shutting down cleanly.")

if __name__ == "__main__":
    main()
