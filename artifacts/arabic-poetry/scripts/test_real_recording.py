import os
import sys

# Ensure worker is on PYTHONPATH
sys.path.insert(0, os.path.abspath("worker"))

from diwan_worker.audio.converter import convert_to_wav_16k_mono
from diwan_worker.audio.vad import analyze_audio_vad
from diwan_worker.alignment.aligner import align_transcript_to_verses
from diwan_worker.asr.transcriber import transcribe_arabic_audio

def main():
    audio_path = "public/recordings/mutanabbi_waharra.mp3"
    if not os.path.exists(audio_path):
        print(f"Audio file not found at {audio_path}")
        return

    # Convert to 16kHz mono WAV
    wav_path = "public/recordings/mutanabbi_waharra_16k.wav"
    convert_to_wav_16k_mono(audio_path, wav_path)

    # 1. VAD Silence Detection
    vad_res = analyze_audio_vad(wav_path)
    print(f"Detected {len(vad_res.speech_regions)} speech regions and {len(vad_res.silence_regions)} silence regions.")

    # 2. Sample verses
    sample_verses = [
        {
            "id": "v-1",
            "order_index": 1,
            "text": "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
            "first_hemistich": "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
            "second_hemistich": "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
        },
        {
            "id": "v-2",
            "order_index": 2,
            "text": "ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ",
            "first_hemistich": "ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي",
            "second_hemistich": "وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ",
        },
        {
            "id": "v-3",
            "order_index": 3,
            "text": "إِن كانَ يَجمَعُنا حُبٌّ لِغُرَّتِهِ فَلَيتَ أَنّا بِقَدرِ الحُبِّ نَقتَسِمُ",
            "first_hemistich": "إِن كانَ يَجمَعُنا حُبٌّ لِغُرَّتِهِ",
            "second_hemistich": "فَلَيتَ أَنّا بِقَدرِ الحُبِّ نَقتَسِمُ",
        },
    ]

    # 3. Transcribe / Align
    transcript = transcribe_arabic_audio(wav_path, mock=False)
    alignment_res = align_transcript_to_verses(
        verses=sample_verses,
        transcript_words=transcript.words,
        audio_duration_ms=transcript.duration_ms,
        silence_regions=vad_res.silence_regions,
    )

    print("\n" + "=" * 90)
    print(f"{'verse index':^12} | {'ASR boundary':^16} | {'detected silence':^24} | {'final boundary':^16} | {'confidence':^12}")
    print("=" * 90)

    for align in alignment_res.alignments:
        diag = align.diagnostic or {}
        v_idx = f"Verse {align.order_index}"
        asr_b = f"{diag.get('asr_end_ms', align.end_ms)} ms"

        sil_start = diag.get("detected_silence_start_ms")
        sil_end = diag.get("detected_silence_end_ms")
        if sil_start is not None and sil_end is not None:
            sil_str = f"[{sil_start} - {sil_end} ms] ({sil_end - sil_start}ms)"
        else:
            sil_str = "None (ASR Fallback)"

        final_b = f"[{align.start_ms} - {align.end_ms} ms]"
        conf_str = f"{align.confidence * 100:.1f}% ({diag.get('method', 'auto')})"

        print(f"{v_idx:^12} | {asr_b:^16} | {sil_str:^24} | {final_b:^16} | {conf_str:^12}")

    print("=" * 90)

if __name__ == "__main__":
    main()
