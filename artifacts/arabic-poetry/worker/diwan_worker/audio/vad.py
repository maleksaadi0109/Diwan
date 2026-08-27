from __future__ import annotations
import math
import struct
import wave
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
from ..schemas.protocol import SpeechInterval

@dataclass
class AudioRegion:
    start_ms: int
    end_ms: int
    duration_ms: int
    is_speech: bool
    confidence: float

@dataclass
class VadAnalysisResult:
    speech_regions: List[SpeechInterval]
    silence_regions: List[AudioRegion]
    all_regions: List[AudioRegion]
    noise_floor_rms: float
    peak_energy_rms: float
    threshold_rms: float

def analyze_audio_vad(
    wav_path: str,
    frame_duration_ms: int = 20,
    min_silence_duration_ms: int = 280,
    min_speech_duration_ms: int = 250,
    max_useful_verse_pause_ms: int = 2500,
    speech_padding_ms: int = 80,
    min_merge_silence_ms: int = 180,
) -> VadAnalysisResult:
    """
    Analyzes 16kHz mono PCM WAV in 20ms frames with adaptive noise floor,
    merges internal silences < 180ms, and detects speech and silence regions.
    """
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()

        if sampwidth != 2:
            raise ValueError(f"Expected 16-bit audio, got {sampwidth * 8}-bit")

        raw_bytes = wf.readframes(n_frames)

    n_samples = len(raw_bytes) // 2
    if n_samples == 0:
        return VadAnalysisResult([], [], [], 0.0, 0.0, 0.0)

    samples = struct.unpack(f"<{n_samples}h", raw_bytes)
    if n_channels > 1:
        samples = [
            sum(samples[i * n_channels : (i + 1) * n_channels]) // n_channels
            for i in range(n_samples // n_channels)
        ]

    frame_size = int(framerate * (frame_duration_ms / 1000.0))
    if frame_size <= 0:
        frame_size = 320  # 20ms @ 16kHz

    n_chunks = len(samples) // frame_size
    frame_energies: List[float] = []

    for i in range(n_chunks):
        chunk = samples[i * frame_size : (i + 1) * frame_size]
        sum_sq = sum(s * s for s in chunk)
        rms = math.sqrt(sum_sq / len(chunk))
        frame_energies.append(rms)

    if not frame_energies:
        return VadAnalysisResult([], [], [], 0.0, 0.0, 0.0)

    # 1. Adaptive noise floor thresholding
    sorted_energies = sorted(frame_energies)
    noise_floor = sorted_energies[int(len(sorted_energies) * 0.15)]
    peak_energy = sorted_energies[int(len(sorted_energies) * 0.90)]
    dynamic_range = max(1.0, peak_energy - noise_floor)
    threshold = noise_floor + (dynamic_range * 0.28)

    # 2. Classify raw frames
    is_speech_frame = [e > threshold for e in frame_energies]

    # 3. Group contiguous speech frames
    raw_speech_intervals: List[Tuple[int, int]] = []
    in_speech = False
    start_frame = 0

    for idx, is_speech in enumerate(is_speech_frame):
        if is_speech and not in_speech:
            in_speech = True
            start_frame = idx
        elif not is_speech and in_speech:
            in_speech = False
            raw_speech_intervals.append((start_frame, idx))

    if in_speech:
        raw_speech_intervals.append((start_frame, len(is_speech_frame)))

    # Convert to ms
    raw_speech_ms: List[Tuple[int, int]] = [
        (s * frame_duration_ms, e * frame_duration_ms) for s, e in raw_speech_intervals
    ]

    # 4. Merge silences < min_merge_silence_ms (180ms) into surrounding speech
    merged_speech: List[Tuple[int, int]] = []
    for start, end in raw_speech_ms:
        if not merged_speech:
            merged_speech.append((start, end))
        else:
            prev_start, prev_end = merged_speech[-1]
            gap = start - prev_end
            if gap < min_merge_silence_ms:
                merged_speech[-1] = (prev_start, end)
            else:
                merged_speech.append((start, end))

    # Apply speech padding (80ms)
    total_audio_ms = n_chunks * frame_duration_ms
    padded_speech: List[Tuple[int, int]] = []
    for start, end in merged_speech:
        p_start = max(0, start - speech_padding_ms)
        p_end = min(total_audio_ms, end + speech_padding_ms)
        if padded_speech and p_start < padded_speech[-1][1]:
            # Merge overlapping padded regions
            padded_speech[-1] = (padded_speech[-1][0], max(padded_speech[-1][1], p_end))
        else:
            padded_speech.append((p_start, p_end))

    # 5. Extract speech intervals and intervening silence regions
    speech_intervals: List[SpeechInterval] = []
    silence_regions: List[AudioRegion] = []
    all_regions: List[AudioRegion] = []

    last_speech_end = 0
    for s_start, s_end in padded_speech:
        if s_start > last_speech_end:
            sil_dur = s_start - last_speech_end
            sil_reg = AudioRegion(
                start_ms=last_speech_end,
                end_ms=s_start,
                duration_ms=sil_dur,
                is_speech=False,
                confidence=0.95,
            )
            silence_regions.append(sil_reg)
            all_regions.append(sil_reg)

        dur = s_end - s_start
        if dur >= min_speech_duration_ms:
            sp_int = SpeechInterval(
                start_ms=s_start,
                end_ms=s_end,
                confidence=min(1.0, 0.80 + (dur / 15000.0)),
            )
            speech_intervals.append(sp_int)
            all_regions.append(
                AudioRegion(
                    start_ms=s_start,
                    end_ms=s_end,
                    duration_ms=dur,
                    is_speech=True,
                    confidence=sp_int.confidence,
                )
            )
        last_speech_end = s_end

    if last_speech_end < total_audio_ms:
        trailing_sil = AudioRegion(
            start_ms=last_speech_end,
            end_ms=total_audio_ms,
            duration_ms=total_audio_ms - last_speech_end,
            is_speech=False,
            confidence=0.95,
        )
        silence_regions.append(trailing_sil)
        all_regions.append(trailing_sil)

    return VadAnalysisResult(
        speech_regions=speech_intervals,
        silence_regions=silence_regions,
        all_regions=all_regions,
        noise_floor_rms=noise_floor,
        peak_energy_rms=peak_energy,
        threshold_rms=threshold,
    )

def detect_speech_regions(
    wav_path: str,
    frame_duration_ms: int = 20,
    energy_threshold_percentile: float = 0.28,
    min_speech_duration_ms: int = 250,
    min_silence_duration_ms: int = 280,
) -> List[SpeechInterval]:
    res = analyze_audio_vad(
        wav_path=wav_path,
        frame_duration_ms=frame_duration_ms,
        min_silence_duration_ms=min_silence_duration_ms,
        min_speech_duration_ms=min_speech_duration_ms,
    )
    return res.speech_regions
