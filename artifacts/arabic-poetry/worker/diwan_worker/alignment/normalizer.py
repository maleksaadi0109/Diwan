from __future__ import annotations
import re

# Tashkeel / Harakat regex (including tanween, shadda, sukun, dagger alif, quranic marks)
TASHKEEL_REGEX = re.compile(
    r"[\u0617-\u061A\u064B-\u0652\u0656-\u065F\u0670\u06D6-\u06ED]"
)

# Tatweel (Kashida)
TATWEEL_REGEX = re.compile(r"\u0640")

# Punctuation & special symbols
PUNCTUATION_REGEX = re.compile(
    r"[،؟؛:\.\,\?\"\'\-\(\)«»!\[\]/\\_—~…\*\+\=\<\>\$\#\@\%\^\&\؛]"
)

def remove_tashkeel(text: str) -> str:
    """Removes all Arabic diacritical marks (harakat, tanween, shadda, sukun)."""
    return TASHKEEL_REGEX.sub("", text)

def normalize_arabic(text: str) -> str:
    """
    Standard Arabic text normalization:
    - Removes all diacritics and tatweel
    - Unifies Alef variants (أ, إ, آ, ٱ -> ا)
    - Unifies Taa Marbuta (ة -> ه)
    - Unifies Alif Maqsura (ى -> ي)
    - Strips punctuation and unifies whitespaces
    """
    if not text:
        return ""

    # 1. Remove Tashkeel
    normalized = remove_tashkeel(text)

    # 2. Remove Tatweel
    normalized = TATWEEL_REGEX.sub("", normalized)

    # 3. Unify Alefs
    normalized = re.sub(r"[إأآٱ]", "ا", normalized)

    # 4. Unify Taa Marbuta
    normalized = re.sub(r"ة", "ه", normalized)

    # 5. Unify Alif Maqsura
    normalized = re.sub(r"ى", "ي", normalized)

    # 6. Remove punctuation
    normalized = PUNCTUATION_REGEX.sub(" ", normalized)

    # 7. Normalize whitespaces
    normalized = re.sub(r"\s+", " ", normalized).strip()

    return normalized

# Phonetically-confusable Arabic consonant classes (common ASR substitutions)
_PHONETIC_CLASS_MAP = {
    "ت": "t", "ط": "t", "د": "d", "ض": "d",
    "س": "s", "ص": "s", "ث": "s",
    "ز": "z", "ذ": "z", "ظ": "z",
    "ه": "h", "ح": "h",
    "ء": "", "ؤ": "", "ئ": "",
    "ق": "q", "ك": "k",
    "ج": "j", "غ": "g", "خ": "x", "ع": "3",
}

def phonetic_key(token: str) -> str:
    """
    Collapses a normalized Arabic token into a phonetic class string so that
    common ASR consonant confusions (ت/ط، س/ص/ث، ذ/ز/ظ، ه/ح ...) still match.
    """
    out = []
    for ch in token:
        out.append(_PHONETIC_CLASS_MAP.get(ch, ch))
    return "".join(out)

def tokenize_normalized(text: str) -> list[str]:
    """Normalizes text and splits into tokens."""
    norm = normalize_arabic(text)
    return [t for t in norm.split() if t]
