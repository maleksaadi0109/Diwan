from __future__ import annotations
import math
import struct
import wave
from typing import List, Tuple, Optional
from ..schemas.protocol import SpeechInterval

def detect_speech_regions(
    wav_path: str,
    frame_duration_ms: int = 30,
    energy_threshold_percentile: float = 0.35,
    min_speech_duration_ms: int = 250,
    min_silence_duration_ms: int = 300,
) -> List[SpeechInterval]:
    """
    Detects speech intervals in a 16kHz mono 16-bit PCM WAV file.
    Uses frame energy and adaptive noise floor thresholding.
    """
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()

        if sampwidth != 2:
            raise ValueError(f"Expected 16-bit audio, got {sampwidth * 8}-bit")

        raw_bytes = wf.readframes(n_frames)

    # Unpack 16-bit signed PCM samples
    n_samples = len(raw_bytes) // 2
    if n_samples == 0:
        return []

    samples = struct.unpack(f"<{n_samples}h", raw_bytes)
    # If stereo, average channels
    if n_channels > 1:
        samples = [
            sum(samples[i * n_channels : (i + 1) * n_channels]) // n_channels
            for i in range(n_samples // n_channels)
        ]

    frame_size = int(framerate * (frame_duration_ms / 1000.0))
    if frame_size <= 0:
        frame_size = 480

    n_chunks = len(samples) // frame_size
    frame_energies: List[float] = []

    for i in range(n_chunks):
        chunk = samples[i * frame_size : (i + 1) * frame_size]
        # Calculate RMS energy of the frame
        sum_sq = sum(s * s for s in chunk)
        rms = math.sqrt(sum_sq / len(chunk))
        frame_energies.append(rms)

    if not frame_energies:
        return []

    # Adaptive threshold based on energy distribution
    sorted_energies = sorted(frame_energies)
    noise_floor = sorted_energies[int(len(sorted_energies) * 0.15)]
    peak_energy = sorted_energies[int(len(sorted_energies) * 0.90)]

    dynamic_range = max(1.0, peak_energy - noise_floor)
    threshold = noise_floor + (dynamic_range * energy_threshold_percentile)

    # Initial frame classifications (True = speech, False = silence)
    is_speech_frame = [e > threshold for e in frame_energies]

    # Group into contiguous intervals
    raw_intervals: List[Tuple[int, int]] = []
    in_speech = False
    start_frame = 0

    for idx, is_speech in enumerate(is_speech_frame):
        if is_speech and not in_speech:
            in_speech = True
            start_frame = idx
        elif not is_speech and in_speech:
            in_speech = False
            raw_intervals.append((start_frame, idx))

    if in_speech:
        raw_intervals.append((start_frame, len(is_speech_frame)))

    # Convert frame indices to milliseconds
    ms_per_frame = frame_duration_ms
    intervals_ms: List[Tuple[int, int]] = [
        (s * ms_per_frame, e * ms_per_frame) for s, e in raw_intervals
    ]

    # Merge intervals with small silence gaps
    merged: List[Tuple[int, int]] = []
    for start, end in intervals_ms:
        if not merged:
            merged.append((start, end))
        else:
            prev_start, prev_end = merged[-1]
            if start - prev_end < min_silence_duration_ms:
                merged[-1] = (prev_start, end)
            else:
                merged.append((start, end))

    # Filter out intervals shorter than minimum speech duration
    results: List[SpeechInterval] = []
    for start, end in merged:
        duration = end - start
        if duration >= min_speech_duration_ms:
            # Calculate confidence based on energy ratio
            results.append(
                SpeechInterval(
                    start_ms=start,
                    end_ms=end,
                    confidence=min(1.0, max(0.6, 0.75 + (duration / 10000.0))),
                )
            )

    return results
