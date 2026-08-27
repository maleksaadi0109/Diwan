import pytest
from diwan_worker.audio.inspector import inspect_audio

def test_inspect_valid_wav(synthetic_wav):
    meta = inspect_audio(synthetic_wav)
    assert meta.duration_ms >= 2900 and meta.duration_ms <= 3100
    assert meta.channels == 1
    assert meta.sample_rate == 16000
    assert meta.size_bytes > 0

def test_inspect_missing_file():
    with pytest.raises(FileNotFoundError):
        inspect_audio("/nonexistent/file/path.wav")

def test_inspect_empty_file(tmp_path):
    empty_file = str(tmp_path / "empty.wav")
    with open(empty_file, "wb") as f:
        pass

    with pytest.raises(ValueError, match="0 bytes"):
        inspect_audio(empty_file)
