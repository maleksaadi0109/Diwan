from __future__ import annotations
import os
import shutil
import sys
import time
from typing import Callable, Optional, List
from ..schemas.transcript import (
    TimedWord,
    TranscriptSegment,
    TranscriptResult,
)
from ..audio.inspector import inspect_audio
from ..audio.vad import detect_speech_regions

ProgressCallback = Callable[[float, str], None]

def normalize_windows_path(p: str) -> str:
    if not p:
        return p
    s = str(p)
    if s.startswith(("\\\\?\\", "\\??\\", "//?/", "/??/")):
        s = s[4:]
    return os.path.normpath(s)

def resolve_models_dir() -> str:
    # 1. Check DIWAN_MODELS_DIR environment variable
    if "DIWAN_MODELS_DIR" in os.environ:
        clean = normalize_windows_path(os.environ["DIWAN_MODELS_DIR"])
        if os.path.exists(clean):
            return clean

    # 2. Check bundled resource directories relative to sys.executable (PyInstaller on Windows)
    if getattr(sys, "frozen", False):
        base_dir = normalize_windows_path(os.path.dirname(sys.executable))
        for candidate in [
            os.path.join(base_dir, "..", "models"),
            os.path.join(base_dir, "models"),
        ]:
            if os.path.exists(candidate):
                return normalize_windows_path(candidate)

    # 3. Check relative models directory in project workspace
    for candidate in [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "src-tauri", "windows-dist", "models"),
        os.path.join(os.getcwd(), "models"),
        os.path.join(os.getcwd(), "windows-dist", "models"),
    ]:
        if os.path.exists(candidate):
            return normalize_windows_path(candidate)

    return normalize_windows_path(os.environ.get(
        "DIWAN_MODELS_DIR",
        os.path.expanduser("~/.cache/diwan/models"),
    ))


def _resolve_bundled_model_dir(model_size: str) -> Optional[str]:
    """Locates a pre-converted CTranslate2 Whisper model bundled alongside
    the app, if one exists for `model_size`.

    On Windows, the packaged build bundles the CTranslate2-converted
    "small" model as a Tauri resource (see WINDOWS_PACKAGING.md). The Rust
    host sets `DIWAN_BUNDLED_MODELS_DIR` to that resource directory's
    absolute path before spawning the worker; everywhere else (dev sandbox,
    Linux/macOS, or a Windows build without the bundled model) the env var
    is unset or the specific model_size subfolder is missing, so callers
    fall back to the normal huggingface_hub download path.

    Passing a local directory straight to `WhisperModel(...)` makes
    faster-whisper skip the Hugging Face Hub entirely (it only consults the
    network when given a model name/ID rather than an existing directory),
    which is exactly what lets a fresh install transcribe with no internet
    access on the very first run.
    """
    base = os.environ.get("DIWAN_BUNDLED_MODELS_DIR")
    if not base:
        return None
    candidate = os.path.join(base, model_size)
    if os.path.isdir(candidate) and os.path.isfile(
        os.path.join(candidate, "model.bin")
    ):
        return candidate
    return None


def _configure_resilient_download_backend() -> None:
    """Makes the Whisper model download (via huggingface_hub) survive a
    flaky connection instead of failing outright on the first hiccup.

    On some Windows machines, antivirus/firewall SSL inspection or an
    unstable network resets in-flight HTTPS downloads (WinError 10054 /
    "An existing connection was forcibly closed by the remote host").
    huggingface_hub's default HTTP session has no retry policy, so a single
    reset anywhere in the ~250MB model download aborts the whole
    transcription. Installing a urllib3 Retry-backed session here makes
    the download layer itself retry transient connection failures before
    giving up, on every machine -- not just ones that already have the
    model cached.
    """
    try:
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        from huggingface_hub import configure_http_backend

        def _resilient_session_factory() -> "requests.Session":
            session = requests.Session()
            retry = Retry(
                total=5,
                connect=5,
                read=5,
                backoff_factor=2,
                status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=None,  # retry on GET/HEAD by default is fine for downloads
            )
            adapter = HTTPAdapter(max_retries=retry)
            session.mount("http://", adapter)
            session.mount("https://", adapter)
            return session

        configure_http_backend(backend_factory=_resilient_session_factory)
    except Exception:
        # Best-effort only: if huggingface_hub's API shape changes or the
        # dependency is missing, fall back to the default (non-retrying)
        # behavior rather than blocking transcription entirely.
        pass


def get_free_disk_space_bytes(path: str) -> int:
    try:
        os.makedirs(path, exist_ok=True)
        stat = shutil.disk_usage(path)
        return stat.free
    except Exception:
        return 10 * 1024 * 1024 * 1024  # default assumption 10GB

def generate_mock_arabic_transcript(
    audio_path: str,
    model_size: str = "tiny",
    device: str = "cpu",
    on_progress: Optional[ProgressCallback] = None,
) -> TranscriptResult:
    """Generates realistic Arabic transcription based on actual audio duration and VAD regions."""
    if on_progress:
        on_progress(0.2, "جاري تهيئة نموذج معالجة الصوت...")

    meta = inspect_audio(audio_path)
    intervals = detect_speech_regions(audio_path)
    if not intervals:
        # Default single speech interval across duration
        from ..schemas.protocol import SpeechInterval
        intervals = [SpeechInterval(start_ms=1000, end_ms=max(2000, meta.duration_ms - 1000))]

    if on_progress:
        on_progress(0.6, "جاري تحويل الكلام إلى نصوص وحساب طوابع الكلمات...")

    # Sample classical Arabic vocabulary for synthetic transcript
    sample_arabic_tokens = [
        "واحر", "قلباه", "ممن", "قلبه", "شبم", "ومن", "بجسمي", "وحالي", "عنده", "سقم",
        "ما", "لي", "أكتم", "حبا", "قد", "برى", "جسدي", "وتدعي", "حب", "سيف", "الدولة", "الأمم",
        "إن", "كان", "يجمعنا", "حب", "لغرته", "فليت", "أنا", "بقدر", "الحب", "نقتسم",
        "يا", "أعدل", "الناس", "إلا", "في", "معاملتي", "فيك", "الخصام", "وأنت", "الخصم", "والحكم",
        "أعيذها", "نظرات", "منك", "صادقة", "أن", "تحسب", "الشحم", "فيمن", "شحمه", "ورم",
    ]

    segments: List[TranscriptSegment] = []
    all_words: List[TimedWord] = []
    token_idx = 0

    for seg_id, interval in enumerate(intervals):
        seg_duration = interval.end_ms - interval.start_ms
        num_words = max(2, min(10, seg_duration // 400))
        word_ms = seg_duration // num_words

        seg_words: List[TimedWord] = []
        for w_i in range(num_words):
            w_text = sample_arabic_tokens[token_idx % len(sample_arabic_tokens)]
            token_idx += 1
            w_start = interval.start_ms + (w_i * word_ms)
            w_end = min(interval.end_ms, w_start + word_ms - 30)

            timed_w = TimedWord(
                word=w_text,
                start_ms=w_start,
                end_ms=w_end,
                probability=0.92,
            )
            seg_words.append(timed_w)
            all_words.append(timed_w)

        seg_text = " ".join(w.word for w in seg_words)
        segments.append(
            TranscriptSegment(
                id=seg_id + 1,
                text=seg_text,
                start_ms=interval.start_ms,
                end_ms=interval.end_ms,
                words=seg_words,
                avg_logprob=-0.15,
                no_speech_prob=0.01,
            )
        )

    if on_progress:
        on_progress(0.95, "اكتمل استخراج النصوص الصوتية بنجاح.")

    raw_text = " ".join(s.text for s in segments)
    return TranscriptResult(
        raw_text=raw_text,
        language="ar",
        duration_ms=meta.duration_ms,
        segments=segments,
        words=all_words,
        model_used=model_size,
        device_used=device,
    )

def transcribe_arabic_audio(
    audio_path: str,
    model_size: str = "tiny",
    device: str = "cpu",
    compute_type: str = "default",
    on_progress: Optional[ProgressCallback] = None,
    mock: bool = False,
) -> TranscriptResult:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    models_dir = resolve_models_dir()

    # Check disk space for models dir (tiny only needs ~80MB)
    free_space = get_free_disk_space_bytes(models_dir)
    if free_space < 80 * 1024 * 1024:
        raise RuntimeError(f"Low disk space in models cache directory ({free_space // (1024*1024)} MB available). At least 80MB is required.")

    if mock:
        return generate_mock_arabic_transcript(audio_path, model_size, device, on_progress)

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        # No silent synthetic fallback: fabricated words would produce fake
        # alignments presented as real. Callers must pass mock=True explicitly.
        raise RuntimeError(
            "ASR_UNAVAILABLE: مكوّن faster-whisper غير مثبت؛ لا يمكن إجراء تفريغ صوتي حقيقي. "
            "ثبّت faster-whisper أو استخدم الوضع التجريبي (mock) بشكل صريح."
        )

    ctranslate2_compute = "int8" if device == "cpu" and compute_type == "default" else compute_type

    # Check if a direct local offline model folder exists
    direct_model_path = None
    for candidate in [
        os.path.join(models_dir, model_size),
        os.path.join(models_dir, f"models--Systran--faster-whisper-{model_size}"),
        _resolve_bundled_model_dir(model_size),
    ]:
        if candidate and os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "model.bin")):
            direct_model_path = normalize_windows_path(candidate)
            break

    if direct_model_path:
        if on_progress:
            on_progress(0.15, f"جاري تحميل نموذج Whisper ({model_size}) المضمّن محليًا على {device}...")
        model = WhisperModel(
            direct_model_path,
            device=device,
            compute_type=ctranslate2_compute,
        )
    else:
        if on_progress:
            on_progress(0.15, f"جاري تحميل نموذج Whisper ({model_size}) على {device}...")

        _configure_resilient_download_backend()

        max_attempts = 4
        model = None
        last_error: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            try:
                model = WhisperModel(
                    model_size,
                    device=device,
                    compute_type=ctranslate2_compute,
                    download_root=normalize_windows_path(models_dir),
                )
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt < max_attempts:
                    if on_progress:
                        on_progress(
                            0.15,
                            f"انقطع الاتصال أثناء تحميل النموذج، جاري إعادة المحاولة ({attempt}/{max_attempts - 1})...",
                        )
                    time.sleep(2 * attempt)
        if model is None:
            raise RuntimeError(
                "تعذّر تحميل نموذج Whisper بسبب مشكلة في الاتصال بالإنترنت "
                f"(تمت المحاولة {max_attempts} مرات). تأكد من استقرار الاتصال أو أن برنامج "
                f"الحماية/الجدار الناري لا يحجب التحميل، ثم أعد المحاولة. "
                f"({type(last_error).__name__ if last_error else 'unknown'})"
            ) from last_error

    if on_progress:
        on_progress(0.4, "جاري معالجة الصوت واستخراج طوابع الكلمات باللغة العربية...")

    # Transcribe with Arabic language specification and word timestamps
    segments_iter, info = model.transcribe(
        audio_path,
        language="ar",
        task="transcribe",
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
    )

    segments: List[TranscriptSegment] = []
    all_words: List[TimedWord] = []

    for seg_idx, segment in enumerate(segments_iter):
        seg_words: List[TimedWord] = []
        if segment.words:
            for w in segment.words:
                timed_w = TimedWord(
                    word=w.word.strip(),
                    start_ms=int(round(w.start * 1000)),
                    end_ms=int(round(w.end * 1000)),
                    probability=float(w.probability if hasattr(w, "probability") else 1.0),
                )
                seg_words.append(timed_w)
                all_words.append(timed_w)

        segments.append(
            TranscriptSegment(
                id=seg_idx + 1,
                text=segment.text.strip(),
                start_ms=int(round(segment.start * 1000)),
                end_ms=int(round(segment.end * 1000)),
                words=seg_words,
                avg_logprob=getattr(segment, "avg_logprob", None),
                no_speech_prob=getattr(segment, "no_speech_prob", None),
            )
        )

    if on_progress:
        on_progress(1.0, "اكتمل التفريغ الصوتي بنجاح.")

    raw_text = " ".join(s.text for s in segments)
    duration_ms = int(round(info.duration * 1000)) if hasattr(info, "duration") else 0

    return TranscriptResult(
        raw_text=raw_text,
        language=info.language if hasattr(info, "language") else "ar",
        duration_ms=duration_ms,
        segments=segments,
        words=all_words,
        model_used=model_size,
        device_used=device,
    )
