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
    _resolve_bundled_model_dir,
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

def test_resolve_bundled_model_dir_absent_without_env(monkeypatch):
    monkeypatch.delenv("DIWAN_BUNDLED_MODELS_DIR", raising=False)
    assert _resolve_bundled_model_dir("small") is None


def test_resolve_bundled_model_dir_absent_when_size_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("DIWAN_BUNDLED_MODELS_DIR", str(tmp_path))
    # No "small" subfolder created under tmp_path.
    assert _resolve_bundled_model_dir("small") is None


def test_resolve_bundled_model_dir_absent_when_model_bin_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("DIWAN_BUNDLED_MODELS_DIR", str(tmp_path))
    (tmp_path / "small").mkdir()
    # Folder exists but has no model.bin -- treat as not bundled.
    assert _resolve_bundled_model_dir("small") is None


def test_resolve_bundled_model_dir_found(monkeypatch, tmp_path):
    monkeypatch.setenv("DIWAN_BUNDLED_MODELS_DIR", str(tmp_path))
    model_dir = tmp_path / "small"
    model_dir.mkdir()
    (model_dir / "model.bin").write_bytes(b"fake-ct2-model")
    resolved = _resolve_bundled_model_dir("small")
    assert resolved == str(model_dir)


def test_bundled_model_used_when_present(monkeypatch, tmp_path, synthetic_wav):
    """When a bundled model dir is present, transcribe_arabic_audio should
    load it directly by local path (no download_root/network path) instead
    of resolving the model name via huggingface_hub."""
    model_dir = tmp_path / "small"
    model_dir.mkdir()
    (model_dir / "model.bin").write_bytes(b"fake-ct2-model")
    monkeypatch.setenv("DIWAN_BUNDLED_MODELS_DIR", str(tmp_path))

    calls = {}

    class FakeSegment:
        text = ""
        start = 0.0
        end = 0.0
        words = []
        avg_logprob = -0.1
        no_speech_prob = 0.01

    class FakeInfo:
        language = "ar"
        duration = 1.0

    class FakeWhisperModel:
        def __init__(self, model_size_or_path, device=None, compute_type=None, **kwargs):
            calls["model_size_or_path"] = model_size_or_path
            calls["kwargs"] = kwargs

        def transcribe(self, *args, **kwargs):
            return iter([FakeSegment()]), FakeInfo()

    import diwan_worker.asr.transcriber as transcriber_module

    monkeypatch.setattr(
        "faster_whisper.WhisperModel", FakeWhisperModel, raising=False
    )
    import sys
    import types

    fake_module = types.ModuleType("faster_whisper")
    fake_module.WhisperModel = FakeWhisperModel
    monkeypatch.setitem(sys.modules, "faster_whisper", fake_module)

    transcript = transcribe_arabic_audio(
        synthetic_wav,
        model_size="small",
        device="cpu",
        mock=False,
    )

    assert transcript.language == "ar"
    assert calls["model_size_or_path"] == str(model_dir)
    # download_root must NOT be passed when loading a bundled local model --
    # that argument only matters for the huggingface_hub download path.
    assert "download_root" not in calls["kwargs"]


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
