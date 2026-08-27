import math
import os
import struct
import wave
import pytest

@pytest.fixture
def synthetic_wav(tmp_path):
    """
    Generates a 3.0-second 16kHz mono 16-bit PCM WAV audio fixture:
    - 0.0s to 1.0s: Tone (Simulated Speech Region 1)
    - 1.0s to 2.0s: Silence (Silence Gap)
    - 2.0s to 3.0s: Tone (Simulated Speech Region 2)
    """
    wav_path = str(tmp_path / "synthetic_test.wav")
    framerate = 16000
    total_duration = 3.0
    total_samples = int(framerate * total_duration)

    samples = []
    for i in range(total_samples):
        t = i / framerate
        if 0.0 <= t < 1.0 or 2.0 <= t < 3.0:
            # 440 Hz Sine wave with amplitude
            value = int(12000 * math.sin(2 * math.pi * 440 * t))
        else:
            # Silence
            value = 0
        samples.append(value)

    raw_data = struct.pack(f"<{len(samples)}h", *samples)

    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(raw_data)

    return wav_path
