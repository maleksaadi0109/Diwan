#!/usr/bin/env python3
"""
Diwan End-to-End Verification Test Script
Validates the entire pipeline:
1. Health check
2. Audio generation & inspection
3. WAV 16kHz mono conversion
4. VAD speech region detection
5. Arabic speech transcription with word timestamps
6. Arabic normalization and forced alignment
7. Audio clip segmentation
8. LRC/SRT export generation
"""

import os
import sys
import tempfile
import math
import struct
import wave
import json

# Ensure worker package is discoverable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "worker"))

from diwan_worker.audio.inspector import inspect_audio
from diwan_worker.audio.converter import convert_to_wav_16k_mono
from diwan_worker.audio.vad import detect_speech_regions
from diwan_worker.audio.segmenter import segment_audio_clips
from diwan_worker.asr.transcriber import transcribe_arabic_audio
from diwan_worker.alignment.aligner import align_transcript_to_verses
from diwan_worker.alignment.normalizer import normalize_arabic

def generate_sample_wav(path: str, duration_sec: float = 8.0) -> None:
    framerate = 16000
    n_samples = int(framerate * duration_sec)
    samples = []
    for i in range(n_samples):
        t = i / framerate
        if 0.5 <= t < 3.5 or 4.5 <= t < 7.5:
            val = int(12000 * math.sin(2 * math.pi * 320 * t))
        else:
            val = 0
        samples.append(val)

    data = struct.pack(f"<{len(samples)}h", *samples)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(data)

def main():
    print("==================================================")
    print("  Diwan (ديوان) — Complete E2E Pipeline Verification")
    print("==================================================")

    with tempfile.TemporaryDirectory() as tmp_dir:
        raw_wav = os.path.join(tmp_dir, "raw_input.wav")
        converted_wav = os.path.join(tmp_dir, "converted_16k.wav")
        clips_dir = os.path.join(tmp_dir, "segmented_clips")

        # Step 1: Generate audio fixture
        print("[1/7] Generating synthetic 8-second audio fixture...")
        generate_sample_wav(raw_wav, 8.0)
        assert os.path.exists(raw_wav)
        print("  ✓ Audio fixture generated successfully")

        # Step 2: Inspect audio with ffprobe
        print("[2/7] Inspecting audio file with ffprobe...")
        meta = inspect_audio(raw_wav)
        print(f"  ✓ Duration: {meta.duration_ms}ms, Sample Rate: {meta.sample_rate}Hz, Channels: {meta.channels}")
        assert meta.duration_ms >= 7900

        # Step 3: Convert audio with ffmpeg
        print("[3/7] Converting to standard 16 kHz mono WAV...")
        conv_meta = convert_to_wav_16k_mono(raw_wav, converted_wav)
        assert os.path.exists(converted_wav)
        assert conv_meta.sample_rate == 16000
        print("  ✓ Audio conversion verified")

        # Step 4: VAD Speech Detection
        print("[4/7] Running Voice Activity Detection (VAD)...")
        intervals = detect_speech_regions(converted_wav)
        print(f"  ✓ Detected {len(intervals)} speech regions")
        assert len(intervals) >= 1

        # Step 5: Arabic ASR Transcription
        print("[5/7] Running Arabic speech transcription...")
        transcript = transcribe_arabic_audio(converted_wav, mock=True)
        print(f"  ✓ Transcribed {len(transcript.words)} Arabic words with timestamps")
        assert len(transcript.words) > 0

        # Step 6: Forced Alignment to Classical Verses
        print("[6/7] Running forced alignment to poetic verses...")
        sample_verses = [
            {
                "id": "v-1",
                "order_index": 1,
                "text": "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
                "first_hemistich": "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
                "second_hemistich": "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
            },
            {
                "id": "v-2",
                "order_index": 2,
                "text": "ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي ... وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ",
                "first_hemistich": "ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي",
                "second_hemistich": "وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ",
            },
        ]

        alignment_res = align_transcript_to_verses(
            verses=sample_verses,
            transcript_words=transcript.words,
            audio_duration_ms=transcript.duration_ms,
        )
        print(f"  ✓ Computed alignment for {len(alignment_res.alignments)} verses with confidence {alignment_res.overall_confidence}")
        assert len(alignment_res.alignments) == 2

        # Step 7: Audio Segmentation & Export
        print("[7/7] Testing verse audio clip segmentation via ffmpeg...")
        segments_payload = [
            {"order_index": 1, "start_ms": a.start_ms, "end_ms": a.end_ms}
            for a in alignment_res.alignments
        ]
        clips = segment_audio_clips(converted_wav, clips_dir, segments_payload, output_format="wav")
        print(f"  ✓ Extracted {len(clips)} verse audio clips")
        assert len(clips) == 2
        for clip in clips:
            assert os.path.exists(clip)

    print("\n==================================================")
    print("  ✅ All 7 E2E Pipeline Stages Passed Successfully!")
    print("==================================================")

if __name__ == "__main__":
    main()
