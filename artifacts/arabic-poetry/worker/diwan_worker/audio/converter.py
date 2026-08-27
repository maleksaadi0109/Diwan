from __future__ import annotations
import os
import subprocess
from typing import Callable, Optional
from .inspector import inspect_audio, AudioMetadata

ProgressCallback = Callable[[float, str], None]

def convert_to_wav_16k_mono(
    input_path: str,
    output_path: str,
    on_progress: Optional[ProgressCallback] = None,
    timeout_seconds: int = 120,
) -> AudioMetadata:
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input audio file not found: {input_path}")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    if on_progress:
        on_progress(0.1, "جاري فحص الملف الصوتي والبدء بالتحويل...")

    # Build safe command array - never invoke shell
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vn",                   # No video stream
        "-acodec", "pcm_s16le",  # Standard uncompressed 16-bit PCM
        "-ar", "16000",          # 16 kHz sample rate (optimal for ASR/VAD)
        "-ac", "1",              # Mono channel
        output_path,
    ]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg conversion failed: {e.stderr.strip()}") from e
    except subprocess.TimeoutExpired as e:
        raise TimeoutError(f"ffmpeg conversion timed out after {timeout_seconds} seconds") from e

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise RuntimeError("ffmpeg completed but output file was not created or is empty")

    if on_progress:
        on_progress(0.9, "اكتمل التحويل، جاري فحص ملف WAV الناتج...")

    # Validate output
    meta = inspect_audio(output_path)
    if meta.sample_rate != 16000 or meta.channels != 1:
        raise ValueError(f"Converted audio has unexpected format: {meta.sample_rate}Hz, {meta.channels} channels")

    if on_progress:
        on_progress(1.0, "تم التحويل بنجاح إلى WAV 16kHz mono")

    return meta
