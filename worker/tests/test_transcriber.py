import json
import os
import pytest
from diwan_worker.schemas.transcript import (
    TimedWord,
    TranscriptSegment,
    TranscriptResult,
)
from diwan_worker.asr.transcriber import (
    transcribe_arabic_audio,
    generate_mock_arabic_transcript,
)

def test_transcript_schema_validation():
    words = [
        TimedWord(word="واحر", start_ms=2500, end_ms=3100, probability=0.96),
        TimedWord(word="قلباه", start_ms=3200, end_ms=4000, probability=0.98),
    ]
    segment = TranscriptSegment(
        id=1,
        text="واحر قلباه",
        start_ms=2500,
        end_ms=4000,
        words=words,
        avg_logprob=-0.12,
        no_speech_prob=0.01,
    )
    result = TranscriptResult(
        raw_text="واحر قلباه",
        language="ar",
        duration_ms=4500,
        segments=[segment],
        words=words,
        model_used="small",
        device_used="cpu",
    )

    # JSON round trip
    json_str = result.to_json()
    parsed = TranscriptResult.from_json(json_str)

    assert parsed.language == "ar"
    assert parsed.duration_ms == 4500
    assert len(parsed.segments) == 1
    assert len(parsed.words) == 2
    assert parsed.words[0].word == "واحر"
    assert parsed.words[0].start_ms == 2500
    assert parsed.words[1].word == "قلباه"
    assert parsed.words[1].end_ms == 4000

def test_mock_transcribe_arabic(synthetic_wav, tmp_path):
    progress_calls = []

    def on_prog(pct, msg):
        progress_calls.append((pct, msg))

    transcript = transcribe_arabic_audio(
        synthetic_wav,
        model_size="small",
        device="cpu",
        on_progress=on_prog,
        mock=True,
    )

    assert transcript.language == "ar"
    assert transcript.duration_ms >= 2900
    assert len(transcript.segments) >= 1
    assert len(transcript.words) >= 2
    assert len(progress_calls) >= 2

    # Save to file
    out_file = str(tmp_path / "test_transcript.json")
    transcript.save_to_file(out_file)
    assert os.path.exists(out_file)

    with open(out_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["schema_version"] == "1.0"
    assert data["language"] == "ar"

@pytest.mark.skipif(
    not os.getenv("RUN_REAL_ASR"),
    reason="Real Whisper integration test requires downloaded model and RUN_REAL_ASR=1 env var",
)
def test_real_whisper_integration(synthetic_wav):
    transcript = transcribe_arabic_audio(
        synthetic_wav,
        model_size="tiny",
        device="cpu",
        mock=False,
    )
    assert transcript.language == "ar"
    assert len(transcript.words) >= 0
