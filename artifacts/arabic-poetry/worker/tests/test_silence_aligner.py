import pytest
from diwan_worker.alignment.aligner import align_transcript_to_verses
from diwan_worker.audio.vad import AudioRegion
from diwan_worker.schemas.transcript import TimedWord

@pytest.fixture
def sample_verses():
    return [
        {
            "id": "v-1",
            "order_index": 1,
            "text": "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
            "first_hemistich": "واحر قلباه ممن قلبه شبم",
            "second_hemistich": "ومن بجسمي وحالي عنده سقم",
        },
        {
            "id": "v-2",
            "order_index": 2,
            "text": "ما لي أكتم حبا قد برى جسدي وتدعي حب سيف الدولة الأمم",
            "first_hemistich": "ما لي أكتم حبا قد برى جسدي",
            "second_hemistich": "وتدعي حب سيف الدولة الأمم",
        },
    ]

@pytest.fixture
def base_mock_words():
    return [
        # Verse 1 words (ends at 7500ms)
        TimedWord(word="واحر", start_ms=1000, end_ms=1500, probability=0.95),
        TimedWord(word="قلباه", start_ms=1600, end_ms=2200, probability=0.96),
        TimedWord(word="ممن", start_ms=2300, end_ms=2700, probability=0.98),
        TimedWord(word="قلبه", start_ms=2800, end_ms=3300, probability=0.94),
        TimedWord(word="شبم", start_ms=3400, end_ms=4000, probability=0.92),
        TimedWord(word="ومن", start_ms=4200, end_ms=4600, probability=0.95),
        TimedWord(word="بجسمي", start_ms=4700, end_ms=5300, probability=0.96),
        TimedWord(word="وحالي", start_ms=5400, end_ms=6000, probability=0.97),
        TimedWord(word="عنده", start_ms=6100, end_ms=6600, probability=0.94),
        TimedWord(word="سقم", start_ms=6700, end_ms=7500, probability=0.93),
        # Verse 2 words (starts at 8400ms)
        TimedWord(word="ما", start_ms=8400, end_ms=8700, probability=0.95),
        TimedWord(word="لي", start_ms=8800, end_ms=9200, probability=0.96),
        TimedWord(word="اكتم", start_ms=9300, end_ms=9900, probability=0.92),
        TimedWord(word="حبا", start_ms=10000, end_ms=10600, probability=0.95),
        TimedWord(word="قد", start_ms=10700, end_ms=11000, probability=0.98),
        TimedWord(word="برى", start_ms=11100, end_ms=11600, probability=0.94),
        TimedWord(word="جسدي", start_ms=11700, end_ms=12400, probability=0.93),
        TimedWord(word="وتدعي", start_ms=12600, end_ms=13200, probability=0.91),
        TimedWord(word="حب", start_ms=13300, end_ms=13700, probability=0.97),
        TimedWord(word="سيف", start_ms=13800, end_ms=14200, probability=0.96),
        TimedWord(word="الدوله", start_ms=14300, end_ms=14900, probability=0.95),
        TimedWord(word="الامم", start_ms=15000, end_ms=16000, probability=0.92),
    ]

def test_1_normal_pause_between_verses(sample_verses, base_mock_words):
    silences = [
        AudioRegion(start_ms=7500, end_ms=8400, duration_ms=900, is_speech=False, confidence=0.95)
    ]

    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=base_mock_words,
        audio_duration_ms=17000,
        silence_regions=silences,
    )

    v1 = result.alignments[0]
    v2 = result.alignments[1]

    assert v1.start_ms == 1000
    assert v1.end_ms == 8300
    assert v2.start_ms == 8300
    assert v1.diagnostic["method"] == "vad"

def test_2_short_breathing_pause_inside_verse(sample_verses, base_mock_words):
    # A 120ms breathing pause inside verse 1 must never become a boundary.
    silences = [
        AudioRegion(start_ms=3300, end_ms=3420, duration_ms=120, is_speech=False, confidence=0.8)
    ]
    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=base_mock_words,
        audio_duration_ms=17000,
        silence_regions=silences,
    )
    # Boundary stays anchored just before verse 2's first word (8400 - 100)
    assert result.alignments[0].end_ms == 8300
    assert result.alignments[1].start_ms == 8300

def test_3_pause_between_hemistichs_does_not_split_verse(sample_verses, base_mock_words):
    # A real 350ms pause between hemistichs (inside verse 1) is not a boundary:
    # candidates are restricted to the inter-verse gap.
    silences = [
        AudioRegion(start_ms=4000, end_ms=4350, duration_ms=350, is_speech=False, confidence=0.9)
    ]
    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=base_mock_words,
        audio_duration_ms=17000,
        silence_regions=silences,
    )
    assert result.alignments[0].end_ms == 8300
    assert result.alignments[1].start_ms == 8300
    assert result.alignments[0].diagnostic["method"] in ("anchor", "vad")
    assert result.alignments[0].diagnostic["detected_silence_start_ms"] != 4000

def test_4_long_silence_before_next_verse(sample_verses):
    # Long pause of 2200ms between verses (from 7500ms to 9700ms)
    silences = [
        AudioRegion(start_ms=7500, end_ms=9700, duration_ms=2200, is_speech=False, confidence=0.98)
    ]

    mock_words = [
        TimedWord(word="واحر", start_ms=1000, end_ms=1500, probability=0.95),
        TimedWord(word="قلباه", start_ms=1600, end_ms=2200, probability=0.96),
        TimedWord(word="ممن", start_ms=2300, end_ms=2700, probability=0.98),
        TimedWord(word="قلبه", start_ms=2800, end_ms=3300, probability=0.94),
        TimedWord(word="شبم", start_ms=3400, end_ms=4000, probability=0.92),
        TimedWord(word="ومن", start_ms=4200, end_ms=4600, probability=0.95),
        TimedWord(word="بجسمي", start_ms=4700, end_ms=5300, probability=0.96),
        TimedWord(word="وحالي", start_ms=5400, end_ms=6000, probability=0.97),
        TimedWord(word="عنده", start_ms=6100, end_ms=6600, probability=0.94),
        TimedWord(word="سقم", start_ms=6700, end_ms=7500, probability=0.93),
        # Verse 2 starts at 9700ms
        TimedWord(word="ما", start_ms=9700, end_ms=10000, probability=0.95),
        TimedWord(word="لي", start_ms=10100, end_ms=10500, probability=0.96),
        TimedWord(word="اكتم", start_ms=10600, end_ms=11100, probability=0.92),
        TimedWord(word="حبا", start_ms=11200, end_ms=11700, probability=0.95),
        TimedWord(word="قد", start_ms=11800, end_ms=12100, probability=0.98),
        TimedWord(word="برى", start_ms=12200, end_ms=12700, probability=0.94),
        TimedWord(word="جسدي", start_ms=12800, end_ms=13400, probability=0.93),
        TimedWord(word="وتدعي", start_ms=13500, end_ms=14000, probability=0.91),
        TimedWord(word="حب", start_ms=14100, end_ms=14500, probability=0.97),
        TimedWord(word="سيف", start_ms=14600, end_ms=15000, probability=0.96),
        TimedWord(word="الدوله", start_ms=15100, end_ms=15600, probability=0.95),
        TimedWord(word="الامم", start_ms=15700, end_ms=16500, probability=0.92),
    ]

    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=mock_words,
        audio_duration_ms=18000,
        silence_regions=silences,
    )

    # Next verse switches 100ms before next speech: 9700 - 100 = 9600ms
    assert result.alignments[0].end_ms == 9600
    assert result.alignments[1].start_ms == 9600

def test_5_background_noise_adaptive_threshold(tmp_path):
    from diwan_worker.audio.vad import analyze_audio_vad
    import wave, struct, math

    wav_file = tmp_path / "noise_test.wav"
    framerate = 16000
    n_samples = framerate * 2
    samples = []
    for i in range(n_samples):
        t = i / framerate
        noise = int(300 * math.sin(2 * math.pi * 50 * t))
        speech = int(10000 * math.sin(2 * math.pi * 350 * t)) if 0.5 <= t <= 1.5 else 0
        samples.append(noise + speech)

    data = struct.pack(f"<{len(samples)}h", *samples)
    with wave.open(str(wav_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        wf.writeframes(data)

    vad_res = analyze_audio_vad(str(wav_file))
    assert len(vad_res.speech_regions) >= 1
    assert vad_res.threshold_rms > vad_res.noise_floor_rms

def test_6_recitation_with_no_clear_silence(sample_verses):
    # No silence regions detected (continuous speech) -> fallback to ASR midpoint
    mock_words = [
        TimedWord(word="واحر", start_ms=1000, end_ms=1500, probability=0.95),
        TimedWord(word="قلباه", start_ms=1600, end_ms=2200, probability=0.96),
        TimedWord(word="ممن", start_ms=2300, end_ms=2700, probability=0.98),
        TimedWord(word="قلبه", start_ms=2800, end_ms=3300, probability=0.94),
        TimedWord(word="شبم", start_ms=3400, end_ms=4000, probability=0.92),
        TimedWord(word="ومن", start_ms=4200, end_ms=4600, probability=0.95),
        TimedWord(word="بجسمي", start_ms=4700, end_ms=5300, probability=0.96),
        TimedWord(word="وحالي", start_ms=5400, end_ms=6000, probability=0.97),
        TimedWord(word="عنده", start_ms=6100, end_ms=6600, probability=0.94),
        TimedWord(word="سقم", start_ms=6700, end_ms=7500, probability=0.93),
        # Verse 2 starts at 7600ms
        TimedWord(word="ما", start_ms=7600, end_ms=7900, probability=0.95),
        TimedWord(word="لي", start_ms=8000, end_ms=8300, probability=0.96),
        TimedWord(word="اكتم", start_ms=8400, end_ms=8900, probability=0.92),
        TimedWord(word="حبا", start_ms=9000, end_ms=9500, probability=0.95),
        TimedWord(word="قد", start_ms=9600, end_ms=9900, probability=0.98),
        TimedWord(word="برى", start_ms=10000, end_ms=10500, probability=0.94),
        TimedWord(word="جسدي", start_ms=10600, end_ms=11100, probability=0.93),
        TimedWord(word="وتدعي", start_ms=11200, end_ms=11700, probability=0.91),
        TimedWord(word="حب", start_ms=11800, end_ms=12200, probability=0.97),
        TimedWord(word="سيف", start_ms=12300, end_ms=12700, probability=0.96),
        TimedWord(word="الدوله", start_ms=12800, end_ms=13300, probability=0.95),
        TimedWord(word="الامم", start_ms=13400, end_ms=14200, probability=0.92),
    ]

    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=mock_words,
        audio_duration_ms=16000,
        silence_regions=[],
    )

    # Continuous speech: boundary clamps to the small gap start (7500),
    # anchored to verse 2's first word onset.
    assert result.alignments[0].end_ms == 7500
    assert result.alignments[1].start_ms == 7500
    assert result.alignments[0].diagnostic["method"] == "anchor"

def test_7_repeated_verse(sample_verses):
    mock_words = [
        TimedWord(word="واحر", start_ms=1000, end_ms=1500, probability=0.95),
        TimedWord(word="قلباه", start_ms=1600, end_ms=2200, probability=0.96),
        TimedWord(word="ممن", start_ms=2300, end_ms=2700, probability=0.98),
        TimedWord(word="قلبه", start_ms=2800, end_ms=3300, probability=0.94),
        TimedWord(word="شبم", start_ms=3400, end_ms=4000, probability=0.92),
        TimedWord(word="ومن", start_ms=4200, end_ms=4600, probability=0.95),
        TimedWord(word="بجسمي", start_ms=4700, end_ms=5300, probability=0.96),
        TimedWord(word="وحالي", start_ms=5400, end_ms=6000, probability=0.97),
        TimedWord(word="عنده", start_ms=6100, end_ms=6600, probability=0.94),
        TimedWord(word="سقم", start_ms=6700, end_ms=7500, probability=0.93),
        # Verse 2
        TimedWord(word="ما", start_ms=8000, end_ms=8300, probability=0.95),
        TimedWord(word="لي", start_ms=8400, end_ms=8800, probability=0.96),
        TimedWord(word="اكتم", start_ms=8900, end_ms=9500, probability=0.92),
        TimedWord(word="حبا", start_ms=9600, end_ms=10200, probability=0.95),
        TimedWord(word="قد", start_ms=10300, end_ms=10600, probability=0.98),
        TimedWord(word="برى", start_ms=10700, end_ms=11200, probability=0.94),
        TimedWord(word="جسدي", start_ms=11300, end_ms=12000, probability=0.93),
        TimedWord(word="وتدعي", start_ms=12200, end_ms=12800, probability=0.91),
        TimedWord(word="حب", start_ms=12900, end_ms=13300, probability=0.97),
        TimedWord(word="سيف", start_ms=13400, end_ms=13800, probability=0.96),
        TimedWord(word="الدوله", start_ms=13900, end_ms=14500, probability=0.95),
        TimedWord(word="الامم", start_ms=14600, end_ms=15500, probability=0.92),
    ]

    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=mock_words,
        audio_duration_ms=16000,
    )
    assert result.alignments[0].start_ms == 1000
    assert result.alignments[1].start_ms > result.alignments[0].start_ms

def test_8_first_verse_start_preserved(sample_verses):
    mock_words = [
        TimedWord(word="واحر", start_ms=2200, end_ms=2800, probability=0.95),
        TimedWord(word="قلباه", start_ms=2900, end_ms=3400, probability=0.96),
        TimedWord(word="ممن", start_ms=3500, end_ms=3900, probability=0.98),
        TimedWord(word="قلبه", start_ms=4000, end_ms=4500, probability=0.94),
        TimedWord(word="شبم", start_ms=4600, end_ms=5100, probability=0.92),
        TimedWord(word="ومن", start_ms=5200, end_ms=5600, probability=0.95),
        TimedWord(word="بجسمي", start_ms=5700, end_ms=6200, probability=0.96),
        TimedWord(word="وحالي", start_ms=6300, end_ms=6800, probability=0.97),
        TimedWord(word="عنده", start_ms=6900, end_ms=7300, probability=0.94),
        TimedWord(word="سقم", start_ms=7400, end_ms=8000, probability=0.93),
        # Verse 2
        TimedWord(word="ما", start_ms=9000, end_ms=9300, probability=0.95),
        TimedWord(word="الامم", start_ms=15000, end_ms=16000, probability=0.92),
    ]

    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=mock_words,
        audio_duration_ms=17000,
        silence_regions=[
            AudioRegion(start_ms=8000, end_ms=9000, duration_ms=1000, is_speech=False, confidence=0.95)
        ],
    )

    assert result.alignments[0].start_ms == 2200

def test_boundaries_never_exceed_audio_duration(sample_verses, base_mock_words):
    # Even when the last word ends near the recording end, no verse boundary
    # may exceed audio_duration_ms.
    result = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=base_mock_words,
        audio_duration_ms=16100,  # last word ends at 16000, +500 pad would overflow
        silence_regions=[],
    )
    prev_end = -1
    for a in result.alignments:
        assert a.end_ms <= 16100
        assert a.end_ms > a.start_ms
        assert a.start_ms >= prev_end
        prev_end = a.end_ms

def test_trailing_unanchored_run_respects_duration():
    from diwan_worker.schemas.transcript import TimedWord as TW
    verses = [
        {"id": "v-1", "order_index": 1, "text": "واحر قلباه ممن قلبه شبم",
         "first_hemistich": "واحر قلباه", "second_hemistich": "ممن قلبه شبم"},
        {"id": "v-2", "order_index": 2, "text": "ما لي اكتم حبا قد برى",
         "first_hemistich": "ما لي اكتم", "second_hemistich": "حبا قد برى"},
        {"id": "v-3", "order_index": 3, "text": "ان كان يجمعنا حب لغرته",
         "first_hemistich": "ان كان يجمعنا", "second_hemistich": "حب لغرته"},
    ]
    # Only verse 1 in ASR; recording barely longer than its words.
    words = [
        TW(word="واحر", start_ms=100, end_ms=600, probability=0.95),
        TW(word="قلباه", start_ms=700, end_ms=1200, probability=0.95),
        TW(word="ممن", start_ms=1300, end_ms=1700, probability=0.95),
        TW(word="قلبه", start_ms=1800, end_ms=2200, probability=0.95),
        TW(word="شبم", start_ms=2300, end_ms=2800, probability=0.95),
    ]
    result = align_transcript_to_verses(verses, words, audio_duration_ms=2900)
    prev_end = -1
    for a in result.alignments:
        assert a.end_ms <= 2900, f"verse {a.order_index} end {a.end_ms} > duration"
        assert a.end_ms > a.start_ms
        assert a.start_ms >= prev_end
        prev_end = a.end_ms
