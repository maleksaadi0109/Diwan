import os
import pytest
from diwan_worker.audio.converter import convert_to_wav_16k_mono

def test_convert_audio_success(synthetic_wav, tmp_path):
    output_wav = str(tmp_path / "converted.wav")
    progress_events = []

    def on_prog(pct, msg):
        progress_events.append((pct, msg))

    meta = convert_to_wav_16k_mono(synthetic_wav, output_wav, on_progress=on_prog)
    assert os.path.exists(output_wav)
    assert meta.sample_rate == 16000
    assert meta.channels == 1
    assert len(progress_events) >= 2
    assert progress_events[-1][0] == 1.0

def test_convert_audio_missing_input(tmp_path):
    with pytest.raises(FileNotFoundError):
        convert_to_wav_16k_mono("/nonexistent/file.wav", str(tmp_path / "out.wav"))
