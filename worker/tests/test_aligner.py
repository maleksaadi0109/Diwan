from diwan_worker.alignment.aligner import align_transcript_to_verses
from diwan_worker.schemas.transcript import TimedWord

def test_align_transcript_to_verses():
    mock_verses = [
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

    mock_words = [
        # Verse 1 words
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
        # Verse 2 words
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
        verses=mock_verses,
        transcript_words=mock_words,
        audio_duration_ms=16000,
        poem_id="poem-1",
        recording_id="rec-1",
    )

    assert len(result.alignments) == 2
    v1 = result.alignments[0]
    v2 = result.alignments[1]

    assert v1.verse_id == "v-1"
    assert v1.start_ms == 1000
    assert v1.end_ms == 7500
    assert v1.confidence > 0.80

    assert v2.verse_id == "v-2"
    assert v2.start_ms == 8000
    assert v2.end_ms == 15500
    assert v2.confidence > 0.80
