from diwan_worker.alignment.aligner import align_transcript_to_verses
from diwan_worker.schemas.transcript import TimedWord

def test_align_transcript_to_verses_with_midpoint_boundaries():
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
        # Verse 2 words (starts at 8000ms)
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

    # Boundary sits just before v2's first word (8000 - 100 lead), NOT at the
    # silence midpoint, so v1 stays highlighted through the pause.
    assert v1.start_ms == 1000
    assert v1.end_ms == 7900
    assert v2.start_ms == 7900
    assert v2.end_ms <= 16000
    assert v1.confidence > 0.80
    assert v2.confidence > 0.80

def test_align_transcript_removes_intro_commentary():
    mock_verses = [
        {
            "id": "v-1",
            "order_index": 1,
            "text": "واحر قلباه ممن قلبه شبم",
            "first_hemistich": "واحر قلباه",
            "second_hemistich": "ممن قلبه شبم",
        }
    ]

    # Audio contains 3 seconds of reciter commentary before poem
    mock_words = [
        TimedWord(word="قال", start_ms=500, end_ms=800, probability=0.9),
        TimedWord(word="ابو", start_ms=900, end_ms=1200, probability=0.9),
        TimedWord(word="الطيب", start_ms=1300, end_ms=1800, probability=0.9),
        TimedWord(word="المتنبي", start_ms=1900, end_ms=2500, probability=0.9),
        # Actual poem starts at 3500ms
        TimedWord(word="واحر", start_ms=3500, end_ms=4000, probability=0.95),
        TimedWord(word="قلباه", start_ms=4100, end_ms=4700, probability=0.96),
        TimedWord(word="ممن", start_ms=4800, end_ms=5200, probability=0.98),
        TimedWord(word="قلبه", start_ms=5300, end_ms=5800, probability=0.94),
        TimedWord(word="شبم", start_ms=5900, end_ms=6500, probability=0.92),
    ]

    result = align_transcript_to_verses(
        verses=mock_verses,
        transcript_words=mock_words,
        audio_duration_ms=7000,
    )

    assert result.intro_offset_ms == 3500
    assert result.alignments[0].start_ms == 3500
    assert result.alignments[0].confidence > 0.85

def _mtnb_verses():
    return [
        {"id": "v-1", "order_index": 1,
         "text": "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
         "first_hemistich": "واحر قلباه ممن قلبه شبم",
         "second_hemistich": "ومن بجسمي وحالي عنده سقم"},
        {"id": "v-2", "order_index": 2,
         "text": "ما لي أكتم حبا قد برى جسدي وتدعي حب سيف الدولة الأمم",
         "first_hemistich": "ما لي أكتم حبا قد برى جسدي",
         "second_hemistich": "وتدعي حب سيف الدولة الأمم"},
        {"id": "v-3", "order_index": 3,
         "text": "إن كان يجمعنا حب لغرته فليت أنا بقدر الحب نقتسم",
         "first_hemistich": "إن كان يجمعنا حب لغرته",
         "second_hemistich": "فليت أنا بقدر الحب نقتسم"},
    ]

def _words(spec, start=1000, step=600):
    out = []
    t = start
    for w in spec:
        out.append(TimedWord(word=w, start_ms=t, end_ms=t + step - 100, probability=0.93))
        t += step
    return out

def test_missing_asr_words_do_not_shift_following_verses():
    # ASR dropped two words of verse 1; verses 2-3 must still anchor correctly.
    verses = _mtnb_verses()
    spec = (
        "واحر قلباه قلبه شبم بجسمي وحالي عنده سقم "      # v1 missing ممن + ومن
        "ما لي اكتم حبا قد برى جسدي وتدعي حب سيف الدوله الامم "
        "ان كان يجمعنا حب لغرته فليت انا بقدر الحب نقتسم"
    ).split()
    words = _words(spec)
    result = align_transcript_to_verses(verses, words, audio_duration_ms=25000)
    a = result.alignments
    # Verse 2 must start at its own first word "ما" not shifted into verse 1/3
    v2_first_word_idx = 8  # after 8 v1 words
    assert abs(a[1].first_word_start_ms - words[v2_first_word_idx].start_ms) < 400
    assert a[0].end_ms <= a[1].start_ms <= a[2].start_ms
    assert all(x.confidence > 0.6 for x in a)

def test_extra_asr_words_between_verses_do_not_shift():
    # Reciter repeats a filler between verse 1 and 2.
    verses = _mtnb_verses()[:2]
    spec = (
        "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم "
        "نعم نعم الله "                                     # extra non-poem words
        "ما لي اكتم حبا قد برى جسدي وتدعي حب سيف الدوله الامم"
    ).split()
    words = _words(spec)
    result = align_transcript_to_verses(verses, words, audio_duration_ms=25000)
    a = result.alignments
    v2_first = words[13]  # "ما"
    assert abs(a[1].first_word_start_ms - v2_first.start_ms) < 400
    assert a[0].last_word_end_ms <= words[9].end_ms + 400

def test_similar_verses_stay_monotonic():
    # Two verses sharing many words ("حب") must not swap or collapse.
    verses = _mtnb_verses()
    spec = (
        "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم "
        "ما لي اكتم حبا قد برى جسدي وتدعي حب سيف الدوله الامم "
        "ان كان يجمعنا حب لغرته فليت انا بقدر الحب نقتسم"
    ).split()
    words = _words(spec)
    result = align_transcript_to_verses(verses, words, audio_duration_ms=30000)
    a = result.alignments
    assert a[0].start_ms < a[1].start_ms < a[2].start_ms
    assert a[0].end_ms <= a[1].start_ms and a[1].end_ms <= a[2].start_ms

def test_no_transcript_yields_low_confidence_review():
    verses = _mtnb_verses()
    result = align_transcript_to_verses(verses, [], audio_duration_ms=24000)
    assert all(a.status == "review" for a in result.alignments)
    assert all(a.confidence <= 0.3 for a in result.alignments)
    assert result.overall_confidence <= 0.3

def test_unmatched_middle_verse_interpolated_and_flagged():
    # Verse 2 entirely absent from ASR: it must be interpolated between
    # verse 1 and verse 3 and flagged for review, without shifting verse 3.
    verses = _mtnb_verses()
    spec = (
        "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم "
        "ان كان يجمعنا حب لغرته فليت انا بقدر الحب نقتسم"
    ).split()
    words = _words(spec)
    result = align_transcript_to_verses(verses, words, audio_duration_ms=25000)
    a = result.alignments
    v3_first = words[10]  # "ان"
    assert abs(a[2].first_word_start_ms - v3_first.start_ms) < 400
    assert a[1].status == "review"
    assert a[1].confidence <= 0.3
    assert a[0].end_ms <= a[1].start_ms <= a[1].end_ms <= a[2].start_ms

def test_phonetic_confusions_still_match():
    from diwan_worker.alignment.aligner import token_similarity
    assert token_similarity("سقم", "صقم") > 0.7        # س/ص
    assert token_similarity("شبم", "شبم") == 1.0
    assert token_similarity("وحالي", "حالي") >= 0.85    # clitic و
    assert token_similarity("قلباه", "الدوله") < 0.5

def test_zero_probability_words_are_not_anchors_boost():
    # A word explicitly rejected (probability 0) must earn less than a trusted word.
    from diwan_worker.alignment.aligner import align_transcript_to_verses as _a
    verses = [_mtnb_verses()[0]]
    good = _words("واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم".split())
    bad = [TimedWord(word=w.word, start_ms=w.start_ms, end_ms=w.end_ms, probability=0.0) for w in good]
    conf_good = _a(verses, good, audio_duration_ms=8000).alignments[0].confidence
    conf_bad = _a(verses, bad, audio_duration_ms=8000).alignments[0].confidence
    assert conf_good > conf_bad

def test_overlapping_timestamps_stay_monotonic_positive():
    # Overlapping/zero-gap ASR timestamps must never yield zero-duration or
    # backwards verse spans.
    verses = _mtnb_verses()
    words = []
    t = 1000
    all_tokens = (
        "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم "
        "ما لي اكتم حبا قد برى جسدي وتدعي حب سيف الدوله الامم "
        "ان كان يجمعنا حب لغرته فليت انا بقدر الحب نقتسم"
    ).split()
    for i, w in enumerate(all_tokens):
        # heavy overlap: each word overlaps the next
        words.append(TimedWord(word=w, start_ms=t, end_ms=t + 700, probability=0.9))
        t += 200
    result = align_transcript_to_verses(verses, words, audio_duration_ms=12000)
    prev_end = -1
    for a in result.alignments:
        assert a.end_ms > a.start_ms, f"zero/negative span in verse {a.order_index}"
        assert a.start_ms >= prev_end, f"non-monotonic at verse {a.order_index}"
        prev_end = a.end_ms

def test_multiple_unanchored_verses_in_zero_gap():
    # Verses 2 and 3 absent from ASR with no time gap left: still monotonic,
    # positive spans, flagged review.
    verses = _mtnb_verses()
    words = _words("واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم".split())
    result = align_transcript_to_verses(verses, words, audio_duration_ms=7100)
    prev_end = -1
    for a in result.alignments:
        assert a.end_ms > a.start_ms
        assert a.start_ms >= prev_end
        prev_end = a.end_ms
    assert result.alignments[1].status == "review"
    assert result.alignments[2].status == "review"

def test_no_transcript_short_recording_bounded_by_duration():
    # 500ms recording, 3 verses: fallback must never exceed the real duration.
    verses = _mtnb_verses()
    result = align_transcript_to_verses(verses, [], audio_duration_ms=500)
    prev_end = 0
    for a in result.alignments:
        assert a.end_ms <= 500
        assert a.start_ms >= prev_end
        prev_end = a.end_ms
    assert result.alignments[-1].end_ms == 500

def test_no_transcript_unknown_duration_produces_no_alignments():
    # Unknown duration + no transcript: no honest estimate exists — save
    # unaligned instead of fabricating boundaries.
    verses = _mtnb_verses()
    result = align_transcript_to_verses(verses, [], audio_duration_ms=0)
    assert result.alignments == []
    assert result.overall_confidence == 0.0

def test_trailing_unanchored_unknown_duration_no_8s_slots():
    # Only verse 1 in ASR, duration unknown: trailing verses must not get
    # fabricated multi-second slots.
    verses = _mtnb_verses()
    words = _words("واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم".split())
    result = align_transcript_to_verses(verses, words, audio_duration_ms=0)
    last_word_end = words[-1].end_ms
    prev_end = -1
    for a in result.alignments:
        assert a.end_ms > a.start_ms
        assert a.start_ms >= prev_end
        prev_end = a.end_ms
    # Trailing review verses collapse near the last real word, no +8s each
    assert result.alignments[-1].end_ms <= last_word_end + 1000
    assert result.alignments[1].status == "review"
    assert result.alignments[2].status == "review"
