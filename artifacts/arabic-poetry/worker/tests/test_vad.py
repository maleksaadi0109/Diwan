from diwan_worker.audio.vad import detect_speech_regions

def test_vad_detects_synthetic_regions(synthetic_wav):
    intervals = detect_speech_regions(synthetic_wav)
    assert len(intervals) >= 2

    # Region 1 is between 0.0s and 1.0s
    first = intervals[0]
    assert first.start_ms <= 100
    assert first.end_ms >= 900 and first.end_ms <= 1200

    # Region 2 is between 2.0s and 3.0s
    second = intervals[1]
    assert second.start_ms >= 1900 and second.start_ms <= 2200
    assert second.end_ms >= 2900
