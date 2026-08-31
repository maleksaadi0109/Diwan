from __future__ import annotations
import os
import subprocess
from typing import List, Dict, Any, Callable, Optional
from ..bin_paths import ffmpeg_path

ProgressCallback = Callable[[float, str], None]

def segment_audio_clips(
    input_path: str,
    output_dir: str,
    segments: List[Dict[str, Any]],
    output_format: str = "wav",
    on_progress: Optional[ProgressCallback] = None,
    timeout_seconds: int = 180,
) -> List[str]:
    """
    Extracts individual audio clips for each verse boundary using ffmpeg.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input audio not found: {input_path}")

    os.makedirs(output_dir, exist_ok=True)
    generated_files: List[str] = []
    total = len(segments)

    for idx, seg in enumerate(segments):
        start_ms = int(seg.get("start_ms", 0))
        end_ms = int(seg.get("end_ms", 0))
        order_index = int(seg.get("order_index", idx + 1))
        custom_name = seg.get("filename")

        if custom_name:
            filename = custom_name
        else:
            filename = f"verse_{order_index:03d}.{output_format}"

        out_file = os.path.join(output_dir, filename)
        start_sec = f"{start_ms / 1000.0:.3f}"
        duration_sec = f"{(end_ms - start_ms) / 1000.0:.3f}"

        # Safe ffmpeg command array
        cmd = [
            ffmpeg_path(),
            "-y",
            "-ss", start_sec,
            "-t", duration_sec,
            "-i", input_path,
            "-vn",
        ]

        if output_format == "mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "192k"])
        else:
            cmd.extend(["-c:a", "pcm_s16le", "-ar", "16000", "-ac", "1"])

        cmd.append(out_file)

        try:
            subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_seconds,
                check=True,
            )
            generated_files.append(out_file)
        except Exception as e:
            raise RuntimeError(f"Failed to segment clip {filename}: {e}")

        if on_progress:
            pct = (idx + 1) / max(1, total)
            on_progress(pct, f"تم تقطيع البيت {idx + 1} من {total}")

    return generated_files
