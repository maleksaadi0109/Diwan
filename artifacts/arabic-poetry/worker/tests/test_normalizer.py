from diwan_worker.alignment.normalizer import (
    normalize_arabic,
    remove_tashkeel,
    tokenize_normalized,
)

def test_remove_tashkeel():
    tashkeel_text = "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ"
    cleaned = remove_tashkeel(tashkeel_text)
    assert cleaned == "واحر قلباه ممن قلبه شبم"

def test_normalize_alef_variants():
    text = "إِنَّ أَنَا آتٍ ٱلْيَوْمَ"
    norm = normalize_arabic(text)
    assert norm == "ان انا ات اليوم"

def test_normalize_taa_marbuta_and_alif_maqsura():
    text = "رَأَيْتُ حِكْمَةَ الدُّنْيَى"
    norm = normalize_arabic(text)
    assert norm == "رايت حكمه الدنيي"

def test_tokenize_normalized():
    text = "واحرَّ قلباهُ، ممنْ قلبهُ... شبمُ!"
    tokens = tokenize_normalized(text)
    assert tokens == ["واحر", "قلباه", "ممن", "قلبه", "شبم"]
